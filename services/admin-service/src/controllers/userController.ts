import { Response, NextFunction } from 'express';
import { AdminRequest } from '../middleware/adminAuth';
import { UserListRequest, UserManagementAction, InstructorApplication } from '@cloudmastershub/types';
import userService from '../services/userService';
import logger from '../utils/logger';

export const getUsers = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      status,
      subscription,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query as any;

    logger.info('Admin fetching users list', {
      adminId: req.adminId,
      filters: { role, status, subscription, search },
      pagination: { page, limit },
      sort: { sortBy, sortOrder }
    });

    const result = await userService.getUsers({
      page: Number(page),
      limit: Number(limit),
      role,
      status,
      subscription,
      search,
      sortBy,
      sortOrder
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch users'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getUsers controller:', error);
    next(error);
  }
};

export const getUserById = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    logger.info('Admin fetching user details', {
      adminId: req.adminId,
      targetUserId: userId
    });

    const result = await userService.getUserById(userId);

    if (!result.success) {
      res.status(404).json({
        success: false,
        error: {
          message: result.error || 'User not found'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getUserById controller:', error);
    next(error);
  }
};

export const manageUser = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { action, reason, duration } = req.body as UserManagementAction;

    logger.info('Admin managing user', {
      adminId: req.adminId,
      targetUserId: userId,
      action,
      reason
    });

    let result;

    if (action === 'promote' || action === 'demote') {
      const newRole = action === 'promote' ? 'instructor' : 'student';
      result = await userService.promoteUser(userId, newRole, reason);
    } else {
      result = await userService.updateUserStatus(userId, action, reason, duration);
    }

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || `Failed to ${action} user`
        }
      });
      return;
    }

    // Log the successful admin action
    logger.info('User management action completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      targetUserId: userId,
      action,
      reason,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: `User ${action} successful`,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in manageUser controller:', error);
    next(error);
  }
};

export const getInstructorApplications = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status = 'pending'
    } = req.query as any;

    logger.info('Admin fetching instructor applications', {
      adminId: req.adminId,
      filters: { status },
      pagination: { page, limit }
    });

    const result = await userService.getInstructorApplications({
      page: Number(page),
      limit: Number(limit),
      status
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch instructor applications'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getInstructorApplications controller:', error);
    next(error);
  }
};

export const reviewInstructorApplication = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { applicationId } = req.params;
    const { action, notes } = req.body;

    logger.info('Admin reviewing instructor application', {
      adminId: req.adminId,
      applicationId,
      action,
      notes: notes ? 'provided' : 'none'
    });

    const result = await userService.reviewInstructorApplication(
      applicationId,
      action,
      notes
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: {
          message: result.error || `Failed to ${action} application`
        }
      });
      return;
    }

    // Log the successful review
    logger.info('Instructor application review completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      applicationId,
      action,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: `Application ${action}d successfully`,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in reviewInstructorApplication controller:', error);
    next(error);
  }
};

export const getUserStats = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { timeframe = '30d' } = req.query as any;

    logger.info('Admin fetching user statistics', {
      adminId: req.adminId,
      timeframe
    });

    const result = await userService.getUserAnalytics(timeframe);

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: {
          message: result.error || 'Failed to fetch user statistics'
        }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error) {
    logger.error('Error in getUserStats controller:', error);
    next(error);
  }
};

export const bulkUserAction = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userIds, action, reason } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({
        success: false,
        error: {
          message: 'User IDs array is required'
        }
      });
      return;
    }

    if (userIds.length > 100) {
      res.status(400).json({
        success: false,
        error: {
          message: 'Maximum 100 users can be processed at once'
        }
      });
      return;
    }

    logger.info('Admin performing bulk user action', {
      adminId: req.adminId,
      userCount: userIds.length,
      action,
      reason
    });

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each user sequentially to avoid overwhelming the user service
    for (const userId of userIds) {
      try {
        const result = await userService.updateUserStatus(userId, action, reason);
        
        if (result.success) {
          successCount++;
          results.push({ userId, success: true });
        } else {
          failureCount++;
          results.push({ userId, success: false, error: result.error });
        }
      } catch (error) {
        failureCount++;
        results.push({ userId, success: false, error: 'Processing error' });
      }
    }

    logger.info('Bulk user action completed', {
      adminId: req.adminId,
      adminEmail: req.adminEmail,
      action,
      totalUsers: userIds.length,
      successCount,
      failureCount,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: `Bulk action completed: ${successCount} successful, ${failureCount} failed`,
      data: {
        totalProcessed: userIds.length,
        successCount,
        failureCount,
        results
      }
    });
  } catch (error) {
    logger.error('Error in bulkUserAction controller:', error);
    next(error);
  }
};