import { Request, Response } from 'express';
import User, { UserRole } from '../models/User';
import logger from '../utils/logger';

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
      return res.status(401).json({
        success: false,
        message: 'Instructor ID not found'
      });
    }

    // Check if user is an instructor
    if (!req.userRoles?.includes(UserRole.INSTRUCTOR)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Instructor role required.'
      });
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
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor statistics',
      error: {
        code: 'INSTRUCTOR_STATS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
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
      return res.status(401).json({
        success: false,
        message: 'Instructor ID not found'
      });
    }

    // Check if user is an instructor
    if (!req.userRoles?.includes(UserRole.INSTRUCTOR)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Instructor role required.'
      });
    }

    const instructor = await User.findById(instructorId).select('-password');
    
    if (!instructor) {
      return res.status(404).json({
        success: false,
        message: 'Instructor not found'
      });
    }

    res.json({
      success: true,
      data: instructor
    });
  } catch (error) {
    logger.error('Error fetching instructor profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch instructor profile',
      error: {
        code: 'INSTRUCTOR_PROFILE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};