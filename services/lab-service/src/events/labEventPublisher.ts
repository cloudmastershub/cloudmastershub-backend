import { v4 as uuidv4 } from 'uuid';
import { LabEvent, EventPriority } from '@cloudmastershub/types';
import { getEventBus } from '@cloudmastershub/utils';
import logger from '../utils/logger';

export class LabEventPublisher {
  private eventBus = getEventBus();

  // Lab Management Events
  async publishLabCreated(labId: string, labData: {
    title: string;
    type: 'aws' | 'azure' | 'gcp';
    difficulty: string;
    duration: number;
    instructorId: string;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.created',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        instructorId: labData.instructorId
      },
      labId,
      instructorId: labData.instructorId,
      data: {
        title: labData.title,
        type: labData.type,
        difficulty: labData.difficulty,
        duration: labData.duration,
        status: 'draft'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.created event', { labId, eventId: event.id, instructorId: labData.instructorId });
  }

  async publishLabUpdated(labId: string, updates: {
    title?: string;
    type?: 'aws' | 'azure' | 'gcp';
    difficulty?: string;
    duration?: number;
    status?: string;
    previousStatus?: string;
  }, instructorId?: string): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.updated',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        instructorId,
        updatedFields: Object.keys(updates)
      },
      labId,
      instructorId,
      data: updates
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.updated event', { labId, eventId: event.id, updates: Object.keys(updates) });
  }

  async publishLabDeleted(labId: string, instructorId: string, reason?: string): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.deleted',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        instructorId,
        adminAction: true
      },
      labId,
      instructorId,
      data: {
        deletedAt: new Date().toISOString(),
        reason
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.warn('Published lab.deleted event', { labId, eventId: event.id, instructorId, reason });
  }

  async publishLabPublished(labId: string, instructorId: string): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.published',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        instructorId,
        contentModeration: true
      },
      labId,
      instructorId,
      data: {
        status: 'published',
        previousStatus: 'draft',
        publishedAt: new Date().toISOString()
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.published event', { labId, eventId: event.id, instructorId });
  }

  // Lab Session Events
  async publishLabSessionStarted(labId: string, userId: string, sessionData: {
    sessionId: string;
    cloudProvider: 'aws' | 'azure' | 'gcp';
    region: string;
    environmentId?: string;
    resources?: string[];
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.session.started',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: sessionData.sessionId,
        cloudProvider: sessionData.cloudProvider
      },
      labId,
      userId,
      sessionId: sessionData.sessionId,
      data: {
        cloudProvider: sessionData.cloudProvider,
        region: sessionData.region,
        environmentId: sessionData.environmentId,
        resources: sessionData.resources,
        startedAt: new Date().toISOString(),
        status: 'running'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published lab.session.started event', { 
      labId, userId, sessionId: sessionData.sessionId, eventId: event.id 
    });
  }

  async publishLabSessionStopped(labId: string, userId: string, sessionData: {
    sessionId: string;
    sessionDuration: number;
    reason?: string;
    cost?: number;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.session.stopped',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: sessionData.sessionId
      },
      labId,
      userId,
      sessionId: sessionData.sessionId,
      data: {
        sessionDuration: sessionData.sessionDuration,
        stoppedAt: new Date().toISOString(),
        reason: sessionData.reason,
        cost: sessionData.cost,
        status: 'stopped'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.session.stopped event', { 
      labId, userId, sessionId: sessionData.sessionId, duration: sessionData.sessionDuration, eventId: event.id 
    });
  }

  async publishLabSessionCompleted(labId: string, userId: string, sessionData: {
    sessionId: string;
    sessionDuration: number;
    solutionScore?: number;
    cost?: number;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.session.completed',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: sessionData.sessionId,
        labCompleted: true
      },
      labId,
      userId,
      sessionId: sessionData.sessionId,
      data: {
        sessionDuration: sessionData.sessionDuration,
        solutionScore: sessionData.solutionScore,
        completedAt: new Date().toISOString(),
        cost: sessionData.cost,
        status: 'completed'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.info('Published lab.session.completed event', { 
      labId, userId, sessionId: sessionData.sessionId, score: sessionData.solutionScore, eventId: event.id 
    });
  }

  async publishLabSessionFailed(labId: string, userId: string, sessionData: {
    sessionId: string;
    sessionDuration: number;
    errorMessage: string;
    cost?: number;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.session.failed',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: sessionData.sessionId,
        errorOccurred: true
      },
      labId,
      userId,
      sessionId: sessionData.sessionId,
      data: {
        sessionDuration: sessionData.sessionDuration,
        errorMessage: sessionData.errorMessage,
        failedAt: new Date().toISOString(),
        cost: sessionData.cost,
        status: 'failed'
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.HIGH });
    logger.error('Published lab.session.failed event', { 
      labId, userId, sessionId: sessionData.sessionId, error: sessionData.errorMessage, eventId: event.id 
    });
  }

  // Lab Solution Events
  async publishLabSolutionSubmitted(labId: string, userId: string, solutionData: {
    sessionId: string;
    solutionId: string;
    submissionTime: number;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.solution.submitted',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: solutionData.sessionId,
        solutionId: solutionData.solutionId
      },
      labId,
      userId,
      sessionId: solutionData.sessionId,
      data: {
        solutionId: solutionData.solutionId,
        submittedAt: new Date().toISOString(),
        submissionTime: solutionData.submissionTime
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.solution.submitted event', { 
      labId, userId, sessionId: solutionData.sessionId, solutionId: solutionData.solutionId, eventId: event.id 
    });
  }

  async publishLabSolutionGraded(labId: string, userId: string, gradingData: {
    sessionId: string;
    solutionId: string;
    score: number;
    maxScore: number;
    feedback?: string;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.solution.graded',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: gradingData.sessionId,
        solutionId: gradingData.solutionId,
        autoGraded: true
      },
      labId,
      userId,
      sessionId: gradingData.sessionId,
      data: {
        solutionId: gradingData.solutionId,
        solutionScore: gradingData.score,
        maxScore: gradingData.maxScore,
        feedback: gradingData.feedback,
        gradedAt: new Date().toISOString(),
        passed: gradingData.score >= (gradingData.maxScore * 0.7) // 70% passing threshold
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.solution.graded event', { 
      labId, userId, score: gradingData.score, maxScore: gradingData.maxScore, eventId: event.id 
    });
  }

  // Lab Environment Events
  async publishLabEnvironmentProvisioned(labId: string, userId: string, environmentData: {
    sessionId: string;
    environmentId: string;
    cloudProvider: 'aws' | 'azure' | 'gcp';
    region: string;
    resources: string[];
    provisioningTime: number;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.environment.provisioned',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: environmentData.sessionId,
        environmentId: environmentData.environmentId,
        cloudProvider: environmentData.cloudProvider
      },
      labId,
      userId,
      sessionId: environmentData.sessionId,
      data: {
        environmentId: environmentData.environmentId,
        cloudProvider: environmentData.cloudProvider,
        region: environmentData.region,
        resources: environmentData.resources,
        provisionedAt: new Date().toISOString(),
        provisioningTime: environmentData.provisioningTime
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.environment.provisioned event', { 
      labId, userId, environmentId: environmentData.environmentId, 
      provisioningTime: environmentData.provisioningTime, eventId: event.id 
    });
  }

  async publishLabEnvironmentDestroyed(labId: string, userId: string, environmentData: {
    sessionId: string;
    environmentId: string;
    destructionTime: number;
    cost?: number;
    reason?: string;
  }): Promise<void> {
    const event: LabEvent = {
      id: uuidv4(),
      type: 'lab.environment.destroyed',
      version: '1.0',
      timestamp: new Date(),
      source: 'lab-service',
      correlationId: uuidv4(),
      metadata: {
        serviceName: 'lab-service',
        labId,
        userId,
        sessionId: environmentData.sessionId,
        environmentId: environmentData.environmentId
      },
      labId,
      userId,
      sessionId: environmentData.sessionId,
      data: {
        environmentId: environmentData.environmentId,
        destroyedAt: new Date().toISOString(),
        destructionTime: environmentData.destructionTime,
        cost: environmentData.cost,
        reason: environmentData.reason
      }
    };

    await this.eventBus.publish(event, { priority: EventPriority.MEDIUM });
    logger.info('Published lab.environment.destroyed event', { 
      labId, userId, environmentId: environmentData.environmentId, cost: environmentData.cost, eventId: event.id 
    });
  }
}

// Singleton instance
let labEventPublisher: LabEventPublisher | null = null;

export const getLabEventPublisher = (): LabEventPublisher => {
  if (!labEventPublisher) {
    labEventPublisher = new LabEventPublisher();
  }
  return labEventPublisher;
};