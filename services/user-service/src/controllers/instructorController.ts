import { Request, Response } from 'express';
import axios from 'axios';
import User, { UserRole } from '../models/User';
import logger from '../utils/logger';

// Service URLs for inter-service communication
const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

/**
 * Fetch instructor course count from course-service
 */
async function fetchInstructorCourseCount(instructorId: string): Promise<number> {
  try {
    const response = await axios.get(`${COURSE_SERVICE_URL}/instructor/${instructorId}/stats`, {
      timeout: 5000,
      headers: { 'X-Internal-Service': 'user-service' }
    });

    if (response.data.success) {
      return response.data.data.courseCount || 0;
    }
    return 0;
  } catch (error) {
    logger.warn('Failed to fetch instructor course count', {
      instructorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

/**
 * Fetch instructor earnings from payment-service
 */
async function fetchInstructorEarnings(instructorId: string): Promise<number> {
  try {
    const response = await axios.get(`${PAYMENT_SERVICE_URL}/instructor/${instructorId}/earnings`, {
      timeout: 5000,
      headers: { 'X-Internal-Service': 'user-service' }
    });

    if (response.data.success) {
      return response.data.data.totalEarnings || 0;
    }
    return 0;
  } catch (error) {
    logger.warn('Failed to fetch instructor earnings', {
      instructorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return 0;
  }
}

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

    // Fetch course count and earnings from respective services in parallel
    const [courseCount, totalEarnings] = await Promise.all([
      fetchInstructorCourseCount(instructorId),
      fetchInstructorEarnings(instructorId)
    ]);

    const instructorStats = {
      studentCount: stats?.studentCount || 0,
      instructorCount: stats?.instructorCount || 0,
      courseCount,
      totalEarnings
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