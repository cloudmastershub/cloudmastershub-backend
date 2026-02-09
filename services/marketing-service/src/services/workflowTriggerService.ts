import Queue from 'bull';
import {
  Workflow,
  IWorkflow,
  WorkflowStatus,
  WorkflowTriggerType,
  WorkflowNodeType,
} from '../models/Workflow';
import {
  WorkflowParticipant,
  WorkflowParticipantStatus,
} from '../models/WorkflowParticipant';
import { Lead, ILead } from '../models/Lead';
import { workflowEngine } from './workflowEngine';
import logger from '../utils/logger';
import { getTenantId, runWithTenant, DEFAULT_TENANT } from '../utils/tenantContext';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Event types for workflow triggers
 */
export interface TriggerEvent {
  tenantId: string;
  type: WorkflowTriggerType;
  leadId: string;
  data: Record<string, any>;
  timestamp: Date;
}

/**
 * Workflow Trigger Service
 *
 * Distributes workflow trigger events via a Bull queue for multi-pod safety.
 *
 * Previous implementation used Node.js EventEmitter, which is local to a single
 * process — triggers fired on Pod A were invisible to Pod B, causing silent
 * failures when workflows needed to be evaluated.
 *
 * This version uses a Bull queue ('workflow-triggers'):
 * - trigger() adds a job to the Bull queue
 * - Any pod's worker picks up the job and processes it
 * - Bull provides durability (jobs survive pod restarts) and retry
 * - Enrollment dedup is handled at the business logic level (existing participant checks)
 * - Workflow execution after enrollment uses the workflow-processing Bull queue
 */
class WorkflowTriggerService {
  private queue: Queue.Queue | null = null;
  private isInitialized = false;

  /**
   * Initialize the trigger service with a Bull queue
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Workflow trigger service already initialized');
      return;
    }

    this.queue = new Queue('workflow-triggers', REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });

    // Worker: process trigger events (concurrency 5)
    this.queue.process(5, async (job) => {
      const event = job.data as TriggerEvent;
      // Deserialize timestamp (Bull serializes Date as string)
      event.timestamp = new Date(event.timestamp);

      const resolvedTenant = event.tenantId || DEFAULT_TENANT;
      if (!event.tenantId) {
        logger.warn('Workflow trigger job missing tenantId, using default', { jobId: job.id, type: event.type, leadId: event.leadId });
      }

      return runWithTenant(resolvedTenant, async () => {
        await this.handleTrigger(event);
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Workflow trigger job failed: ${job.id}`, {
        type: (job.data as TriggerEvent).type,
        leadId: (job.data as TriggerEvent).leadId,
        error: err.message,
      });
    });

    this.isInitialized = true;
    logger.info('Workflow trigger service initialized (Bull queue: workflow-triggers)');
  }

  /**
   * Handle a trigger event — finds matching workflows and enrolls the lead.
   */
  private async handleTrigger(event: TriggerEvent): Promise<void> {
    try {
      logger.debug(`Processing trigger event: ${event.type} for lead ${event.leadId}`);

      // Find active workflows with matching trigger
      const workflows = await this.findMatchingWorkflows(event);

      if (workflows.length === 0) {
        logger.debug(`No matching workflows for trigger ${event.type}`);
        return;
      }

      logger.info(`Found ${workflows.length} matching workflows for trigger ${event.type}`, {
        leadId: event.leadId,
        workflows: workflows.map(w => w.name),
      });

      // Enroll lead in each matching workflow
      for (const workflow of workflows) {
        try {
          await this.enrollLeadInWorkflow(workflow, event.leadId, event.data);
        } catch (error) {
          logger.error(`Error enrolling lead ${event.leadId} in workflow ${workflow.id}:`, error);
        }
      }
    } catch (error) {
      logger.error(`Error handling trigger event:`, error);
      throw error; // Let Bull retry
    }
  }

