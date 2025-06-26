import { Request, Response, NextFunction } from 'express';
import { labQueue } from '../services/queueService';
import logger from '../utils/logger';
import { getLabEventPublisher } from '../events/labEventPublisher';

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

export const getSessionStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sessionId } = req.params;

    // TODO: Fetch session status from database/cache

    // Mock session status
    const session = {
      sessionId,
      status: 'running', // provisioning, running, stopping, stopped, error
      labId: 'lab-aws-ec2-basics',
      userId: 'user123',
      startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      environment: {
        consoleUrl: 'https://console.aws.amazon.com',
        credentials: {
          accessKeyId: 'MOCK_ACCESS_KEY',
          region: 'us-east-1',
        },
        resources: [
          {
            type: 'ec2-instance',
            id: 'i-1234567890',
            status: 'running',
          },
        ],
      },
      timeRemaining: 3300, // seconds
    };

    res.json({
      success: true,
      data: session,
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
    // TODO: Use sessionId from req.params to fetch logs from CloudWatch/monitoring service
    // const { sessionId } = req.params;

    const logs = [
      {
        timestamp: new Date(Date.now() - 4 * 60 * 1000),
        level: 'info',
        message: 'Lab environment provisioned successfully',
      },
      {
        timestamp: new Date(Date.now() - 3 * 60 * 1000),
        level: 'info',
        message: 'EC2 instance i-1234567890 launched',
      },
      {
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        level: 'info',
        message: 'User connected to instance via SSH',
      },
    ];

    res.json({
      success: true,
      data: logs,
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
