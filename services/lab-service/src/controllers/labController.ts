import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { getLabEventPublisher } from '../events/labEventPublisher';
import Lab, { ILab } from '../models/Lab';
import { Types } from 'mongoose';

export const getAllLabs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { provider, difficulty, search, category, page = '1', limit = '20' } = req.query;

    // Build query filter
    const filter: any = { isActive: true };
    
    if (provider && provider !== 'all') {
      filter.provider = provider;
    }
    
    if (difficulty && difficulty !== 'all') {
      filter.difficulty = difficulty;
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [String(search).toLowerCase()] } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [labs, total] = await Promise.all([
      Lab.find(filter)
        .select('-instructions -createdBy -updatedBy')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Lab.countDocuments(filter)
    ]);

    // Transform data for response
    const transformedLabs = labs.map(lab => ({
      id: lab._id.toString(),
      title: lab.title,
      description: lab.description,
      provider: lab.provider,
      difficulty: lab.difficulty,
      estimatedTime: lab.estimatedTime,
      category: lab.category,
      prerequisites: lab.prerequisites,
      objectives: lab.objectives,
      tags: lab.tags,
      courseId: lab.courseId,
      pathId: lab.pathId
    }));

    res.json({
      success: true,
      data: transformedLabs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching labs:', error);
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

    // Validate ID format
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lab ID format'
      });
      return;
    }

    // Fetch lab from database
    const lab = await Lab.findById(id).lean();

    if (!lab) {
      res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
      return;
    }

    // Transform data for response
    const transformedLab = {
      id: lab._id.toString(),
      title: lab.title,
      description: lab.description,
      provider: lab.provider,
      difficulty: lab.difficulty,
      estimatedTime: lab.estimatedTime,
      category: lab.category,
      prerequisites: lab.prerequisites,
      objectives: lab.objectives,
      tags: lab.tags,
      instructions: lab.instructions,
      resources: lab.resources,
      validation: lab.validation,
      courseId: lab.courseId,
      pathId: lab.pathId
    };

    res.json({
      success: true,
      data: transformedLab
    });
  } catch (error) {
    logger.error('Error fetching lab by ID:', error);
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

    // Fetch labs associated with course
    const labs = await Lab.find({ courseId, isActive: true })
      .select('title description difficulty estimatedTime category')
      .sort({ createdAt: 1 })
      .lean();

    // Transform data for response
    const transformedLabs = labs.map((lab, index) => ({
      id: lab._id.toString(),
      courseId,
      title: lab.title,
      description: lab.description,
      difficulty: lab.difficulty,
      estimatedTime: lab.estimatedTime,
      category: lab.category,
      order: index + 1
    }));

    res.json({
      success: true,
      data: transformedLabs
    });
  } catch (error) {
    logger.error('Error fetching labs by course:', error);
    next(error);
  }
};

export const createLab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const labData = req.body;
    const instructorId = (req as any).userId || labData.instructorId; // Get from auth token

    // Create new lab document
    const newLab = new Lab({
      ...labData,
      createdBy: instructorId,
      isActive: false // Start as draft
    });

    // Validate and save
    const savedLab = await newLab.save();
    const labId = savedLab._id.toString();

    logger.info('Created new lab:', { id: labId, title: savedLab.title });

    // Publish lab created event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabCreated(labId, {
      title: savedLab.title,
      type: savedLab.provider,
      difficulty: savedLab.difficulty,
      duration: savedLab.estimatedTime,
      instructorId
    });

    res.status(201).json({
      success: true,
      data: {
        id: labId,
        title: savedLab.title,
        description: savedLab.description,
        provider: savedLab.provider,
        difficulty: savedLab.difficulty,
        estimatedTime: savedLab.estimatedTime,
        category: savedLab.category,
        prerequisites: savedLab.prerequisites,
        objectives: savedLab.objectives,
        tags: savedLab.tags,
        courseId: savedLab.courseId,
        pathId: savedLab.pathId,
        status: savedLab.isActive ? 'published' : 'draft',
        createdAt: savedLab.createdAt
      }
    });
  } catch (error) {
    logger.error('Error creating lab:', error);
    next(error);
  }
};

export const updateLab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const instructorId = (req as any).userId || updates.instructorId; // Get from auth token

    // Validate ID format
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lab ID format'
      });
      return;
    }

    // Handle status update
    if (updates.status) {
      updates.isActive = updates.status === 'published';
      delete updates.status;
    }

    // Update lab in database
    updates.updatedBy = instructorId;
    const updatedLab = await Lab.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedLab) {
      res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
      return;
    }

    logger.info(`Updated lab ${id}`);

    // Publish lab updated event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabUpdated(id, updates, instructorId);

    // Check if lab was published
    if (updatedLab.isActive && !updates.isActive) {
      await eventPublisher.publishLabPublished(id, instructorId);
    }

    res.json({
      success: true,
      data: {
        id: updatedLab._id.toString(),
        title: updatedLab.title,
        description: updatedLab.description,
        provider: updatedLab.provider,
        difficulty: updatedLab.difficulty,
        estimatedTime: updatedLab.estimatedTime,
        category: updatedLab.category,
        status: updatedLab.isActive ? 'published' : 'draft',
        updatedAt: updatedLab.updatedAt
      }
    });
  } catch (error) {
    logger.error('Error updating lab:', error);
    next(error);
  }
};

export const deleteLab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const instructorId = (req as any).userId || req.body.instructorId; // Get from auth token
    const reason = req.body.reason || 'Lab deletion requested';

    // Validate ID format
    if (!Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'Invalid lab ID format'
      });
      return;
    }

    // Delete lab from database
    const deletedLab = await Lab.findByIdAndDelete(id);

    if (!deletedLab) {
      res.status(404).json({
        success: false,
        message: 'Lab not found'
      });
      return;
    }

    logger.info(`Deleted lab ${id}`);

    // Publish lab deleted event
    const eventPublisher = getLabEventPublisher();
    await eventPublisher.publishLabDeleted(id, instructorId, reason);

    res.json({
      success: true,
      message: 'Lab deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting lab:', error);
    next(error);
  }
};
