import logger from '../utils/logger';
import { getUserEventPublisher } from '../events/userEventPublisher';
import { userRepository, UserRecord, CreateUserInput, UpdateUserInput } from '../database/userRepository';
import { db } from '../database/connection';
import { referralService } from './referralService';

// Service layer types (API-facing)
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bio?: string;
  profilePicture?: string;
  roles: string[];
  subscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  lastPaymentDate?: Date;
  paymentStatus?: string;
  lastPaymentAttempt?: Date;
  failedPaymentCount?: number;
  lastPurchaseDate?: Date;
  totalPurchases?: number;
  cancelledAt?: Date;
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Transform database record to service layer type
function transformUserRecord(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    firstName: record.first_name,
    lastName: record.last_name,
    profilePicture: record.profile_picture,
    roles: record.roles || ['student'], // Use actual roles from database
    subscriptionStatus: record.subscription_type === 'free' ? 'free' : 'active',
    subscriptionPlan: record.subscription_type,
    subscriptionEndDate: record.subscription_expires_at,
    emailVerified: record.email_verified,
    lastLoginAt: record.last_login_at,
    paymentStatus: record.subscription_type === 'free' ? 'none' : 'current',
    failedPaymentCount: record.login_attempts, // Reuse for now
    totalPurchases: 0, // Will be enhanced with purchase tracking
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

/**
 * Initialize database connection
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    await db.connect();
    logger.info('User service database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize user service database:', error);
    throw error;
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const record = await userRepository.getUserById(userId);
    if (!record) {
      logger.debug('User not found', { userId });
      return null;
    }
    return transformUserRecord(record);
  } catch (error) {
    logger.error('Error fetching user by ID:', error);
    throw error;
  }
};

/**
 * Get user by email
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const record = await userRepository.getUserByEmail(email);
    if (!record) {
      logger.debug('User not found by email', { email });
      return null;
    }
    return transformUserRecord(record);
  } catch (error) {
    logger.error('Error fetching user by email:', error);
    throw error;
  }
};

/**
 * Create a new user
 */
export const createUser = async (userData: {
  id?: string; // Optional for backward compatibility
  email: string;
  password?: string; // Optional, will be hashed
  firstName: string;
  lastName: string;
  bio?: string;
  profilePicture?: string;
  roles?: string[];
  subscriptionType?: 'free' | 'premium' | 'enterprise';
  emailVerified?: boolean;
}): Promise<User> => {
  try {
    const createInput: CreateUserInput = {
      email: userData.email,
      password_hash: userData.password || 'temp_hash', // In real app, this would be properly hashed
      first_name: userData.firstName,
      last_name: userData.lastName,
      profile_picture: userData.profilePicture,
      subscription_type: userData.subscriptionType || 'free',
      email_verified: userData.emailVerified || false
    };

    const record = await userRepository.createUser(createInput);
    const user = transformUserRecord(record);
    
    logger.info('User created successfully', {
      userId: user.id,
      email: user.email
    });

    // Initialize referral system for new user
    try {
      const userType = userData.subscriptionType && userData.subscriptionType !== 'free' ? 'subscribed' : 'normal';
      await referralService.initializeUserReferral(user.id, userType);
      logger.info('Referral system initialized for new user', { userId: user.id, userType });
    } catch (error) {
      logger.error('Failed to initialize referral system for new user', { userId: user.id, error });
      // Don't fail user creation if referral initialization fails
    }

    // Publish user created event
    const eventPublisher = getUserEventPublisher();
    await eventPublisher.publishUserCreated(user.id, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles
    });

    return user;
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

/**
 * Update user
 */
export const updateUser = async (userId: string, updates: Partial<User>): Promise<User | null> => {
  try {
    const currentUser = await getUserById(userId);
    if (!currentUser) {
      logger.warn('User not found for update', { userId });
      return null;
    }

    // Transform service layer updates to database layer
    const updateInput: UpdateUserInput = {};
    
    if (updates.email) updateInput.email = updates.email;
    if (updates.firstName) updateInput.first_name = updates.firstName;
    if (updates.lastName) updateInput.last_name = updates.lastName;
    if (updates.profilePicture !== undefined) updateInput.profile_picture = updates.profilePicture;
    if (updates.subscriptionPlan) {
      updateInput.subscription_type = updates.subscriptionPlan as 'free' | 'premium' | 'enterprise';
    }
    if (updates.subscriptionEndDate !== undefined) updateInput.subscription_expires_at = updates.subscriptionEndDate;
    if (updates.emailVerified !== undefined) updateInput.email_verified = updates.emailVerified;
    if (updates.lastLoginAt !== undefined) updateInput.last_login_at = updates.lastLoginAt;

    const record = await userRepository.updateUser(userId, updateInput);
    if (!record) {
      return null;
    }

    const updatedUser = transformUserRecord(record);
    
    logger.info('User updated successfully', {
      userId,
      updatedFields: Object.keys(updates)
    });

    // Publish events for specific updates
    const eventPublisher = getUserEventPublisher();
    
    // Check for email change
    if (updates.email && updates.email !== currentUser.email) {
      await eventPublisher.publishEmailChanged(userId, updates.email, currentUser.email);
    }
    
    // Check for role change
    if (updates.roles && JSON.stringify(updates.roles) !== JSON.stringify(currentUser.roles)) {
      await eventPublisher.publishRoleChanged(userId, updates.roles, currentUser.roles);
    }
    
    // Check for profile updates
    const profileFields = ['firstName', 'lastName', 'bio', 'profilePicture'];
    const profileUpdates = Object.keys(updates).filter(key => profileFields.includes(key));
    if (profileUpdates.length > 0) {
      const profileData = profileUpdates.reduce((obj: any, key: string) => {
        obj[key] = updates[key as keyof User];
        return obj;
      }, {});
      await eventPublisher.publishProfileUpdated(userId, profileData);
    }
    
    // General user updated event
    await eventPublisher.publishUserUpdated(userId, updates);

    return updatedUser;
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

/**
 * Update user subscription status (called by payment service)
 */
export const updateUserSubscriptionStatus = async (
  userId: string, 
  subscriptionData: {
    subscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionPlan?: string;
    subscriptionStartDate?: Date;
    subscriptionEndDate?: Date;
    lastPaymentDate?: Date;
    paymentStatus?: string;
    lastPaymentAttempt?: Date;
    failedPaymentCount?: number;
    lastPurchaseDate?: Date;
    totalPurchases?: number;
    cancelledAt?: Date;
    updatedAt?: Date;
  }
): Promise<User | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      logger.warn('User not found for subscription update:', userId);
      return null;
    }

    // Transform to database updates
    const updateInput: UpdateUserInput = {};
    
    if (subscriptionData.subscriptionPlan) {
      updateInput.subscription_type = subscriptionData.subscriptionPlan as 'free' | 'premium' | 'enterprise';
    }
    if (subscriptionData.subscriptionEndDate !== undefined) {
      updateInput.subscription_expires_at = subscriptionData.subscriptionEndDate;
    }
    if (subscriptionData.lastPaymentAttempt !== undefined) {
      updateInput.last_login_at = subscriptionData.lastPaymentAttempt; // Reuse this field for now
    }

    const record = await userRepository.updateUser(userId, updateInput);
    if (!record) {
      return null;
    }

    const updatedUser = transformUserRecord(record);
    
    // Apply additional subscription data that's not in the database yet
    updatedUser.subscriptionId = subscriptionData.subscriptionId;
    updatedUser.subscriptionStatus = subscriptionData.subscriptionStatus;
    updatedUser.subscriptionStartDate = subscriptionData.subscriptionStartDate;
    updatedUser.lastPaymentDate = subscriptionData.lastPaymentDate;
    updatedUser.paymentStatus = subscriptionData.paymentStatus;
    updatedUser.lastPaymentAttempt = subscriptionData.lastPaymentAttempt;
    updatedUser.failedPaymentCount = subscriptionData.failedPaymentCount;
    updatedUser.lastPurchaseDate = subscriptionData.lastPurchaseDate;
    updatedUser.totalPurchases = subscriptionData.totalPurchases;
    updatedUser.cancelledAt = subscriptionData.cancelledAt;
    
    logger.info('User subscription status updated', {
      userId,
      subscriptionStatus: subscriptionData.subscriptionStatus,
      subscriptionPlan: subscriptionData.subscriptionPlan,
      paymentStatus: subscriptionData.paymentStatus
    });

    return updatedUser;
  } catch (error) {
    logger.error('Error updating user subscription status:', error);
    throw error;
  }
};

/**
 * Delete user
 */
export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    const deleted = await userRepository.deleteUser(userId);
    if (deleted) {
      logger.info('User deleted successfully', { userId });
      
      // Publish user deleted event
      const eventPublisher = getUserEventPublisher();
      await eventPublisher.publishUserDeleted(userId, 'system');
    } else {
      logger.warn('User not found for deletion', { userId });
    }
    return deleted;
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
};

