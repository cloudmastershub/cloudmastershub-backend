import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authenticate';
import {
  getUserById,
  updateUser,
  getUserSubscriptionInfo,
  updateUserSubscriptionStatus
} from '../services/userService';
import logger from '../utils/logger';
import axios from 'axios';
import User from '../models/User';

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const userEmail = req.userEmail;

    logger.info('getProfile called', { userId, userEmail });

    if (!userId) {
      logger.warn('getProfile: User ID is required');
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required' }
      });
      return;
    }

    // First try MongoDB (for Google OAuth users) using email
    let user = null;
    let subscriptionInfo = null;

    if (userEmail) {
      logger.info('getProfile: Searching MongoDB for user by email', { email: userEmail.toLowerCase() });
      const mongoUser = await User.findOne({ email: userEmail.toLowerCase() });
      logger.info('getProfile: MongoDB search result', { found: !!mongoUser, mongoUserId: mongoUser?._id?.toString() });
      if (mongoUser) {
        // Found in MongoDB (Google OAuth user)
        user = {
          id: mongoUser._id.toString(),
          email: mongoUser.email,
          firstName: mongoUser.firstName,
          lastName: mongoUser.lastName,
          bio: mongoUser.bio,
          roles: mongoUser.roles,
          subscriptionStatus: 'active',
          subscriptionPlan: mongoUser.subscription || 'free',
          subscriptionStartDate: mongoUser.createdAt,
          subscriptionEndDate: null,
          lastPaymentDate: null,
          paymentStatus: null,
          createdAt: mongoUser.createdAt,
          updatedAt: mongoUser.updatedAt
        };
        subscriptionInfo = { isActive: true };
        logger.debug('User found in MongoDB', { userId: user.id, email: user.email });
      }
    }

    // Fall back to PostgreSQL if not found in MongoDB
    if (!user) {
      // Only try PostgreSQL if userId looks like a valid UUID
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      if (isValidUUID) {
        user = await getUserById(userId);
        if (user) {
          subscriptionInfo = await getUserSubscriptionInfo(userId);
        }
      }
    }

    if (!user) {
      logger.warn('getProfile: User not found in MongoDB or PostgreSQL', { userId, userEmail });
      res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
      return;
    }

    logger.info('getProfile: User found successfully', { userId: user.id, email: user.email });

    const userProfile = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      roles: user.roles,
      subscription: {
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        isActive: subscriptionInfo?.isActive || false,
        startDate: user.subscriptionStartDate,
        endDate: user.subscriptionEndDate,
        lastPaymentDate: user.lastPaymentDate,
        paymentStatus: user.paymentStatus
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    res.json({
      success: true,
      data: userProfile,
    });
  } catch (error) {
    logger.error('Error in getProfile:', error);
    next(error);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const updates = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required' }
      });
      return;
    }

    // Filter allowed update fields
    const allowedFields = ['firstName', 'lastName', 'bio'];
    const filteredUpdates = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .reduce((obj: any, key: string) => {
        obj[key] = updates[key];
        return obj;
      }, {});

    const updatedUser = await updateUser(userId, filteredUpdates);
    
    if (!updatedUser) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
      return;
    }

    logger.info(`Profile updated for user ${userId}:`, filteredUpdates);

    res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        bio: updatedUser.bio,
        updatedAt: updatedUser.updatedAt
      },
    });
  } catch (error) {
    logger.error('Error in updateProfile:', error);
    next(error);
  }
};

export const getProgress = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required' }
      });
      return;
    }

    logger.info(`Fetching progress for user ${userId}`);

    // Call the course service to get user's progress
    try {
      const courseServiceUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
      const response = await axios.get(`${courseServiceUrl}/progress/user/${userId}`, {
        headers: {
          'x-user-id': userId,
          'x-internal-service': 'true'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: response.data.data || {
          userId,
          enrolledCourses: [],
          totalWatchTime: 0,
          overallProgress: 0,
          coursesCompleted: 0,
          coursesEnrolled: 0,
          streak: 0,
          certificationsEarned: 0,
          labsCompleted: 0,
          pointsEarned: 0
        }
      });
    } catch (courseServiceError: any) {
      logger.error('Error fetching progress from course service:', {
        message: courseServiceError.message,
        status: courseServiceError.response?.status,
        data: courseServiceError.response?.data
      });

      // Return default progress if course service is unavailable
      res.json({
        success: true,
        data: {
          userId,
          enrolledCourses: [],
          totalWatchTime: 0,
          overallProgress: 0,
          coursesCompleted: 0,
          coursesEnrolled: 0,
          streak: 0,
          certificationsEarned: 0,
          labsCompleted: 0,
          pointsEarned: 0
        }
      });
    }
  } catch (error) {
    logger.error('Error in getProgress:', error);
    next(error);
  }
};

export const updateSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const { plan } = req.body;
    // TODO: Use paymentMethodId from req.body when implementing actual Stripe payment processing
    // const { paymentMethodId } = req.body;

    logger.info(`Updating subscription for user ${userId} to ${plan}`);

    res.json({
      success: true,
      data: {
        subscription: {
          plan,
          status: 'active',
          startDate: new Date(),
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserCourses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required' }
      });
      return;
    }

    logger.info(`Fetching enrolled courses for user ${userId}`, { 
      userIdType: typeof userId,
      userIdLength: userId?.length 
    });

    // Call the course service to get user's enrolled courses
    try {
      // Use internal service communication URL
      const courseServiceUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
      const response = await axios.get(`${courseServiceUrl}/user/${userId}/courses`, {
        headers: {
          'x-user-id': userId,
          'x-internal-service': 'true'
        }
      });

      res.json({
        success: true,
        data: response.data.data || []
      });
    } catch (courseServiceError: any) {
      logger.error('Error fetching courses from course service:', {
        message: courseServiceError.message,
        status: courseServiceError.response?.status,
        data: courseServiceError.response?.data,
        url: `${process.env.COURSE_SERVICE_URL || 'http://course-service:3002'}/user/${userId}/courses`
      });
      
      // Return empty array if course service is unavailable
      res.json({
        success: true,
        data: []
      });
    }
  } catch (error) {
    logger.error('Error in getUserCourses:', error);
    next(error);
  }
};
