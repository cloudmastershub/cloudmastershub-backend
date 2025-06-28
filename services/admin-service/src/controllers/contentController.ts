import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { ContentModerationAction } from '@cloudmastershub/types';
import contentService from '../services/contentService';
import logger from '../utils/logger';

export const getContentForModeration = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'pending',
      type,
      sortBy = 'submittedAt',
      sortOrder = 'desc',
    } = req.query as any;

    logger.info('Admin fetching content for moderation', {
      adminId: req.adminId,
      filters: { status, type },
      pagination: { page, limit },
      sort: { sortBy, sortOrder },
    });

    const result = await contentService.getContentForModeration({
      page: Number(page),
      limit: Number(limit),
      status,
      type,
      sortBy,
      sortOrder,
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch content for moderation',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getContentForModeration controller:', error);
    next(error);
  }
};

export const getContentDetails = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contentId } = req.params;
    const { contentType } = req.query as any;

    if (!contentType || !['course', 'learning_path'].includes(contentType)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Valid content type (course or learning_path) is required',
        },
      });
      return;
    }

    logger.info('Admin fetching content details', {
      adminId: req.adminId,
      contentId,
      contentType,
    });

    const result = await contentService.getContentById(contentId, contentType);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: {
          message: result.error || 'Content not found',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getContentDetails controller:', error);
    next(error);
  }
};

export const moderateContent = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contentId } = req.params;
    const { action, contentType, reason, notes } = req.body as ContentModerationAction;

    logger.info('Admin moderating content', {
      adminId: req.adminId,
      contentId,
      contentType,
      action,
      reason: reason ? 'provided' : 'none',
    });

    const result = await contentService.moderateContent(
      contentId,
      contentType,
      action,
      reason,
      notes
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || `Failed to ${action} content`,
        },
      });
      return;
    }

    // Log the successful moderation action
    logger.info('Content moderation action completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      contentId,
      contentType,
      action,
      reason,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Content ${action}d successfully`,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in moderateContent controller:', error);
    next(error);
  }
};

export const getFlaggedContent = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20, type } = req.query as any;

    logger.info('Admin fetching flagged content', {
      adminId: req.adminId,
      filters: { type },
      pagination: { page, limit },
    });

    const result = await contentService.getFlaggedContent({
      page: Number(page),
      limit: Number(limit),
      type,
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch flagged content',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getFlaggedContent controller:', error);
    next(error);
  }
};

export const getContentStats = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching content statistics', {
      adminId: req.adminId,
      timeframe,
    });

    const result = await contentService.getContentAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch content statistics',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getContentStats controller:', error);
    next(error);
  }
};

export const getPopularContent = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type, timeframe = '30d', limit = 10 } = req.query as any;

    logger.info('Admin fetching popular content', {
      adminId: req.adminId,
      type,
      timeframe,
      limit,
    });

    const result = await contentService.getPopularContent({
      type,
      timeframe,
      limit: Number(limit),
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch popular content',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in getPopularContent controller:', error);
    next(error);
  }
};

export const bulkModerateContent = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { contentItems, action, reason } = req.body;

    if (!Array.isArray(contentItems) || contentItems.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Content items array is required',
        },
      });
      return;
    }

    if (contentItems.length > 50) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Maximum 50 content items can be processed at once',
        },
      });
      return;
    }

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Action must be approve or reject',
        },
      });
      return;
    }

    logger.info('Admin performing bulk content moderation', {
      adminId: req.adminId,
      contentCount: contentItems.length,
      action,
      reason,
    });

    const result = await contentService.bulkModerateContent(contentItems, action, reason);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to perform bulk moderation',
        },
      });
      return;
    }

    // Log the successful bulk action
    logger.info('Bulk content moderation completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      action,
      contentCount: contentItems.length,
      reason,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Bulk ${action} completed successfully`,
      data: result.data,
    });
  } catch (error) {
    logger.error('Error in bulkModerateContent controller:', error);
    next(error);
  }
};

export const getContentModerationQueue = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info('Admin fetching content moderation queue summary', {
      adminId: req.adminId,
    });

    // Fetch pending content counts
    const [coursesResult, pathsResult] = await Promise.all([
      contentService.getContentForModeration({
        limit: 0, // Just get count
        status: 'pending',
        type: 'course',
      }),
      contentService.getContentForModeration({
        limit: 0, // Just get count
        status: 'pending',
        type: 'learning_path',
      }),
    ]);

    const queueSummary = {
      pending: {
        courses: coursesResult.success ? coursesResult.data?.total || 0 : 0,
        learningPaths: pathsResult.success ? pathsResult.data?.total || 0 : 0,
        total: 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    queueSummary.pending.total = queueSummary.pending.courses + queueSummary.pending.learningPaths;

    res.status(200).json({
      success: true,
      data: queueSummary,
    });
  } catch (error) {
    logger.error('Error in getContentModerationQueue controller:', error);
    next(error);
  }
};
