import { Request, Response, NextFunction } from 'express';
import { labQueue } from '../services/queueService';
import logger from '../utils/logger';
import { getLabEventPublisher } from '../events/labEventPublisher';
import LabSession from '../models/LabSession';
import Lab from '../models/Lab';

export const startLabSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { labId, userId } = req.body;

    // TODO: Validate user has access to lab
    // TODO: Check resource availability

    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add to queue for provisioning
    await labQueue.add('provision-lab', {
      sessionId,
      labId,
      userId,
      startedAt: new Date(),
    });

    logger.info(`Starting lab session ${sessionId} for user ${userId}`);

    // Publish lab session started event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabSessionStarted(labId, userId, {
      sessionId,
      cloudProvider: 'aws', // TODO: Get from lab configuration
      region: 'us-east-1', // TODO: Get from lab configuration
      environmentId: `env-${sessionId}`,
      resources: ['ec2-instance'] // TODO: Get from lab configuration
    });

    res.json({
      success: true,
      data: {
        sessionId,
        status: 'provisioning',
        message: 'Lab environment is being prepared',
        estimatedTime: 60, // seconds
      },
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to get resource display name
function getResourceDisplayName(type: string): string {
  const names: Record<string, string> = {
    'ec2-instance': 'EC2 Instance',
    's3-bucket': 'S3 Bucket',
    'vpc': 'VPC Network',
    'rds-instance': 'RDS Database',
    'lambda-function': 'Lambda Function',
    'iam-role': 'IAM Role',
    'security-group': 'Security Group',
    'elastic-ip': 'Elastic IP',
    'load-balancer': 'Load Balancer',
    'ecs-cluster': 'ECS Cluster'
  };
  return names[type] || type;
}

export const getSessionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Fetch session from database
    const session = await LabSession.findOne({ sessionId }).lean();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
      return;
    }

    // Get lab details to calculate time remaining
    const lab = await Lab.findById(session.labId).lean();

    // Calculate time remaining
    const elapsed = Date.now() - new Date(session.startTime).getTime();
    const timeLimit = (lab?.resources?.timeLimit || 60) * 60 * 1000; // Convert minutes to ms
    const timeRemaining = Math.max(0, Math.floor((timeLimit - elapsed) / 1000)); // In seconds

    // Map status from model to API response
    const statusMap: Record<string, string> = {
      'pending': 'provisioning',
      'provisioning': 'provisioning',
      'active': 'running',
      'completed': 'stopped',
      'failed': 'error',
      'terminated': 'stopped'
    };

    const response = {
      sessionId: session.sessionId,
      status: statusMap[session.status] || session.status,
      labId: session.labId,
      userId: session.userId,
      startedAt: session.startTime,
      environment: {
        provider: session.environment?.provider,
        region: session.environment?.region,
        consoleUrl: session.environment?.connectionDetails?.url,
        credentials: session.environment?.connectionDetails?.credentials ? {
          accessKeyId: session.environment.connectionDetails.credentials.username,
          region: session.environment?.region
        } : undefined,
        publicIp: session.environment?.publicIp,
        connectionDetails: session.environment?.connectionDetails
      },
      resources: session.resources.map(r => ({
        id: r.id,
        type: r.type,
        name: getResourceDisplayName(r.type),
        status: r.status,
        details: r.metadata
      })),
      progress: session.progress,
      timeRemaining,
      estimatedCost: session.costs?.estimatedCost || 0,
      actualCost: session.costs?.actualCost
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

export const stopLabSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { labId, userId } = req.body; // TODO: In real app, get from session data

    // Add to queue for cleanup
    await labQueue.add('cleanup-lab', {
      sessionId,
      stoppedAt: new Date(),
    });

    logger.info(`Stopping lab session ${sessionId}`);

    // Publish lab session stopped event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabSessionStopped(labId || 'lab-unknown', userId || 'user-unknown', {
      sessionId,
      sessionDuration: 1800, // TODO: Calculate actual duration
      reason: 'User requested stop',
      cost: 2.50 // TODO: Get actual cost calculation
    });

    res.json({
      success: true,
      data: {
        sessionId,
        status: 'stopping',
        message: 'Lab environment is being cleaned up',
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSessionLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // Fetch session from database
    const session = await LabSession.findOne({ sessionId }).lean();

    if (!session) {
      res.status(404).json({
        success: false,
        error: {
          message: 'Session not found',
          code: 'SESSION_NOT_FOUND'
        }
      });
      return;
    }

    // Return logs from the session document
    const logs = session.logs || [];

    res.json({
      success: true,
      data: logs.map(log => ({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        metadata: log.metadata
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const submitLabSolution = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const { labId, userId, solutionId } = req.body; // TODO: Get from session/request data
    // TODO: Use solution from req.body to validate against lab requirements and run automated tests
    // const { solution } = req.body;

    logger.info(`Validating solution for session ${sessionId}`);

    const eventPublisher = getLabEventPublisher();

    // Publish solution submitted event
    await eventPublisher.publishLabSolutionSubmitted(
      labId || 'lab-unknown',
      userId || 'user-unknown',
      {
        sessionId,
        solutionId: solutionId || `solution-${Date.now()}`,
        submissionTime: 1200 // TODO: Calculate actual submission time
      }
    );

    // Mock validation result
    const result = {
      sessionId,
      passed: true,
      score: 95,
      feedback: {
        checkpoints: [
          { name: 'Instance is running', passed: true },
          { name: 'Security group configured', passed: true },
          { name: 'Web server accessible', passed: true },
        ],
        suggestions: ['Consider using a more specific security group rule'],
      },
      completedAt: new Date(),
    };

    // Publish solution graded event
    await eventPublisher.publishLabSolutionGraded(
      labId || 'lab-unknown',
      userId || 'user-unknown',
      {
        sessionId,
        solutionId: solutionId || `solution-${Date.now()}`,
        score: result.score,
        maxScore: 100,
        feedback: 'Excellent work! All checkpoints passed.'
      }
    );

    // If the lab is completed successfully, publish completion event
    if (result.passed && result.score >= 70) {
      await eventPublisher.publishLabSessionCompleted(
        labId || 'lab-unknown',
        userId || 'user-unknown',
        {
          sessionId,
          sessionDuration: 1800, // TODO: Calculate actual duration
          solutionScore: result.score,
          cost: 2.50 // TODO: Get actual cost
        }
      );
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
