import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { getLabEventPublisher } from '../events/labEventPublisher';

export const getAllLabs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // TODO: Apply filters for provider, difficulty, search when implementing database queries
    // const { provider, difficulty, search } = req.query;

    // Mock lab data
    const labs = [
      {
        id: 'lab-aws-ec2-basics',
        title: 'Launch Your First EC2 Instance',
        description: 'Learn how to launch and configure an EC2 instance in AWS',
        provider: 'aws',
        difficulty: 'beginner',
        estimatedTime: 30, // minutes
        prerequisites: ['AWS Account', 'Basic Linux knowledge'],
        objectives: ['Launch an EC2 instance', 'Connect via SSH', 'Install a web server'],
        tags: ['ec2', 'compute', 'aws'],
      },
      {
        id: 'lab-azure-vm',
        title: 'Create Azure Virtual Machine',
        description: 'Deploy and manage a virtual machine in Azure',
        provider: 'azure',
        difficulty: 'beginner',
        estimatedTime: 25,
        prerequisites: ['Azure Account'],
        objectives: ['Create a resource group', 'Deploy a VM', 'Configure networking'],
        tags: ['vm', 'compute', 'azure'],
      },
    ];

    res.json({
      success: true,
      data: labs,
    });
  } catch (error) {
    next(error);
  }
};

export const getLabById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // TODO: Fetch lab from database

    const lab = {
      id,
      title: 'Launch Your First EC2 Instance',
      description: 'Learn how to launch and configure an EC2 instance in AWS',
      provider: 'aws',
      difficulty: 'beginner',
      estimatedTime: 30,
      prerequisites: ['AWS Account', 'Basic Linux knowledge'],
      objectives: ['Launch an EC2 instance', 'Connect via SSH', 'Install a web server'],
      instructions: [
        {
          step: 1,
          title: 'Navigate to EC2 Dashboard',
          content: 'Log in to AWS Console and navigate to EC2 service',
          hints: ['Look for EC2 in the services menu'],
        },
        {
          step: 2,
          title: 'Launch Instance',
          content: 'Click Launch Instance and select Amazon Linux 2',
          hints: ['Choose t2.micro for free tier'],
        },
      ],
      resources: {
        cpuLimit: '1 vCPU',
        memoryLimit: '1 GB',
        timeLimit: 60, // minutes
      },
      validation: {
        checkpoints: [
          'Instance is running',
          'Security group allows SSH',
          'Web server is accessible',
        ],
      },
    };

    res.json({
      success: true,
      data: lab,
    });
  } catch (error) {
    next(error);
  }
};

export const getLabByCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;

    // TODO: Fetch labs associated with course

    const labs = [
      {
        id: 'lab-1',
        courseId,
        title: 'Practice Lab 1',
        order: 1,
      },
      {
        id: 'lab-2',
        courseId,
        title: 'Practice Lab 2',
        order: 2,
      },
    ];

    res.json({
      success: true,
      data: labs,
    });
  } catch (error) {
    next(error);
  }
};

export const createLab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const labData = req.body;

    // TODO: Validate and save lab to database

    const labId = `lab-${Date.now()}`;
    const instructorId = req.body.instructorId || 'instructor-123'; // In real app, get from auth token

    logger.info('Creating new lab:', labData.title);

    // Publish lab created event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabCreated(labId, {
      title: labData.title,
      type: labData.type || 'aws',
      difficulty: labData.difficulty || 'beginner',
      duration: labData.estimatedTime || 30,
      instructorId
    });

    res.status(201).json({
      success: true,
      data: {
        id: labId,
        ...labData,
        instructorId,
        status: 'draft',
        createdAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateLab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // TODO: Update lab in database

    const instructorId = req.body.instructorId || 'instructor-123'; // In real app, get from auth token

    logger.info(`Updating lab ${id}`);

    // Publish lab updated event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabUpdated(id, updates, instructorId);

    // Check if status was changed to published
    if (updates.status === 'published') {
      await eventPublisher.publishLabPublished(id, instructorId);
    }

    res.json({
      success: true,
      data: {
        id,
        ...updates,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // TODO: Delete lab from database

    const instructorId = req.body.instructorId || 'instructor-123'; // In real app, get from auth token
    const reason = req.body.reason || 'Lab deletion requested';

    logger.info(`Deleting lab ${id}`);

    // Publish lab deleted event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabDeleted(id, instructorId, reason);

    res.json({
      success: true,
      message: 'Lab deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
