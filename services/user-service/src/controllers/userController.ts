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

/**
 * Subscription management is handled by the payment service.
 * This endpoint returns the user's current subscription state from the database.
 */
export const updateSubscription = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  res.status(501).json({
    success: false,
    error: {
      message: 'Subscription changes are managed through the payment service. Use /api/subscriptions endpoints.',
      code: 'USE_PAYMENT_SERVICE',
    },
  });
};

export const getStreaks = async (
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

    logger.info(`Fetching streaks for user ${userId}`);

    // Call the course service to get user's streak data
    try {
      const courseServiceUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
      const response = await axios.get(`${courseServiceUrl}/progress/user/${userId}/streaks`, {
        headers: {
          'x-user-id': userId,
          'x-internal-service': 'true'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        data: response.data.data || {
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null
        }
      });
    } catch (courseServiceError: any) {
      logger.warn('Error fetching streaks from course service:', {
        message: courseServiceError.message,
        status: courseServiceError.response?.status
      });

      // Return default streak data if course service is unavailable
      res.json({
        success: true,
        data: {
          currentStreak: 0,
          longestStreak: 0,
          lastActivityDate: null
        }
      });
    }
  } catch (error) {
    logger.error('Error in getStreaks:', error);
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

    // Call the course service to get user's enrolled courses.
    //
    // Bug #2 (Apr 23 — enrollment exists, /users/courses returns []):
    // this URL used to be `/user/${userId}/courses`. That 404'd: the route
    // lives in `courseRoutes.ts`, which is mounted at `/courses` in
    // course-service/src/index.ts, so the real path is
    // `/courses/user/:userId/courses`. The axios call hit the bare root path,
    // got a 404 HTML, and the catch block below silently returned an empty
    // array — so every enrolled user saw "No Courses Yet" on /courses/my
    // regardless of actual enrollment state.
    const courseServiceUrl = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
    const url = `${courseServiceUrl}/courses/user/${userId}/courses`;
    try {
      const response = await axios.get(url, {
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
        url,
      });

      // Do NOT silently mask errors as "empty enrollment list".
      // A 5xx / network failure is a real degraded state — the user's
      // enrolled courses are not the same as "you have none". Surface it so
      // the frontend can show a retry affordance instead of the misleading
      // "No Courses Yet" empty state.
      //
      // Use 503 for both network failures and upstream 5xx (service is
      // unavailable from our vantage point); pass through 4xx if the upstream
      // returned one.
      const upstreamStatus = courseServiceError.response?.status;
      const status =
        typeof upstreamStatus === 'number' && upstreamStatus >= 400 && upstreamStatus < 500
          ? upstreamStatus
          : 503;
      res.status(status).json({
        success: false,
        error: {
          code: 'COURSES_UPSTREAM_FAILURE',
          message: 'Unable to load your enrolled courses right now. Please try again in a moment.',
        },
      });
    }
  } catch (error) {
    logger.error('Error in getUserCourses:', error);
    next(error);
  }
};

const DEFAULT_NOTIFICATION_PREFERENCES: {
  emailPreferences: { marketing: boolean; transactional: boolean; courseUpdates: boolean; communityUpdates: boolean; securityAlerts: boolean; weeklyDigest: boolean };
  pushPreferences: { enabled: boolean; courseReminders: boolean; messages: boolean; achievements: boolean };
  emailFrequency: string;
  unsubscribedAt?: Date;
} = {
  emailPreferences: {
    marketing: true,
    transactional: true,
    courseUpdates: true,
    communityUpdates: true,
    securityAlerts: true,
    weeklyDigest: true,
  },
  pushPreferences: {
    enabled: false,
    courseReminders: true,
    messages: true,
    achievements: true,
  },
  emailFrequency: 'instant',
};

export const getNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: { message: 'User ID is required' } });
      return;
    }

    const user = await User.findById(userId).select('notificationPreferences');
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const preferences = user.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;

    res.json({
      success: true,
      data: {
        emailPreferences: {
          marketing: preferences.emailPreferences?.marketing ?? true,
          transactional: preferences.emailPreferences?.transactional ?? true,
          courseUpdates: preferences.emailPreferences?.courseUpdates ?? true,
          communityUpdates: preferences.emailPreferences?.communityUpdates ?? true,
          securityAlerts: preferences.emailPreferences?.securityAlerts ?? true,
          weeklyDigest: preferences.emailPreferences?.weeklyDigest ?? true,
        },
        pushPreferences: {
          enabled: preferences.pushPreferences?.enabled ?? false,
          courseReminders: preferences.pushPreferences?.courseReminders ?? true,
          messages: preferences.pushPreferences?.messages ?? true,
          achievements: preferences.pushPreferences?.achievements ?? true,
        },
        emailFrequency: preferences.emailFrequency || 'instant',
        unsubscribedAt: preferences.unsubscribedAt || undefined,
      },
    });
  } catch (error) {
    logger.error('Error in getNotificationPreferences:', error);
    next(error);
  }
};

export const updateNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({ success: false, error: { message: 'User ID is required' } });
      return;
    }

    const { emailPreferences, pushPreferences, emailFrequency } = req.body;

    const updateData: any = {};

    if (emailPreferences) {
      // Security alerts cannot be disabled
      if (emailPreferences.securityAlerts === false) {
        emailPreferences.securityAlerts = true;
      }
      Object.keys(emailPreferences).forEach((key) => {
        updateData[`notificationPreferences.emailPreferences.${key}`] = emailPreferences[key];
      });
    }

    if (pushPreferences) {
      Object.keys(pushPreferences).forEach((key) => {
        updateData[`notificationPreferences.pushPreferences.${key}`] = pushPreferences[key];
      });
    }

    if (emailFrequency) {
      const validFrequencies = ['instant', 'daily', 'weekly', 'never'];
      if (!validFrequencies.includes(emailFrequency)) {
        res.status(400).json({ success: false, error: { message: 'Invalid email frequency' } });
        return;
      }
      updateData['notificationPreferences.emailFrequency'] = emailFrequency;
    }

    // Check if this is an unsubscribe-all action (all marketing prefs disabled)
    if (emailPreferences &&
        !emailPreferences.marketing &&
        !emailPreferences.courseUpdates &&
        !emailPreferences.communityUpdates &&
        !emailPreferences.weeklyDigest) {
      updateData['notificationPreferences.unsubscribedAt'] = new Date();
    } else {
      updateData['notificationPreferences.unsubscribedAt'] = null;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('notificationPreferences');

    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const prefs = user.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;

    res.json({
      success: true,
      data: {
        emailPreferences: prefs.emailPreferences,
        pushPreferences: prefs.pushPreferences,
        emailFrequency: prefs.emailFrequency,
        unsubscribedAt: prefs.unsubscribedAt || undefined,
      },
    });
  } catch (error) {
    logger.error('Error in updateNotificationPreferences:', error);
    next(error);
  }
};