  /**
   * Find workflows matching the trigger event
   */
  private async findMatchingWorkflows(event: TriggerEvent): Promise<IWorkflow[]> {
    const query: any = {
      'trigger.type': event.type,
      status: WorkflowStatus.ACTIVE,
    };

    // Add trigger-specific filters
    switch (event.type) {
      case WorkflowTriggerType.TAG_ADDED:
      case WorkflowTriggerType.TAG_REMOVED:
        if (event.data.tagName) {
          query['trigger.config.tagName'] = event.data.tagName;
        }
        break;

      case WorkflowTriggerType.SCORE_CHANGED:
        // Will check threshold in code
        break;

      case WorkflowTriggerType.EMAIL_OPENED:
      case WorkflowTriggerType.EMAIL_CLICKED:
        if (event.data.templateId) {
          query['trigger.config.emailTemplateId'] = event.data.templateId;
        }
        if (event.data.campaignId) {
          query['trigger.config.campaignId'] = event.data.campaignId;
        }
        break;

      case WorkflowTriggerType.PAGE_VISITED:
        // Will check URL pattern in code
        break;

      case WorkflowTriggerType.FORM_SUBMITTED:
        if (event.data.formId) {
          query['trigger.config.formId'] = event.data.formId;
        }
        break;

      case WorkflowTriggerType.PURCHASE_MADE:
        if (event.data.productId) {
          query['trigger.config.productId'] = event.data.productId;
        }
        break;

      case WorkflowTriggerType.FUNNEL_STEP_COMPLETED:
        if (event.data.funnelId) {
          query['trigger.config.funnelId'] = event.data.funnelId;
        }
        if (event.data.stepId) {
          query['trigger.config.stepId'] = event.data.stepId;
        }
        break;

      case WorkflowTriggerType.CHALLENGE_DAY_COMPLETED:
        if (event.data.challengeId) {
          query['trigger.config.challengeId'] = event.data.challengeId;
        }
        if (event.data.dayNumber) {
          query['trigger.config.dayNumber'] = event.data.dayNumber;
        }
        break;

      case WorkflowTriggerType.CUSTOM_EVENT:
        if (event.data.eventName) {
          query['trigger.config.eventName'] = event.data.eventName;
        }
        break;
    }

    const workflows = await Workflow.find(query);

    // Additional filtering based on trigger config
    return workflows.filter((workflow: IWorkflow) => {
      const config = workflow.trigger.config;

      // Score threshold check
      if (event.type === WorkflowTriggerType.SCORE_CHANGED && config.scoreThreshold !== undefined) {
        const { oldScore, newScore } = event.data;
        const threshold = config.scoreThreshold;

        switch (config.scoreDirection) {
          case 'above':
            return newScore >= threshold && (oldScore === undefined || oldScore < threshold);
          case 'below':
            return newScore < threshold && (oldScore === undefined || oldScore >= threshold);
          case 'crosses':
            return (newScore >= threshold && oldScore < threshold) ||
                   (newScore < threshold && oldScore >= threshold);
          default:
            return true;
        }
      }

      // Page URL pattern check
      if (event.type === WorkflowTriggerType.PAGE_VISITED && config.pageUrlPattern) {
        const pattern = new RegExp(
          config.pageUrlPattern.replace(/\*/g, '.*'),
          'i'
        );
        return pattern.test(event.data.pageUrl);
      }

      // Minimum purchase amount check
      if (event.type === WorkflowTriggerType.PURCHASE_MADE && config.minAmount) {
        return event.data.amount >= config.minAmount;
      }

      return true;
    });
  }

