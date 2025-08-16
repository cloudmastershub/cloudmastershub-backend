import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import logger from '../utils/logger';
import { LearningPath } from '../models';
import { isValidSlug, isLegacyId } from '../utils/slugValidation';
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
    const traceId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

    logger.info('Learning Paths - Request Started', {
      traceId,
      requestPath: req.path,
      userAgent: req.get('User-Agent'),
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

    // Use sequential queries to ensure consistency and avoid race conditions
    logger.info('Learning Paths - Executing Database Queries', {
      traceId,
      queryFilters: query,
      sortOptions,
      pagination: { pageNum, limitNum, skip }
    });

    // First get the total count
    const totalCount = await LearningPath.countDocuments(query);
    
    // Then get the actual paths using the same query
    const paths = await LearningPath.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean();

    logger.info('Learning Paths - Database Results', {
      traceId,
      totalCount,
      pathsFound: paths.length,
      hasConsistency: paths.length <= totalCount,
      queryMatchCount: totalCount
    });

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

    logger.info('Learning Paths - Response Prepared', {
      traceId,
      responseSize: transformedPaths.length,
      totalAvailable: totalCount,
      pageInfo: { page: pageNum, limit: limitNum, totalPages: Math.ceil(totalCount / limitNum) }
    });

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error: any) {
    logger.error('Learning Paths - Request Failed', { 
      traceId: req.headers['x-trace-id'] || 'unknown',
      error: error?.message || 'Unknown error',
      stack: error?.stack || 'No stack trace'
    });
    next(error);
  }
};