/**
 * Get user subscription info
 */
export const getUserSubscriptionInfo = async (userId: string): Promise<{
  subscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
  lastPaymentDate?: Date;
  paymentStatus?: string;
  isActive: boolean;
} | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return null;
    }

    const isActive = user.subscriptionStatus === 'active' || 
                    user.subscriptionStatus === 'trialing' ||
                    (user.subscriptionPlan !== 'free' && 
                     (!user.subscriptionEndDate || user.subscriptionEndDate > new Date()));

    return {
      subscriptionId: user.subscriptionId,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: user.subscriptionEndDate,
      lastPaymentDate: user.lastPaymentDate,
      paymentStatus: user.paymentStatus,
      isActive
    };
  } catch (error) {
    logger.error('Error fetching user subscription info:', error);
    throw error;
  }
};

/**
 * Get users with active subscriptions
 */
export const getUsersWithActiveSubscriptions = async (): Promise<User[]> => {
  try {
    const records = await userRepository.getUsersWithActiveSubscriptions();
    return records.map(transformUserRecord);
  } catch (error) {
    logger.error('Error fetching users with active subscriptions:', error);
    throw error;
  }
};

/**
 * Get users with failed payments (placeholder for future enhancement)
 */
export const getUsersWithFailedPayments = async (): Promise<User[]> => {
  try {
    // For now, return empty array. This will be enhanced when payment integration is complete
    return [];
  } catch (error) {
    logger.error('Error fetching users with failed payments:', error);
    throw error;
  }
};

