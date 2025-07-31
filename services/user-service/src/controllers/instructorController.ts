import { Request, Response } from 'express';
import User from '../models/User';
import { AppError } from '../../../shared/middleware/errorHandler';
import { logger } from '../../../shared/utils/logger';
import { UserRole } from '../../../shared/types';

// Extend Request to include authenticated user
interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

/**
 * Get instructor statistics
 * Returns comprehensive stats for instructor dashboard
 */
export const getInstructorStats = async (req: AuthRequest, res: Response) => {
  try {
    const instructorId = req.userId;
    
    if (!instructorId) {
      throw new AppError('Instructor ID not found', 401);
    }

    // Check if user is an instructor
    if (!req.userRoles?.includes(UserRole.INSTRUCTOR)) {
      throw new AppError('Access denied. Instructor role required.', 403);
    }

    // Use MongoDB aggregation pipeline for efficient counting
    const [stats] = await User.aggregate([
      {
        $facet: {
          studentCount: [
            { $match: { roles: { $in: [UserRole.STUDENT] } } },
            { $count: 'count' }
          ],
          instructorCount: [
            { $match: { roles: { $in: [UserRole.INSTRUCTOR] } } },
            { $count: 'count' }
          ]
        }
      },
      {
        $project: {
          studentCount: { $ifNull: [{ $arrayElemAt: ['$studentCount.count', 0] }, 0] },
          instructorCount: { $ifNull: [{ $arrayElemAt: ['$instructorCount.count', 0] }, 0] }
        }
      }
    ]);

    // For now, we'll return placeholder values for courseCount and totalEarnings
    // These should be fetched from course-service and payment-service respectively
    // In a production environment, you'd make internal service calls here
    const instructorStats = {
      studentCount: stats?.studentCount || 0,
      instructorCount: stats?.instructorCount || 0,
      courseCount: 0, // TODO: Fetch from course-service
      totalEarnings: 0 // TODO: Fetch from payment-service
    };

    logger.info(`Instructor stats fetched for user ${instructorId}`, { stats: instructorStats });

    res.json({
      success: true,
      data: instructorStats
    });
  } catch (error) {
    logger.error('Error fetching instructor stats:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch instructor statistics'
      });
    }
  }
};

/**
 * Get detailed instructor profile
 * Returns instructor-specific profile information
 */
export const getInstructorProfile = async (req: AuthRequest, res: Response) => {
  try {
    const instructorId = req.userId;
    
    if (!instructorId) {
      throw new AppError('Instructor ID not found', 401);
    }

    // Check if user is an instructor
    if (!req.userRoles?.includes(UserRole.INSTRUCTOR)) {
      throw new AppError('Access denied. Instructor role required.', 403);
    }

    const instructor = await User.findById(instructorId).select('-password');
    
    if (!instructor) {
      throw new AppError('Instructor not found', 404);
    }

    res.json({
      success: true,
      data: instructor
    });
  } catch (error) {
    logger.error('Error fetching instructor profile:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch instructor profile'
      });
    }
  }
};