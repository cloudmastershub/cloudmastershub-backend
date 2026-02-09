import Bull from 'bull';
import { Workflow, WorkflowStatus, WorkflowTriggerType } from '../models/Workflow';
import {
  WorkflowParticipant,
  WorkflowParticipantStatus,
} from '../models/WorkflowParticipant';
import { workflowEngine } from './workflowEngine';
import { workflowTriggerService } from './workflowTriggerService';
import logger from '../utils/logger';

/**
 * Job types for workflow processing
 */
interface ProcessWaitingJob {
  type: 'process_waiting';
}

interface ExecuteNodeJob {
  type: 'execute_node';
  participantId: string;
}

interface ScheduledTriggerJob {
  type: 'scheduled_trigger';
  workflowId: string;
}

type WorkflowJob = ProcessWaitingJob | ExecuteNodeJob | ScheduledTriggerJob;

/**
 * Workflow Processor
 * Handles background processing of workflows using Bull.js
 */
class WorkflowProcessor {
  private queue: Bull.Queue<WorkflowJob> | null = null;
  private isInitialized = false;

  /**
   * Initialize the workflow processor
   */
  async initialize(redisUrl?: string): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Workflow processor already initialized');
      return;
    }

    try {
      // Create Bull queue
      this.queue = new Bull<WorkflowJob>('workflow-processing', {
        redis: redisUrl || process.env.REDIS_URL || 'redis://localhost:6379',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      });

      // Process jobs
      this.queue.process(async (job) => {
        return this.processJob(job.data);
      });

      // Event handlers
      this.queue.on('completed', (job) => {
        logger.debug(`Workflow job ${job.id} completed`);
      });

      this.queue.on('failed', (job, error) => {
        logger.error(`Workflow job ${job?.id} failed:`, error);
      });

      // Schedule recurring job for processing waiting participants
      await this.queue.add(
        { type: 'process_waiting' },
        {
          repeat: { every: 60000 }, // Every minute
          jobId: 'process-waiting-participants',
        }
      );

      // Initialize scheduled workflow triggers
      await this.initializeScheduledTriggers();

      // Initialize workflow trigger service (Bull queue for distributed triggers)
      await workflowTriggerService.initialize();

      this.isInitialized = true;
      logger.info('Workflow processor initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize workflow processor:', error);
      throw error;
    }
  }

  /**
   * Process a workflow job
   */
  private async processJob(data: WorkflowJob): Promise<any> {
    switch (data.type) {
      case 'process_waiting':
        return this.processWaitingParticipants();

      case 'execute_node':
        return this.executeParticipantNode(data.participantId);

      case 'scheduled_trigger':
        return this.processScheduledTrigger(data.workflowId);

      default:
        logger.warn(`Unknown job type: ${(data as any).type}`);
    }
  }

  /**
   * Process waiting participants
   */
  private async processWaitingParticipants(): Promise<number> {
    try {
      const processed = await workflowEngine.processWaitingParticipants();
      if (processed > 0) {
        logger.info(`Processed ${processed} waiting participants`);
      }
      return processed;
    } catch (error) {
      logger.error('Error processing waiting participants:', error);
      throw error;
    }
  }

  /**
   * Execute a specific participant's next node
   */
  private async executeParticipantNode(participantId: string): Promise<void> {
    try {
      await workflowEngine.executeNextNode(participantId);
    } catch (error) {
      logger.error(`Error executing node for participant ${participantId}:`, error);
      throw error;
    }
  }

  /**
   * Process a scheduled workflow trigger
   */
  private async processScheduledTrigger(workflowId: string): Promise<void> {
    try {
      const workflow = await Workflow.findById(workflowId);

      if (!workflow || workflow.status !== WorkflowStatus.ACTIVE) {
        logger.debug(`Skipping scheduled trigger for inactive workflow ${workflowId}`);
        return;
      }

      // For scheduled workflows, we need to identify which leads to enroll
      // This could be based on a segment or query defined in the trigger config
      const { config } = workflow.trigger;

      logger.info(`Processing scheduled trigger for workflow: ${workflow.name}`);

      // If segment is specified, enroll all leads in segment
      if (config.segmentId) {
        // TODO: Get leads from segment and enroll each
        logger.info(`Would enroll leads from segment ${config.segmentId}`);
      }
    } catch (error) {
      logger.error(`Error processing scheduled trigger for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Initialize scheduled workflow triggers
   */
  private async initializeScheduledTriggers(): Promise<void> {
    try {
      // Find all active scheduled workflows
      const scheduledWorkflows = await Workflow.find({
        'trigger.type': WorkflowTriggerType.SCHEDULED,
        status: WorkflowStatus.ACTIVE,
      });

      for (const workflow of scheduledWorkflows) {
        const schedule = workflow.trigger.config.schedule;
        if (schedule) {
          await this.scheduleWorkflow(workflow._id.toString(), schedule);
        }
      }

      logger.info(`Initialized ${scheduledWorkflows.length} scheduled workflow triggers`);
    } catch (error) {
      logger.error('Error initializing scheduled triggers:', error);
    }
  }

  /**
   * Schedule a workflow to run on a cron schedule
   */
  async scheduleWorkflow(workflowId: string, cronExpression: string): Promise<void> {
    if (!this.queue) {
      throw new Error('Workflow processor not initialized');
    }

    const jobId = `scheduled-${workflowId}`;

    // Remove existing job if any
    const existingJob = await this.queue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }

    // Add new scheduled job
    await this.queue.add(
      { type: 'scheduled_trigger', workflowId },
      {
        repeat: { cron: cronExpression },
        jobId,
      }
    );

    logger.info(`Scheduled workflow ${workflowId} with cron: ${cronExpression}`);
  }

  /**
   * Remove a scheduled workflow
   */
  async unscheduleWorkflow(workflowId: string): Promise<void> {
    if (!this.queue) {
      return;
    }

    const jobId = `scheduled-${workflowId}`;
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info(`Unscheduled workflow ${workflowId}`);
    }
  }

  /**
   * Queue a node execution job
   */
  async queueNodeExecution(participantId: string, delay?: number): Promise<void> {
    if (!this.queue) {
      // If queue not available, execute directly
      await workflowEngine.executeNextNode(participantId);
      return;
    }

    const options: Bull.JobOptions = {};
    if (delay) {
      options.delay = delay;
    }

    await this.queue.add({ type: 'execute_node', participantId }, options);
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.queue) {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }

    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting,
      active: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      delayed: counts.delayed,
    };
  }

  /**
   * Shutdown the processor
   */
  async shutdown(): Promise<void> {
    // Shutdown trigger service first (it depends on this processor for execution queueing)
    await workflowTriggerService.shutdown();

    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    this.isInitialized = false;
    logger.info('Workflow processor shut down');
  }
}

export const workflowProcessor = new WorkflowProcessor();
export default workflowProcessor;