  /**
   * Enroll a lead in a workflow
   */
  private async enrollLeadInWorkflow(
    workflow: IWorkflow,
    leadId: string,
    triggerData: Record<string, any>
  ): Promise<void> {
    const lead = await Lead.findById(leadId);
    if (!lead) {
      logger.warn(`Lead ${leadId} not found, skipping enrollment`);
      return;
    }

    // Check if lead is already in workflow
    const existingParticipant = await WorkflowParticipant.findOne({
      workflowId: workflow._id,
      leadId,
      status: { $in: [WorkflowParticipantStatus.ACTIVE, WorkflowParticipantStatus.WAITING] },
    });

    if (existingParticipant) {
      if (!workflow.settings.allowReentry) {
        logger.debug(`Lead ${leadId} already in workflow ${workflow.id}, skipping`);
        return;
      }

      // Check re-entry delay
      if (workflow.settings.reentryDelay) {
        const lastEntry = await WorkflowParticipant.findOne({
          workflowId: workflow._id,
          leadId,
        }).sort({ enteredAt: -1 });

        if (lastEntry) {
          const daysSinceLastEntry = (Date.now() - lastEntry.enteredAt.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastEntry < workflow.settings.reentryDelay) {
            logger.debug(`Lead ${leadId} must wait ${workflow.settings.reentryDelay} days before re-entering`);
            return;
          }
        }
      }

      // Check max enrollments
      if (workflow.settings.maxEnrollments) {
        const enrollmentCount = await WorkflowParticipant.countDocuments({
          workflowId: workflow._id,
          leadId,
        });
        if (enrollmentCount >= workflow.settings.maxEnrollments) {
          logger.debug(`Lead ${leadId} has reached max enrollments for workflow ${workflow.id}`);
          return;
        }
      }
    }

    // Find trigger node
    const triggerNode = workflow.nodes.find(n => n.type === WorkflowNodeType.TRIGGER);
    if (!triggerNode) {
      logger.error(`Workflow ${workflow.id} has no trigger node`);
      return;
    }

    // Get first action node (node after trigger)
    const firstEdge = workflow.edges.find(e => e.source === triggerNode.id);
    const firstNodeId = firstEdge?.target || triggerNode.id;

    // Create participant
    const enrollmentCount = existingParticipant
      ? (await WorkflowParticipant.countDocuments({ workflowId: workflow._id, leadId })) + 1
      : 1;

    const participant = new WorkflowParticipant({
      workflowId: workflow._id,
      leadId,
      status: WorkflowParticipantStatus.ACTIVE,
      currentNodeId: firstNodeId,
      enteredAt: new Date(),
      triggerData,
      enrollmentCount,
      log: [{
        nodeId: triggerNode.id,
        nodeType: triggerNode.type,
        nodeName: triggerNode.name,
        action: 'entered',
        timestamp: new Date(),
        metadata: triggerData,
      }],
    });

    await participant.save();

    // Update workflow metrics
    await Workflow.findByIdAndUpdate(workflow._id, {
      $inc: { 'metrics.totalEntered': 1, 'metrics.currentlyActive': 1 },
    });

    logger.info(`Lead ${lead.email} enrolled in workflow ${workflow.name}`, {
      workflowId: workflow._id.toString(),
      participantId: participant.id,
    });

    // Queue workflow execution via workflowProcessor's Bull queue (durable, survives pod restart)
    // Lazy import to avoid circular dependency (workflowProcessor imports this service)
    try {
      const processor = require('./workflowProcessor').workflowProcessor;
      await processor.queueNodeExecution(participant.id);
    } catch (error) {
      // Fallback to direct execution if queue unavailable
      logger.warn('Failed to queue workflow execution, executing directly', {
        participantId: participant.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      try {
        await workflowEngine.executeNextNode(participant.id);
      } catch (execError) {
        logger.error(`Error starting workflow execution for participant ${participant.id}:`, execError);
      }
    }
  }

  /**
   * Dispatch a trigger event via Bull queue — called by other services when events occur
   */
  trigger(type: WorkflowTriggerType, leadId: string, data: Record<string, any> = {}): void {
    const event: TriggerEvent = {
      tenantId: getTenantId(),
      type,
      leadId,
      data,
      timestamp: new Date(),
    };

    if (!this.queue) {
      logger.warn('Workflow trigger service not initialized, dropping event', { type, leadId });
      return;
    }

    logger.debug(`Dispatching trigger event: ${type} for lead ${leadId}`);

    this.queue.add(event).catch((err) => {
      logger.error('Failed to enqueue workflow trigger', {
        type,
        leadId,
        error: err.message,
      });
    });
  }

  /**
   * Convenience methods for common triggers
   */

  onLeadCreated(leadId: string, data: Record<string, any> = {}): void {
    this.trigger(WorkflowTriggerType.LEAD_CREATED, leadId, data);
  }

  onTagAdded(leadId: string, tagName: string, data: Record<string, any> = {}): void {
    this.trigger(WorkflowTriggerType.TAG_ADDED, leadId, { ...data, tagName });
  }

  onTagRemoved(leadId: string, tagName: string, data: Record<string, any> = {}): void {
    this.trigger(WorkflowTriggerType.TAG_REMOVED, leadId, { ...data, tagName });
  }

  onScoreChanged(leadId: string, oldScore: number, newScore: number): void {
    this.trigger(WorkflowTriggerType.SCORE_CHANGED, leadId, { oldScore, newScore });
  }

  onEmailOpened(leadId: string, templateId?: string, campaignId?: string): void {
    this.trigger(WorkflowTriggerType.EMAIL_OPENED, leadId, { templateId, campaignId });
  }

  onEmailClicked(leadId: string, templateId?: string, campaignId?: string, linkUrl?: string): void {
    this.trigger(WorkflowTriggerType.EMAIL_CLICKED, leadId, { templateId, campaignId, linkUrl });
  }

  onPageVisited(leadId: string, pageUrl: string): void {
    this.trigger(WorkflowTriggerType.PAGE_VISITED, leadId, { pageUrl });
  }

  onFormSubmitted(leadId: string, formId: string, formData: Record<string, any> = {}): void {
    this.trigger(WorkflowTriggerType.FORM_SUBMITTED, leadId, { formId, formData });
  }

  onPurchaseMade(leadId: string, productId: string, amount: number, data: Record<string, any> = {}): void {
    this.trigger(WorkflowTriggerType.PURCHASE_MADE, leadId, { ...data, productId, amount });
  }

  onFunnelStepCompleted(leadId: string, funnelId: string, stepId: string): void {
    this.trigger(WorkflowTriggerType.FUNNEL_STEP_COMPLETED, leadId, { funnelId, stepId });
  }

  onChallengeDayCompleted(leadId: string, challengeId: string, dayNumber: number): void {
    this.trigger(WorkflowTriggerType.CHALLENGE_DAY_COMPLETED, leadId, { challengeId, dayNumber });
  }

  onCustomEvent(leadId: string, eventName: string, data: Record<string, any> = {}): void {
    this.trigger(WorkflowTriggerType.CUSTOM_EVENT, leadId, { ...data, eventName });
  }

  /**
   * Shutdown the trigger service
   */
  async shutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    this.isInitialized = false;
    logger.info('Workflow trigger service shut down');
  }
}

export const workflowTriggerService = new WorkflowTriggerService();
export default workflowTriggerService;