export const getLearningPathById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: slug } = req.params;
    
    // Validate slug format before proceeding
    if (!isValidSlug(slug)) {
      if (isLegacyId(slug)) {
        logger.warn('Legacy ID usage detected in getLearningPathById', { legacyId: slug });
        res.status(410).json({
          success: false,
          message: 'Legacy learning path identifiers are no longer supported',
          error: {
            code: 'LEGACY_ID_NOT_SUPPORTED',
            details: 'Please use the learning path slug (e.g., "cloud-architect-journey") instead of legacy IDs',
            legacyId: slug,
            migrationRequired: true
          }
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        message: 'Invalid learning path identifier format',
        error: {
          code: 'INVALID_SLUG_FORMAT',
          details: 'Learning path identifiers must be lowercase, alphanumeric with hyphens (e.g., "cloud-architect-journey")',
          provided: slug,
          expectedFormat: 'lowercase-slug-format'
        }
      });
      return;
    }
    
    logger.info('Fetching learning path by slug from MongoDB', { slug });
    
    try {
      // Only look up by slug - no legacy ID support
      const path = await LearningPath.findOne({ slug }).select('-__v').lean().maxTimeMS(5000);
      
      if (!path) {
        logger.warn('Learning path not found', { slug });
        res.status(404).json({
          success: false,
          message: 'Learning path not found',
          error: {
            code: 'PATH_NOT_FOUND',
            details: `No learning path found with slug: ${slug}`
          }
        });
        return;
      }

      // Transform path data to match frontend expectations
      const transformedPath = {
        ...path,
        id: path.slug, // Use slug as the public ID
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
          avatar: '',
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
    } catch (dbError: any) {
      logger.error('Database error fetching learning path by slug:', { slug, error: dbError.message });
      res.status(500).json({
        success: false,
        message: 'Database error occurred while fetching learning path',
        error: {
          code: 'DATABASE_ERROR',
          details: 'Unable to retrieve learning path from database'
        }
      });
      return;
    }
  } catch (error: any) {
    logger.error('Error fetching learning path by slug:', { slug: slug, error: error.message });
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: {
        code: 'INTERNAL_ERROR'
      }
    });
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

    logger.info('Creating new learning path', { 
      title: pathData.title, 
      instructorId: instructorId || 'none (admin-created)',
      finalInstructorId: instructorId || 'platform',
      requestBody: req.body 
    });

    // Validate required fields
    if (!pathData.title) {
      res.status(400).json({
        success: false,
        message: 'Title is required',
        error: {
          code: 'MISSING_TITLE',
          details: 'Learning path title is required'
        }
      });
      return;
    }

    if (!pathData.description) {
      res.status(400).json({
        success: false,
        message: 'Description is required',
        error: {
          code: 'MISSING_DESCRIPTION', 
          details: 'Learning path description is required'
        }
      });
      return;
    }

    if (!pathData.category) {
      res.status(400).json({
        success: false,
        message: 'Category is required',
        error: {
          code: 'MISSING_CATEGORY',
          details: 'Learning path category is required'
        }
      });
      return;
    }

    if (!pathData.level) {
      res.status(400).json({
        success: false,
        message: 'Level is required',
        error: {
          code: 'MISSING_LEVEL',
          details: 'Learning path difficulty level is required'
        }
      });
      return;
    }

    if (pathData.price === undefined || pathData.price === null) {
      res.status(400).json({
        success: false,
        message: 'Price is required',
        error: {
          code: 'MISSING_PRICE',
          details: 'Learning path price is required (use 0 for free)'
        }
      });
      return;
    }

    // For admin-created learning paths, instructor ID is optional
    // It can be assigned later or left as platform content
    const finalInstructorId = instructorId || 'platform'; // Use 'platform' as default for admin-created paths

    // TODO: Validate instructor permissions
    
    // Prepare learning path data with defaults for required fields
    const pathDataToSave = {
      title: pathData.title,
      description: pathData.description,
      shortDescription: pathData.shortDescription || pathData.description.substring(0, 300),
      category: pathData.category,
      level: pathData.level,
      thumbnail: pathData.thumbnail || 'https://api.cloudmastershub.com/images/courses/default-course.svg',
      instructorId: finalInstructorId,
      price: Number(pathData.price),
      currency: pathData.currency || 'USD',
      isFree: Number(pathData.price) === 0,
      
      // Content structure (empty initially)
      pathway: [],
      totalSteps: 0,
      totalCourses: 0,
      totalLabs: 0,
      estimatedDurationHours: 0,
      
      // Learning outcomes
      objectives: pathData.objectives || [],
      skills: pathData.skills || [],
      prerequisites: pathData.prerequisites || [],
      outcomes: pathData.outcomes || [],
      
      // Defaults
      rating: 0,
      reviewCount: 0,
      enrollmentCount: 0,
      completionRate: 0,
      tags: pathData.tags || [],
      
      // Publishing
      status: CourseStatus.DRAFT,
      isPublished: false,
      
      // Features
      includesCertificate: pathData.includesCertificate || false,
      hasHandsOnLabs: false,
      supportLevel: pathData.supportLevel || 'basic'
    };

    logger.info('Prepared learning path data for save:', pathDataToSave);

    // Create and save to MongoDB
    const newPath = new LearningPath(pathDataToSave);
    const savedPath = await newPath.save();
    
    logger.info('Learning path saved successfully:', {
      id: savedPath._id,
      title: savedPath.title
    });
    
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
  } catch (error: any) {
    logger.error('Error creating learning path:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message
      }));
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
      return;
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Learning path with this name already exists',
        error: {
          code: 'DUPLICATE_PATH',
          details: 'A learning path with this title already exists'
        }
      });
      return;
    }

    // Generic error handling
    res.status(500).json({
      success: false,
      message: 'Failed to create learning path',
      error: {
        code: 'CREATION_ERROR',
        details: error.message
      }
    });
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

    logger.info('Updating learning path', { 
      pathId: id, 
      userId, 
      updates: JSON.stringify(updates, null, 2),
      updateFields: Object.keys(updates)
    });

    // Query MongoDB for the learning path
    const path = await LearningPath.findById(id);

    if (!path) {
      logger.error('Learning path not found', { pathId: id, userId });
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

    logger.info('Found learning path for update', {
      pathId: id,
      currentTitle: path.title,
      currentStatus: path.status,
      currentCategory: path.category
    });

    // TODO: Verify ownership or admin permissions
    // Update path fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'createdAt') {
        logger.info(`Updating field ${key}`, {
          oldValue: (path as any)[key],
          newValue: (updates as any)[key]
        });
        (path as any)[key] = (updates as any)[key];
      }
    });

    path.updatedAt = new Date();
    
    logger.info('About to save updated learning path', {
      pathId: id,
      modifiedFields: path.modifiedPaths(),
      pathData: {
        title: path.title,
        status: path.status,
        category: path.category,
        level: path.level
      }
    });

    const updatedPath = await path.save();

    logger.info('Learning path updated successfully', {
      pathId: id,
      updatedTitle: updatedPath.title,
      updatedStatus: updatedPath.status
    });

    res.status(200).json({
      success: true,
      message: 'Learning path updated successfully',
      data: updatedPath,
    });
  } catch (error: any) {
    const { id } = req.params;
    const updates = req.body as UpdateLearningPathRequest;
    const userId = (req as any).user?.userId;
    
    logger.error('Error updating learning path:', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      pathId: id,
      userId,
      updates
    });

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.keys(error.errors).map(key => ({
        field: key,
        message: error.errors[key].message,
        value: error.errors[key].value
      }));
      
      logger.error('Validation error details:', { validationErrors });
      
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          details: validationErrors
        }
      });
      return;
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      res.status(400).json({
        success: false,
        message: 'Learning path with this name already exists',
        error: {
          code: 'DUPLICATE_PATH',
          details: 'A learning path with this title already exists'
        }
      });
      return;
    }

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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
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
  } catch (error: any) {
    logger.error('Error fetching learning path progress:', error);
    next(error);
  }
};
