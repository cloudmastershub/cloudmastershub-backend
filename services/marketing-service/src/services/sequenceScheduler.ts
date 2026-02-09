import Queue from 'bull';
import mongoose from 'mongoose';
import {
  EmailSequence,
  EmailSequenceStatus,
  SequenceTrigger,
  SendTimeOption,
  IEmailSequence,
  ISequenceEmail,
} from '../models/EmailSequence';
import { EmailQueueJob, EmailJobStatus, EmailJobType } from '../models/EmailQueueJob';
import { Lead, LeadStatus, ILead } from '../models/Lead';
import { EmailTemplate } from '../models/EmailTemplate';
import emailService from './emailService';
import logger from '../utils/logger';
import { getTenantId, runWithTenant, DEFAULT_TENANT } from '../utils/tenantContext';

// Redis connection
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Email Queue - For processing email sends
 */
const emailQueue = new Queue<{
  jobId: string;
  tenantId?: string;
}>('email-send', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 minute initial delay
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Sequence Processor Queue - For enrolling leads and scheduling emails
 */
const sequenceProcessorQueue = new Queue<{
  type: 'enroll' | 'process_next' | 'check_conditions' | 'cleanup';
  leadId: string;
  sequenceId: string;
  currentEmailOrder?: number;
  triggerData?: Record<string, any>;
  tenantId?: string;
}>('sequence-processor', REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 30000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Sequence Scheduler Service
 *
 * Handles email sequence automation:
 * - Enrolling leads in sequences based on triggers
 * - Scheduling sequence emails
 * - Processing email sends via Bull queue
 * - Checking conditions and exit triggers
 */
class SequenceSchedulerService {
  private isInitialized = false;

  /**
   * Initialize the scheduler
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Set up queue processors
    this.setupEmailProcessor();
    this.setupSequenceProcessor();

    // Set up recurring jobs
    await this.setupRecurringJobs();

    this.isInitialized = true;
    logger.info('SequenceScheduler initialized');
  }

  /**
   * Setup email send processor
   */
  private setupEmailProcessor(): void {
    emailQueue.process(async (job) => {
      const { jobId, tenantId } = job.data;
      const resolvedTenant = tenantId || DEFAULT_TENANT;
      if (!tenantId) {
        logger.debug('Email-send job missing tenantId, using default', { jobId, bullJobId: job.id });
      }

      return runWithTenant(resolvedTenant, async () => {
      // Handle recurring "process-pending" job - this triggers processing of pending emails
      if (jobId === 'process-pending') {
        const count = await this.processPendingJobs();
        logger.debug(`Processed ${count} pending email jobs`);
        return { success: true, processed: count };
      }

      try {
        const emailJob = await EmailQueueJob.findById(jobId);
        if (!emailJob) {
          logger.warn(`Email job not found: ${jobId}`);
          return { success: false, error: 'Job not found' };
        }

        // Check if job should still be sent
        if (emailJob.status === EmailJobStatus.CANCELLED ||
            emailJob.status === EmailJobStatus.SKIPPED) {
          return { success: false, skipped: true };
        }

        // Check lead status
        const lead = await Lead.findById(emailJob.leadId);
        if (!lead) {
          await emailJob.markSkipped('Lead not found');
          return { success: false, error: 'Lead not found' };
        }

        // Check if lead is still subscribed
        if (!lead.emailConsent ||
            lead.status === LeadStatus.UNSUBSCRIBED ||
            lead.status === LeadStatus.BOUNCED) {
          await emailJob.markSkipped('Lead unsubscribed or bounced');
          return { success: false, skipped: true };
        }

        // Check sequence conditions if this is a sequence email
        if (emailJob.sequenceId) {
          const shouldSend = await this.checkSequenceConditions(
            emailJob.sequenceId,
            emailJob.leadId,
            emailJob.sequenceEmailOrder || 0
          );
          if (!shouldSend.send) {
            await emailJob.markSkipped(shouldSend.reason || 'Conditions not met');
            return { success: false, skipped: true, reason: shouldSend.reason };
          }
        }

        // Mark as processing
        emailJob.status = EmailJobStatus.PROCESSING;
        await emailJob.save();

        // Get template and render
        const template = await EmailTemplate.findById(emailJob.templateId);
        if (!template) {
          await emailJob.markFailed('Template not found');
          return { success: false, error: 'Template not found' };
        }

        // Build context
        const context = {
          firstName: lead.firstName || 'there',
          lastName: lead.lastName || '',
          email: lead.email,
          currentYear: new Date().getFullYear(),
          unsubscribeLink: `${process.env.APP_URL}/unsubscribe?email=${encodeURIComponent(lead.email)}`,
          ...emailJob.templateContext,
        };

        // Send email
        const result = await emailService.sendTemplatedEmail(
          emailJob.templateId,
          lead.email,
          context,
          {
            toName: lead.firstName,
            tags: emailJob.tags || [],
            metadata: {
              jobId: emailJob._id.toString(),
              sequenceId: emailJob.sequenceId?.toString() || '',
              campaignId: emailJob.campaignId?.toString() || '',
            },
          }
        );

        if (result.success && result.messageId) {
          await emailJob.markSent(result.messageId);

          // Update lead email engagement
          lead.email_engagement.emailsReceived += 1;
          lead.email_engagement.lastEmailReceivedAt = new Date();
          await lead.save();

          // Update sequence progress for lead
          if (emailJob.sequenceId && emailJob.sequenceEmailOrder !== undefined) {
            await this.updateLeadSequenceProgress(
              emailJob.leadId,
              emailJob.sequenceId,
              emailJob.sequenceEmailOrder
            );

            // Schedule next email in sequence
            await this.scheduleNextSequenceEmail(
              emailJob.sequenceId,
              emailJob.leadId,
              emailJob.sequenceEmailOrder
            );
          }

          logger.info(`Email sent: ${result.messageId}`, {
            jobId: emailJob._id.toString(),
            to: lead.email,
          });

          return { success: true, messageId: result.messageId };
        } else {
          await emailJob.markFailed('Send failed without message ID');
          return { success: false, error: 'Send failed' };
        }
      } catch (error: any) {
        logger.error('Email processor error:', error);

        const emailJob = await EmailQueueJob.findById(jobId);
        if (emailJob) {
          await emailJob.markFailed(error.message, error.code);
        }

        throw error; // Let Bull handle retry
      }
      }); // end runWithTenant
    });

    emailQueue.on('failed', (job, err) => {
      logger.error(`Email job ${job.data.jobId} failed:`, err);
    });

    emailQueue.on('completed', (job, result) => {
      if (result.success) {
        logger.debug(`Email job ${job.data.jobId} completed`);
      }
    });
  }

  /**
   * Setup sequence processor
   */
  private setupSequenceProcessor(): void {
    sequenceProcessorQueue.process(async (job) => {
      const { type, leadId, sequenceId, currentEmailOrder, triggerData, tenantId } = job.data;
      const resolvedTenant = tenantId || DEFAULT_TENANT;
      if (!tenantId) {
        logger.debug('Sequence-processor job missing tenantId, using default', { type, bullJobId: job.id });
      }

      return runWithTenant(resolvedTenant, async () => {
      try {
        switch (type) {
          case 'enroll':
            return await this.processEnrollment(leadId, sequenceId, triggerData);

          case 'process_next':
            return await this.scheduleNextSequenceEmail(
              new mongoose.Types.ObjectId(sequenceId),
              new mongoose.Types.ObjectId(leadId),
              currentEmailOrder || 0
            );

          case 'check_conditions':
            // Skip if this is the recurring cleanup job (empty IDs)
            if (!leadId || !sequenceId) {
              return { success: true, skipped: true, reason: 'Cleanup job - no action needed' };
            }
            return await this.checkSequenceConditions(
              new mongoose.Types.ObjectId(sequenceId),
              new mongoose.Types.ObjectId(leadId),
              currentEmailOrder || 0
            );

          case 'cleanup':
            // Handle daily cleanup job
            logger.info('Running daily cleanup job');
            await this.cleanupOldJobs();
            return { success: true };

          default:
            logger.warn(`Unknown sequence processor type: ${type}`);
            return { success: false };
        }
      } catch (error: any) {
        logger.error('Sequence processor error:', error);
        throw error;
      }
      }); // end runWithTenant
    });
  }

  /**
   * Setup recurring jobs
   */
  private async setupRecurringJobs(): Promise<void> {
    // Process pending emails every minute
    await emailQueue.add(
      { jobId: 'process-pending', tenantId: DEFAULT_TENANT },
      {
        repeat: { cron: '* * * * *' }, // Every minute
        jobId: 'process-pending-emails',
      }
    );

    // Clean up old jobs daily
    await sequenceProcessorQueue.add(
      { type: 'cleanup', leadId: '', sequenceId: '', tenantId: DEFAULT_TENANT },
      {
        repeat: { cron: '0 3 * * *' }, // 3 AM daily
        jobId: 'cleanup-old-jobs',
      }
    );
  }

  /**
   * Trigger sequence for a lead
   */
  async triggerSequence(
    trigger: SequenceTrigger,
    leadId: mongoose.Types.ObjectId | string,
    triggerData: Record<string, any> = {}
  ): Promise<{ enrolled: string[]; skipped: string[] }> {
    const leadObjectId = typeof leadId === 'string' ? new mongoose.Types.ObjectId(leadId) : leadId;

    // Find active sequences matching the trigger
    const sequences = await EmailSequence.find({
      trigger,
      status: EmailSequenceStatus.ACTIVE,
    });

    const enrolled: string[] = [];
    const skipped: string[] = [];

    for (const sequence of sequences) {
      // Check trigger config matches
      if (!this.matchesTriggerConfig(sequence, triggerData)) {
        continue;
      }

      // Check if lead is already enrolled
      const lead = await Lead.findById(leadObjectId);
      if (!lead) {
        skipped.push(sequence._id.toString());
        continue;
      }

      const existingEnrollment = lead.sequences.find(
        s => s.sequenceId === sequence._id.toString() && !s.exitedAt && !s.completedAt
      );

      if (existingEnrollment) {
        skipped.push(sequence._id.toString());
        continue;
      }

      // Add to processing queue
      await sequenceProcessorQueue.add({
        type: 'enroll',
        leadId: leadObjectId.toString(),
        sequenceId: sequence._id.toString(),
        triggerData,
        tenantId: getTenantId(),
      });

      enrolled.push(sequence._id.toString());
    }

    return { enrolled, skipped };
  }

  /**
   * Process enrollment
   */
  private async processEnrollment(
    leadId: string,
    sequenceId: string,
    triggerData?: Record<string, any>
  ): Promise<{ success: boolean; jobId?: string }> {
    const sequence = await EmailSequence.findById(sequenceId);
    if (!sequence || sequence.status !== EmailSequenceStatus.ACTIVE) {
      return { success: false };
    }

    const lead = await Lead.findById(leadId);
    if (!lead || !lead.emailConsent) {
      return { success: false };
    }

    // Enroll lead in sequence
    lead.sequences.push({
      sequenceId: sequence._id.toString(),
      enrolledAt: new Date(),
      currentEmailOrder: 0,
    });
    await lead.save();

    // Update sequence metrics
    sequence.metrics.totalEnrolled += 1;
    await sequence.save();

    logger.info(`Lead enrolled in sequence`, {
      leadId,
      sequenceId,
      sequenceName: sequence.name,
    });

    // Schedule first email
    const firstEmail = sequence.emails.find(e => e.order === 0 && e.isActive);
    if (firstEmail) {
      const jobId = await this.scheduleSequenceEmail(
        sequence,
        lead,
        firstEmail,
        triggerData
      );
      return { success: true, jobId };
    }

    return { success: true };
  }

  /**
   * Schedule a sequence email
   */
  private async scheduleSequenceEmail(
    sequence: IEmailSequence,
    lead: ILead,
    sequenceEmail: ISequenceEmail,
    triggerData?: Record<string, any>
  ): Promise<string> {
    // Calculate send time
    const scheduledFor = this.calculateSendTime(
      sequenceEmail,
      sequence.settings.timezone
    );

    // Create queue job
    const emailJob = new EmailQueueJob({
      type: EmailJobType.SEQUENCE,
      leadId: lead._id,
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      templateId: sequenceEmail.templateId,
      templateContext: {
        ...triggerData,
        sequenceName: sequence.name,
        emailNumber: sequenceEmail.order + 1,
      },
      sequenceId: sequence._id,
      sequenceEmailOrder: sequenceEmail.order,
      scheduledFor,
      timezone: sequence.settings.timezone,
      status: EmailJobStatus.SCHEDULED,
      tags: ['sequence', sequence.trigger],
    });

    await emailJob.save();

    // Add to Bull queue with delay
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    const bullJob = await emailQueue.add(
      { jobId: emailJob._id.toString(), tenantId: getTenantId() },
      {
        delay,
        jobId: `sequence-${sequence._id}-lead-${lead._id}-email-${sequenceEmail.order}`,
      }
    );

    emailJob.bullJobId = bullJob.id.toString();
    await emailJob.save();

    logger.info(`Sequence email scheduled`, {
      sequenceId: sequence._id.toString(),
      leadId: lead._id.toString(),
      emailOrder: sequenceEmail.order,
      scheduledFor,
    });

    return emailJob._id.toString();
  }

  /**
   * Schedule next email in sequence
   */
  private async scheduleNextSequenceEmail(
    sequenceId: mongoose.Types.ObjectId,
    leadId: mongoose.Types.ObjectId,
    currentOrder: number
  ): Promise<{ scheduled: boolean; jobId?: string }> {
    const sequence = await EmailSequence.findById(sequenceId);
    if (!sequence || sequence.status !== EmailSequenceStatus.ACTIVE) {
      return { scheduled: false };
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { scheduled: false };
    }

    // Check exit conditions
    const exitCheck = await this.checkExitConditions(sequence, lead);
    if (exitCheck.shouldExit) {
      await this.exitLeadFromSequence(lead, sequenceId, exitCheck.reason || 'Exit condition met');
      return { scheduled: false };
    }

    // Find next email
    const nextEmail = sequence.emails
      .filter(e => e.order > currentOrder && e.isActive)
      .sort((a, b) => a.order - b.order)[0];

    if (!nextEmail) {
      // Sequence complete
      await this.completeSequenceForLead(lead, sequenceId);
      return { scheduled: false };
    }

    // Check conditions for next email
    const conditionCheck = await this.checkEmailConditions(sequence, lead, nextEmail, currentOrder);
    if (!conditionCheck.send) {
      if (conditionCheck.skipToNext) {
        // Skip this email and try next
        return this.scheduleNextSequenceEmail(sequenceId, leadId, nextEmail.order);
      }
      return { scheduled: false };
    }

    const jobId = await this.scheduleSequenceEmail(sequence, lead, nextEmail);
    return { scheduled: true, jobId };
  }

  /**
   * Check sequence conditions
   */
  private async checkSequenceConditions(
    sequenceId: mongoose.Types.ObjectId,
    leadId: mongoose.Types.ObjectId,
    emailOrder: number
  ): Promise<{ send: boolean; reason?: string }> {
    const sequence = await EmailSequence.findById(sequenceId);
    if (!sequence || sequence.status !== EmailSequenceStatus.ACTIVE) {
      return { send: false, reason: 'Sequence not active' };
    }

    const lead = await Lead.findById(leadId);
    if (!lead || !lead.emailConsent) {
      return { send: false, reason: 'Lead not subscribed' };
    }

    const email = sequence.emails.find(e => e.order === emailOrder);
    if (!email) {
      return { send: false, reason: 'Email not found' };
    }

    // Check email-level conditions
    const conditionCheck = await this.checkEmailConditions(sequence, lead, email, emailOrder - 1);
    return conditionCheck;
  }

  /**
   * Check email-level conditions
   */
  private async checkEmailConditions(
    sequence: IEmailSequence,
    lead: ILead,
    email: ISequenceEmail,
    previousOrder: number
  ): Promise<{ send: boolean; skipToNext?: boolean; reason?: string }> {
    const conditions = email.conditions;

    // Check tag requirements
    if (conditions.requireTag && !lead.tags.includes(conditions.requireTag)) {
      return { send: false, skipToNext: true, reason: `Missing required tag: ${conditions.requireTag}` };
    }

    if (conditions.excludeTag && lead.tags.includes(conditions.excludeTag)) {
      return { send: false, skipToNext: true, reason: `Has excluded tag: ${conditions.excludeTag}` };
    }

    // Check conversion
    if (conditions.skipIfConverted && lead.status === LeadStatus.CONVERTED) {
      return { send: false, reason: 'Lead already converted' };
    }

    // Check previous email engagement (if not first email)
    if (previousOrder >= 0) {
      const previousJob = await EmailQueueJob.findOne({
        sequenceId: sequence._id,
        leadId: lead._id,
        sequenceEmailOrder: previousOrder,
        status: { $in: [EmailJobStatus.SENT, EmailJobStatus.DELIVERED, EmailJobStatus.OPENED, EmailJobStatus.CLICKED] },
      });

      if (conditions.onlyIfOpened && previousJob && !previousJob.openedAt) {
        return { send: false, skipToNext: true, reason: 'Previous email not opened' };
      }

      if (conditions.onlyIfClicked && previousJob && !previousJob.clickedAt) {
        return { send: false, skipToNext: true, reason: 'Previous email not clicked' };
      }
    }

    return { send: true };
  }

  /**
   * Check exit conditions
   */
  private async checkExitConditions(
    sequence: IEmailSequence,
    lead: ILead
  ): Promise<{ shouldExit: boolean; reason?: string }> {
    const exit = sequence.exitConditions;

    // Check purchase exit
    if (exit.onPurchase && lead.status === LeadStatus.CONVERTED) {
      return { shouldExit: true, reason: 'Lead made a purchase' };
    }

    // Check specific purchase
    if (exit.onSpecificPurchase && exit.onSpecificPurchase.length > 0) {
      const purchasedProducts = lead.conversion.purchaseIds || [];
      const hasPurchased = exit.onSpecificPurchase.some(p => purchasedProducts.includes(p));
      if (hasPurchased) {
        return { shouldExit: true, reason: 'Lead purchased specific product' };
      }
    }

    // Check unsubscribe exit
    if (exit.onUnsubscribe && !lead.emailConsent) {
      return { shouldExit: true, reason: 'Lead unsubscribed' };
    }

    // Check tag exit
    if (exit.onTagAdded && lead.tags.includes(exit.onTagAdded)) {
      return { shouldExit: true, reason: `Lead has exit tag: ${exit.onTagAdded}` };
    }

    // Check time-based exit
    if (exit.afterDays) {
      const enrollment = lead.sequences.find(s => s.sequenceId === sequence._id.toString());
      if (enrollment) {
        const daysSinceEnrollment = (Date.now() - enrollment.enrolledAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceEnrollment >= exit.afterDays) {
          return { shouldExit: true, reason: `Time limit exceeded: ${exit.afterDays} days` };
        }
      }
    }

    return { shouldExit: false };
  }

  /**
   * Calculate send time based on email settings
   */
  private calculateSendTime(email: ISequenceEmail, timezone: string): Date {
    const now = new Date();
    let sendTime = new Date(now.getTime() + (email.delayHours * 60 * 60 * 1000));

    if (email.delayDays) {
      sendTime = new Date(sendTime.getTime() + (email.delayDays * 24 * 60 * 60 * 1000));
    }

    if (email.sendTime === SendTimeOption.SCHEDULED && email.scheduledHour !== undefined) {
      // Set to specific time of day
      sendTime.setHours(email.scheduledHour, email.scheduledMinute || 0, 0, 0);

      // If the time has passed today, move to tomorrow
      if (sendTime <= now) {
        sendTime.setDate(sendTime.getDate() + 1);
      }
    }

    return sendTime;
  }

  /**
   * Update lead sequence progress
   */
  private async updateLeadSequenceProgress(
    leadId: mongoose.Types.ObjectId,
    sequenceId: mongoose.Types.ObjectId,
    emailOrder: number
  ): Promise<void> {
    await Lead.updateOne(
      {
        _id: leadId,
        'sequences.sequenceId': sequenceId.toString(),
      },
      {
        $set: { 'sequences.$.currentEmailOrder': emailOrder + 1 },
      }
    );
  }

  /**
   * Exit lead from sequence
   */
  private async exitLeadFromSequence(
    lead: ILead,
    sequenceId: mongoose.Types.ObjectId,
    reason: string
  ): Promise<void> {
    // Update lead
    const sequenceIndex = lead.sequences.findIndex(s => s.sequenceId === sequenceId.toString());
    if (sequenceIndex >= 0) {
      lead.sequences[sequenceIndex].exitedAt = new Date();
      lead.sequences[sequenceIndex].exitReason = reason;
      await lead.save();
    }

    // Cancel pending emails
    await EmailQueueJob.cancelPendingForLead(lead._id, sequenceId);

    // Update sequence metrics
    await EmailSequence.findByIdAndUpdate(sequenceId, {
      $inc: { 'metrics.totalExited': 1 },
    });

    logger.info(`Lead exited from sequence`, {
      leadId: lead._id.toString(),
      sequenceId: sequenceId.toString(),
      reason,
    });
  }

  /**
   * Complete sequence for lead
   */
  private async completeSequenceForLead(
    lead: ILead,
    sequenceId: mongoose.Types.ObjectId
  ): Promise<void> {
    // Update lead
    const sequenceIndex = lead.sequences.findIndex(s => s.sequenceId === sequenceId.toString());
    if (sequenceIndex >= 0) {
      lead.sequences[sequenceIndex].completedAt = new Date();
      await lead.save();
    }

    // Update sequence metrics
    await EmailSequence.findByIdAndUpdate(sequenceId, {
      $inc: { 'metrics.totalCompleted': 1 },
    });

    logger.info(`Lead completed sequence`, {
      leadId: lead._id.toString(),
      sequenceId: sequenceId.toString(),
    });
  }

  /**
   * Check if trigger config matches
   */
  private matchesTriggerConfig(sequence: IEmailSequence, triggerData: Record<string, any>): boolean {
    const config = sequence.triggerConfig;

    if (config.funnelId && triggerData.funnelId !== config.funnelId) {
      return false;
    }

    if (config.challengeId && triggerData.challengeId !== config.challengeId) {
      return false;
    }

    if (config.tagName && triggerData.tagName !== config.tagName) {
      return false;
    }

    return true;
  }

  /**
   * Process pending email jobs
   */
  async processPendingJobs(): Promise<number> {
    const pendingJobs = await EmailQueueJob.findPendingJobs(50);

    for (const job of pendingJobs) {
      // Check if already in queue
      const existingBullJob = job.bullJobId ? await emailQueue.getJob(job.bullJobId) : null;
      if (existingBullJob) {
        continue;
      }

      // Add to queue
      const bullJob = await emailQueue.add({ jobId: job._id.toString(), tenantId: getTenantId() });
      job.bullJobId = bullJob.id.toString();
      await job.save();
    }

    return pendingJobs.length;
  }

  /**
   * Get queue stats
   */
  async getQueueStats(): Promise<{
    email: { waiting: number; active: number; completed: number; failed: number };
    sequence: { waiting: number; active: number; completed: number; failed: number };
  }> {
    const [emailCounts, sequenceCounts] = await Promise.all([
      emailQueue.getJobCounts(),
      sequenceProcessorQueue.getJobCounts(),
    ]);

    return {
      email: emailCounts,
      sequence: sequenceCounts,
    };
  }

  /**
   * Cleanup old completed/failed jobs from the database
   */
  private async cleanupOldJobs(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Delete old completed jobs
    const completedResult = await EmailQueueJob.deleteMany({
      status: { $in: [EmailJobStatus.SENT, EmailJobStatus.DELIVERED, EmailJobStatus.OPENED, EmailJobStatus.CLICKED] },
      createdAt: { $lt: thirtyDaysAgo },
    });

    // Delete old failed jobs
    const failedResult = await EmailQueueJob.deleteMany({
      status: { $in: [EmailJobStatus.FAILED, EmailJobStatus.BOUNCED, EmailJobStatus.CANCELLED, EmailJobStatus.SKIPPED] },
      createdAt: { $lt: thirtyDaysAgo },
    });

    logger.info('Cleanup completed', {
      deletedCompleted: completedResult.deletedCount,
      deletedFailed: failedResult.deletedCount,
    });
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    await emailQueue.close();
    await sequenceProcessorQueue.close();
    logger.info('SequenceScheduler shutdown complete');
  }
}

export const sequenceScheduler = new SequenceSchedulerService();
export default sequenceScheduler;
