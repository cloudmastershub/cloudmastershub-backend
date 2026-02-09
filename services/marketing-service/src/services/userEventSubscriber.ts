import { createClient } from 'redis';
import Queue from 'bull';
import emailService from './emailService';
import { sequenceScheduler } from './sequenceScheduler';
import { SequenceTrigger } from '../models/EmailSequence';
import { Lead, LeadStatus } from '../models';
import logger from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CHANNEL = 'user.signed_up';

interface SignupPayload {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  timestamp: string;
}

/**
 * UserEventSubscriber
 *
 * Listens to the 'user.signed_up' Redis pub/sub channel published by the
 * user-service when a new user registers via Google OAuth.
 *
 * Uses the same Bull-dedup pattern as PaymentEventSubscriber:
 * - Both marketing pods receive the pub/sub event
 * - Both enqueue a Bull job with deterministic ID: signup:{user_id}
 * - Bull atomic SET NX ensures only one job is created
 * - Worker creates/updates the lead and sends the welcome email
 *
 * Idempotency layers:
 * 1. Bull jobId 'signup:{user_id}' — no timestamp, so one job per user EVER
 * 2. Lead tag 'welcome-email-sent' — defense-in-depth check before sending
 */
class UserEventSubscriber {
  private subscriber: ReturnType<typeof createClient> | null = null;
  private queue: Queue.Queue | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    this.subscriber = createClient({ url: REDIS_URL });

    this.subscriber.on('error', (err) => {
      logger.error('UserEventSubscriber Redis error', { error: err.message });
    });

    await this.subscriber.connect();

    // Bull queue for dedup + reliable processing
    this.queue = new Queue('user-signup-emails', REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });

    this.setupWorker();

    await this.subscriber.subscribe(CHANNEL, (message) => {
      this.handleEvent(message);
    });

    this.isInitialized = true;
    logger.info('UserEventSubscriber initialized', { channel: CHANNEL });
  }

  /**
   * Handle an incoming user.signed_up event from Redis pub/sub.
   */
  private async handleEvent(raw: string): Promise<void> {
    let payload: SignupPayload;
    try {
      payload = JSON.parse(raw);
    } catch {
      logger.warn('Malformed user signup event, skipping', { raw: raw.substring(0, 200) });
      return;
    }

    if (!payload.user_id || !payload.email) {
      logger.warn('User signup event missing required fields, skipping', { payload });
      return;
    }

    // Deterministic job ID: one per user, ever.
    // No timestamp component — ensures a user can only have ONE welcome email job.
    const jobId = `signup:${payload.user_id}`;

    try {
      await this.queue!.add(payload, { jobId });
      logger.info('User signup event enqueued', {
        userId: payload.user_id,
        email: payload.email,
        jobId,
      });
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        logger.debug('Duplicate signup event deduplicated', { jobId });
      } else {
        logger.error('Failed to enqueue user signup event', {
          userId: payload.user_id,
          error: err.message,
        });
      }
    }
  }

  /**
   * Bull worker: creates/updates lead, checks idempotency, sends welcome email.
   */
  private setupWorker(): void {
    this.queue!.process(async (job) => {
      const { user_id, email, first_name, last_name } = job.data as SignupPayload;

      logger.info('Processing user signup welcome email', { userId: user_id, email });

      // Upsert lead in marketing database
      let lead = await Lead.findOne({ email: email.toLowerCase() });

      if (lead) {
        // Defense-in-depth: check if welcome email was already sent
        if (lead.tags?.includes('welcome-email-sent')) {
          logger.info('Welcome email already sent (lead tag check), skipping', {
            userId: user_id,
            email,
          });
          return { success: true, reason: 'already_sent' };
        }

        // Update existing lead with user ID (they may have been a lead before signing up)
        lead.conversion = lead.conversion || {} as any;
        lead.conversion.userId = user_id;
        lead.conversion.convertedAt = new Date();
        lead.status = LeadStatus.CONVERTED;
        if (first_name && !lead.firstName) lead.firstName = first_name;
        if (last_name && !lead.lastName) lead.lastName = last_name;
      } else {
        // Create new lead from signup
        lead = new Lead({
          email: email.toLowerCase(),
          firstName: first_name || undefined,
          lastName: last_name || undefined,
          source: { type: 'direct' },
          status: LeadStatus.CONVERTED,
          score: 10,
          scoreLevel: 'cold',
          tags: [],
          emailConsent: true,
          emailConsentAt: new Date(),
          conversion: {
            userId: user_id,
            convertedAt: new Date(),
          },
          capturedAt: new Date(),
        });
      }

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(email, first_name || undefined);

        // Mark lead as welcome-email-sent (idempotency tag)
        if (!lead.tags) lead.tags = [];
        lead.tags.push('welcome-email-sent');
        lead.email_engagement = lead.email_engagement || {
          emailsReceived: 0,
          emailsOpened: 0,
          emailsClicked: 0,
          openRate: 0,
          clickRate: 0,
        };
        lead.email_engagement.emailsReceived += 1;
        lead.email_engagement.lastEmailReceivedAt = new Date();

        await lead.save();

        logger.info('Welcome email sent and lead updated', {
          userId: user_id,
          email,
          leadId: lead._id.toString(),
        });

        // Trigger nurture sequence (welcome-email-sent tag was just added)
        try {
          const triggerResult = await sequenceScheduler.triggerSequence(
            SequenceTrigger.TAG_ADDED,
            lead._id,
            { tagName: 'welcome-email-sent', firstName: first_name, email }
          );
          if (triggerResult.enrolled.length > 0) {
            logger.info('Triggered nurture sequence after welcome email', {
              leadId: lead._id.toString(),
              sequences: triggerResult.enrolled,
            });
          }
        } catch (seqErr: any) {
          logger.warn('Failed to trigger nurture sequence', { error: seqErr.message });
        }

        return { success: true };
      } catch (err: any) {
        // Save lead even if email fails (lead data is valuable)
        try {
          await lead.save();
        } catch (saveErr: any) {
          logger.error('Failed to save lead after email error', {
            userId: user_id,
            error: saveErr.message,
          });
        }

        logger.error('Failed to send welcome email', {
          userId: user_id,
          email,
          error: err.message,
        });
        throw err; // let Bull retry
      }
    });

    this.queue!.on('failed', (job, err) => {
      logger.error(`User signup email job failed: ${job.id}`, { error: err.message });
    });
  }

  async shutdown(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    this.isInitialized = false;
    logger.info('UserEventSubscriber shutdown complete');
  }
}

export const userEventSubscriber = new UserEventSubscriber();
export default userEventSubscriber;
