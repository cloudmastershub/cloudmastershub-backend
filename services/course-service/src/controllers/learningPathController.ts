import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { LearningPath } from '../models';
import {
  LearningPath as LearningPathType,
  LearningPathQueryParams,
  LearningPathListResponse,
  LearningPathDetailsResponse,
  CreateLearningPathRequest,
  UpdateLearningPathRequest,
  AddPathwayStepRequest,
  PathwayProgressResponse,
  LearningPathProgress,
  PathwayStep,
  CourseCategory,
  DifficultyLevel,
  CourseStatus,
} from '@cloudmastershub/types';

// Learning Path Controller - MongoDB Integration
// All mock data removed - using real database queries only

// All mock data removed - using MongoDB queries only

export const getAllLearningPaths = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      level,
      instructorId,
      minPrice,
      maxPrice,
      isFree,
      minRating,
      tags,
      search,
      sortBy = 'newest',
      sortOrder = 'desc',
    } = req.query as LearningPathQueryParams;

    logger.info('Fetching learning paths from database', {
      filters: { category, level, instructorId, isFree, search },
      pagination: { page, limit },
      sort: { sortBy, sortOrder },
    });

    // Build MongoDB query filters
    const query: any = {};

    if (category) {
      query.category = category;
    }
    if (level) {
      query.level = level;
    }
    if (instructorId) {
      query.instructorId = instructorId;
    }
    if (isFree !== undefined) {
      query.isFree = String(isFree) === 'true';
    }
    if (minPrice) {
      query.price = { ...query.price, $gte: Number(minPrice) };
    }
    if (maxPrice) {
      query.price = { ...query.price, $lte: Number(maxPrice) };
    }
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    if (tags) {
      const tagArray = tags.split(',').map((tag: string) => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Build sort options
    let sortOptions: any = {};
    switch (sortBy) {
      case 'newest':
        sortOptions = { createdAt: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'popular':
        sortOptions = { enrollmentCount: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'rating':
        sortOptions = { rating: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'price':
        sortOptions = { price: sortOrder === 'asc' ? 1 : -1 };
        break;
      case 'duration':
        sortOptions = { estimatedDurationHours: sortOrder === 'asc' ? 1 : -1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    // Execute MongoDB query with pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [paths, totalCount] = await Promise.all([
      LearningPath.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      LearningPath.countDocuments(query)
    ]);

    // Transform paths to match frontend expectations
    const transformedPaths = paths.map((path: any) => ({
      ...path,
      id: path._id.toString(),
      totalSteps: path.pathway?.length || 0,
      totalCourses: path.pathway?.filter((step: any) => step.type === 'course').length || 0,
      totalLabs: path.pathway?.filter((step: any) => step.type === 'lab').length || 0
    }));

    const response: LearningPathListResponse = {
      paths: transformedPaths,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum),
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error fetching learning paths:', error);
    next(error);
  }
};

export const getLearningPathById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Fetching learning path by ID from database', { pathId: id });

    // Query MongoDB for the learning path
    const path = await LearningPath.findById(id).lean();

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // Transform path data to match frontend expectations
    const transformedPath = {
      ...path,
      id: path._id.toString(),
      totalSteps: path.pathway?.length || 0,
      totalCourses: path.pathway?.filter((step: any) => step.type === 'course').length || 0,
      totalLabs: path.pathway?.filter((step: any) => step.type === 'lab').length || 0,
      pathway: path.pathway || []
    };

    const response: LearningPathDetailsResponse = {
      ...transformedPath,
      instructor: {
        id: path.instructorId || 'default-instructor',
        name: 'Learning Path Instructor',
        bio: 'Expert instructor for this learning path',
        avatar: null,
        expertise: [],
        rating: 0
      },
      prerequisites: [],
      recommendations: [], // Will be populated with actual data when needed
      reviews: [] // Will be populated with actual review data when implemented
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error('Error fetching learning path by ID:', error);
    next(error);
  }
};

export const createLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pathData = req.body as CreateLearningPathRequest;
    const instructorId = (req as any).user?.userId; // From JWT middleware

    logger.info('Creating new learning path', { title: pathData.title, instructorId });

    // TODO: Validate instructor permissions
    
    // Prepare learning path data
    const pathDataToSave = {
      ...pathData,
      instructorId,
      pathway: [],
      totalSteps: 0,
      totalCourses: 0,
      totalLabs: 0,
      estimatedDurationHours: 0,
      rating: 0,
      reviewCount: 0,
      enrollmentCount: 0,
      completionRate: 0,
      status: CourseStatus.DRAFT,
      isPublished: false,
      isFree: pathData.price === 0,
      hasHandsOnLabs: false,
    };

    // Create and save to MongoDB
    const newPath = new LearningPath(pathDataToSave);
    const savedPath = await newPath.save();
    
    // Transform for response
    const newPathResponse = {
      ...savedPath.toObject(),
      id: savedPath._id.toString()
    };

    res.status(201).json({
      success: true,
      message: 'Learning path created successfully',
      data: newPathResponse,
    });
  } catch (error) {
    logger.error('Error creating learning path:', error);
    next(error);
  }
};

