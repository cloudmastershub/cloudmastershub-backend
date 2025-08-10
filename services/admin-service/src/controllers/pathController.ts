import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import pathService from '../services/pathService';
import logger from '../utils/logger';

export const getAllPaths = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      level,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as any;

    logger.info('Admin fetching learning paths', {
      adminId: req.adminId,
      filters: { search, category, level, status },
      pagination: { page, limit },
      sort: { sortBy, sortOrder },
    });

    const result = await pathService.getAllPaths({
      page: Number(page),
      limit: Number(limit),
      search,
      category,
      level,
      status,
      sortBy,
      sortOrder,
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch learning paths',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getAllPaths controller:', error);
    next(error);
  }
};

export const getPathById = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pathId } = req.params;

    logger.info('Admin fetching path details', {
      adminId: req.adminId,
      pathId,
    });

    const result = await pathService.getPathById(pathId);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: {
          message: result.error || 'Learning path not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getPathById controller:', error);
    next(error);
  }
};

export const createPath = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pathData = req.body;

    // Log the incoming data for debugging
    logger.info('Incoming path data from frontend:', {
      body: req.body,
      headers: req.headers['content-type'],
    });

    // Add admin info to the path data
    pathData.createdBy = req.adminId;
    pathData.instructorId = req.adminId;

    logger.info('Admin creating learning path', {
      adminId: req.adminId,
      pathTitle: pathData.title,
      category: pathData.category,
      level: pathData.level,
    });

    const result = await pathService.createPath(pathData);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to create learning path',
        },
      });
      return;
    }

    logger.info('Learning path created successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      pathId: result.data.id,
      pathTitle: pathData.title,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: 'Learning path created successfully',
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in createPath controller:', error);
    next(error);
  }
};

export const updatePath = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pathId } = req.params;
    const updates = req.body;

    logger.info('Admin updating learning path', {
      adminId: req.adminId,
      pathId,
      updates: Object.keys(updates),
    });

    const result = await pathService.updatePath(pathId, updates);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to update learning path',
        },
      });
      return;
    }

    logger.info('Learning path updated successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      pathId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Learning path updated successfully',
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in updatePath controller:', error);
    next(error);
  }
};

export const deletePath = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pathId } = req.params;

    logger.info('Admin deleting learning path', {
      adminId: req.adminId,
      pathId,
    });

    const result = await pathService.deletePath(pathId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to delete learning path',
        },
      });
      return;
    }

    logger.info('Learning path deleted successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      pathId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Learning path deleted successfully',
    });
  } catch (error) {
    logger.error('Error in deletePath controller:', error);
    next(error);
  }
};

export const addCourseToPath = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pathId } = req.params;
    const { courseId, order, isRequired = true, estimatedTimeMinutes = 60 } = req.body;

    logger.info('Admin adding course to learning path', {
      adminId: req.adminId,
      pathId,
      courseId,
      order,
      isRequired,
    });

    const result = await pathService.addCourseToPath(pathId, {
      courseId,
      order,
      isRequired,
      estimatedTimeMinutes,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to add course to learning path',
        },
      });
      return;
    }

    logger.info('Course added to learning path successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      pathId,
      courseId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Course added to learning path successfully',
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in addCourseToPath controller:', error);
    next(error);
  }
};

export const removeCourseFromPath = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pathId, courseId } = req.params;

    logger.info('Admin removing course from learning path', {
      adminId: req.adminId,
      pathId,
      courseId,
    });

    const result = await pathService.removeCourseFromPath(pathId, courseId);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to remove course from learning path',
        },
      });
      return;
    }

    logger.info('Course removed from learning path successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      pathId,
      courseId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Course removed from learning path successfully',
    });
  } catch (error) {
    logger.error('Error in removeCourseFromPath controller:', error);
    next(error);
  }
};

export const reorderPathSteps = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pathId } = req.params;
    const { orderedSteps } = req.body;

    if (!Array.isArray(orderedSteps)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'orderedSteps must be an array',
        },
      });
      return;
    }

    logger.info('Admin reordering learning path steps', {
      adminId: req.adminId,
      pathId,
      stepCount: orderedSteps.length,
    });

    const result = await pathService.reorderPathSteps(pathId, orderedSteps);

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || 'Failed to reorder path steps',
        },
      });
      return;
    }

    logger.info('Learning path steps reordered successfully', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      pathId,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Path steps reordered successfully',
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in reorderPathSteps controller:', error);
    next(error);
  }
};

export const getPathAnalytics = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching path analytics', {
      adminId: req.adminId,
      timeframe,
    });

    const result = await pathService.getPathAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch path analytics',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getPathAnalytics controller:', error);
    next(error);
  }
};