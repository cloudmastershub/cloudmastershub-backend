import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authenticate';
import { 
  getUserById, 
  updateUser, 
  getUserSubscriptionInfo, 
  updateUserSubscriptionStatus 
} from '../services/userService';
import logger from '../utils/logger';

export const getProfile = async (
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

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: { message: 'User not found' }
      });
      return;
    }

    // Get subscription info
    const subscriptionInfo = await getUserSubscriptionInfo(userId);

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
    // TODO: Use userId from req.userId to fetch user progress from database
    // const userId = req.userId;

    // Mock progress data
    const progress = {
      coursesEnrolled: 5,
      coursesCompleted: 2,
      totalWatchTime: 3600, // seconds
      currentStreak: 7, // days
      certificates: [
        {
          courseId: 'aws-101',
          earnedAt: new Date('2024-01-15'),
        },
      ],
    };

    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
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