export const updateLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body as UpdateLearningPathRequest;
    const userId = (req as any).user?.userId;

    logger.info('Updating learning path', { pathId: id, userId });

    // Query MongoDB for the learning path
    const path = await LearningPath.findById(id);

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // TODO: Verify ownership or admin permissions
    // Update path fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'createdAt') {
        (path as any)[key] = (updates as any)[key];
      }
    });

    path.updatedAt = new Date();
    const updatedPath = await path.save();

    res.status(200).json({
      success: true,
      message: 'Learning path updated successfully',
      data: updatedPath,
    });
  } catch (error) {
    logger.error('Error updating learning path:', error);
    next(error);
  }
};

export const deleteLearningPath = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    logger.info('Deleting learning path', { pathId: id, userId });

    // Query MongoDB for the learning path
    const path = await LearningPath.findById(id);

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // TODO: Verify admin permissions only
    // TODO: Check if path has enrollments
    
    // Delete from MongoDB
    await LearningPath.findByIdAndDelete(id);
    
    logger.info(`Deleted learning path: ${path.title}`, {
      pathId: id,
      userId
    });

    res.status(200).json({
      success: true,
      message: 'Learning path deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting learning path:', error);
    next(error);
  }
};

export const addPathwayStep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const stepData = req.body as AddPathwayStepRequest;
    const userId = (req as any).user?.userId;

    logger.info('Adding pathway step', { pathId: id, stepType: stepData.type, userId });

    // Query MongoDB for the learning path
    const path = await LearningPath.findById(id);

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // TODO: Verify ownership
    // TODO: Validate course/lab IDs exist
    
    // Create new step
    const newStep = {
      id: `step-${Date.now()}`,
      pathId: id,
      order: (stepData as any).order || path.pathway.length,
      ...stepData,
      isLocked: false,
      prerequisites: (stepData as any).prerequisites || [],
      unlocks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Add step to path and save
    path.pathway.push(newStep as any);
    await path.save();

    res.status(201).json({
      success: true,
      message: 'Pathway step added successfully',
      data: newStep,
    });
  } catch (error) {
    logger.error('Error adding pathway step:', error);
    next(error);
  }
};

export const removePathwayStep = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id, stepId } = req.params;
    const userId = (req as any).user?.userId;

    logger.info('Removing pathway step', { pathId: id, stepId, userId });

    // Query MongoDB for the learning path
    const path = await LearningPath.findById(id);

    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // TODO: Verify ownership
    // TODO: Check dependencies
    
    // Remove step from path and save
    path.pathway = path.pathway.filter((step: any) => step.id !== stepId);
    await path.save();
    
    logger.info('Removed pathway step', { pathId: id, stepId, userId });

    res.status(200).json({
      success: true,
      message: 'Pathway step removed successfully',
    });
  } catch (error) {
    logger.error('Error removing pathway step:', error);
    next(error);
  }
};

export const getLearningPathProgress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    logger.info('Fetching learning path progress', { pathId: id, userId });

    // TODO: Fetch from MongoDB - for now return 501 Not Implemented
    
    res.status(501).json({
      success: false,
      message: 'Learning path progress tracking not yet implemented',
      error: {
        code: 'NOT_IMPLEMENTED',
        details: 'Progress tracking for learning paths will be implemented in a future update'
      }
    });
    return;
  } catch (error) {
    logger.error('Error fetching learning path progress:', error);
    next(error);
  }
};