/**
 * Get users with pagination and filters
 */
export const getUsers = async (options: {
  page?: number;
  limit?: number;
  subscriptionType?: string;
  emailVerified?: boolean;
  search?: string;
} = {}): Promise<{ users: User[]; total: number; page: number; limit: number }> => {
  try {
    const { page = 1, limit = 20, ...filters } = options;
    const offset = (page - 1) * limit;

    const result = await userRepository.getUsers({
      limit,
      offset,
      subscription_type: filters.subscriptionType,
      email_verified: filters.emailVerified,
      search: filters.search
    });

    return {
      users: result.users.map(transformUserRecord),
      total: result.total,
      page,
      limit
    };
  } catch (error) {
    logger.error('Error fetching users with pagination:', error);
    throw error;
  }
};

/**
 * Track user analytics event
 */
export const trackUserEvent = async (
  userId: string,
  eventType: string,
  eventData?: Record<string, any>,
  metadata?: {
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> => {
  try {
    await userRepository.trackAnalyticsEvent({
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
      session_id: metadata?.sessionId,
      ip_address: metadata?.ipAddress,
      user_agent: metadata?.userAgent
    });
    
    logger.debug('User analytics event tracked', { userId, eventType });
  } catch (error) {
    logger.error('Error tracking user analytics event:', error);
    // Don't throw error for analytics failures
  }
};

/**
 * Update user progress for a lesson
 */
export const updateUserProgress = async (
  userId: string,
  courseId: string,
  lessonId: string,
  progressData: {
    completed?: boolean;
    completionPercentage?: number;
    timeSpentSeconds?: number;
  }
): Promise<void> => {
  try {
    await userRepository.upsertUserProgress({
      user_id: userId,
      course_id: courseId,
      lesson_id: lessonId,
      completed: progressData.completed,
      completion_percentage: progressData.completionPercentage,
      time_spent_seconds: progressData.timeSpentSeconds,
      last_accessed_at: new Date(),
      completed_at: progressData.completed ? new Date() : undefined
    });

    logger.info('User progress updated', { userId, courseId, lessonId });
  } catch (error) {
    logger.error('Error updating user progress:', error);
    throw error;
  }
};

/**
 * Get user progress for a course
 */
export const getUserCourseProgress = async (
  userId: string,
  courseId: string
): Promise<Array<{
  lessonId: string;
  completed: boolean;
  completionPercentage: number;
  timeSpentSeconds: number;
  lastAccessedAt?: Date;
  completedAt?: Date;
}>> => {
  try {
    const records = await userRepository.getUserCourseProgress(userId, courseId);
    return records.map(record => ({
      lessonId: record.lesson_id,
      completed: record.completed,
      completionPercentage: record.completion_percentage,
      timeSpentSeconds: record.time_spent_seconds,
      lastAccessedAt: record.last_accessed_at,
      completedAt: record.completed_at
    }));
  } catch (error) {
    logger.error('Error fetching user course progress:', error);
    throw error;
  }
};

/**
 * Health check for user service database
 */
export const getDatabaseHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  database: string;
  connectionPool: {
    total: number;
    idle: number;
    waiting: number;
  };
  responseTime?: number;
  error?: string;
}> => {
  try {
    return await db.healthCheck();
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      database: 'unknown',
      connectionPool: { total: 0, idle: 0, waiting: 0 },
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};