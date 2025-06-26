import logger from '../utils/logger';

// Mock user database - in production, this would be PostgreSQL
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bio?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

// Mock database storage
const userDatabase = new Map<string, User>();

export const getUserById = async (userId: string): Promise<User | null> => {
  try {
    const user = userDatabase.get(userId);
    if (!user) {
      // Create mock user if doesn't exist (for development)
      const mockUser: User = {
        id: userId,
        email: `user-${userId}@cloudmastershub.com`,
        firstName: 'John',
        lastName: 'Doe',
        bio: 'Cloud enthusiast learning AWS, Azure, and GCP',
        roles: ['STUDENT'],
        subscriptionStatus: 'free',
        subscriptionPlan: 'free',
        paymentStatus: 'none',
        failedPaymentCount: 0,
        totalPurchases: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      userDatabase.set(userId, mockUser);
      return mockUser;
    }
    return user;
  } catch (error) {
    logger.error('Error fetching user by ID:', error);
    throw error;
  }
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    for (const user of userDatabase.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  } catch (error) {
    logger.error('Error fetching user by email:', error);
    throw error;
  }
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User | null> => {
  try {
    const user = await getUserById(userId);
    if (!user) {
      return null;
    }

    const updatedUser: User = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };

    userDatabase.set(userId, updatedUser);
    
    logger.info('User updated successfully', {
      userId,
      updatedFields: Object.keys(updates)
    });

    return updatedUser;
  } catch (error) {
    logger.error('Error updating user:', error);
    throw error;
  }
};

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

    const updatedUser: User = {
      ...user,
      ...subscriptionData,
      updatedAt: new Date()
    };

    userDatabase.set(userId, updatedUser);
    
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

export const createUser = async (userData: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bio?: string;
  roles?: string[];
}): Promise<User> => {
  try {
    const newUser: User = {
      ...userData,
      roles: userData.roles || ['STUDENT'],
      subscriptionStatus: 'free',
      subscriptionPlan: 'free',
      paymentStatus: 'none',
      failedPaymentCount: 0,
      totalPurchases: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    userDatabase.set(newUser.id, newUser);
    
    logger.info('User created successfully', {
      userId: newUser.id,
      email: newUser.email
    });

    return newUser;
  } catch (error) {
    logger.error('Error creating user:', error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  try {
    const deleted = userDatabase.delete(userId);
    if (deleted) {
      logger.info('User deleted successfully', { userId });
    } else {
      logger.warn('User not found for deletion', { userId });
    }
    return deleted;
  } catch (error) {
    logger.error('Error deleting user:', error);
    throw error;
  }
};

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
                    user.subscriptionStatus === 'trialing';

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

export const getUsersWithActiveSubscriptions = async (): Promise<User[]> => {
  try {
    const activeUsers: User[] = [];
    for (const user of userDatabase.values()) {
      if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing') {
        activeUsers.push(user);
      }
    }
    return activeUsers;
  } catch (error) {
    logger.error('Error fetching users with active subscriptions:', error);
    throw error;
  }
};

export const getUsersWithFailedPayments = async (): Promise<User[]> => {
  try {
    const failedPaymentUsers: User[] = [];
    for (const user of userDatabase.values()) {
      if (user.paymentStatus === 'past_due' && user.failedPaymentCount && user.failedPaymentCount > 0) {
        failedPaymentUsers.push(user);
      }
    }
    return failedPaymentUsers;
  } catch (error) {
    logger.error('Error fetching users with failed payments:', error);
    throw error;
  }
};

// Initialize some mock users for development
export const initializeMockUsers = (): void => {
  const mockUsers: User[] = [
    {
      id: 'user-123',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      bio: 'AWS Solutions Architect',
      roles: ['STUDENT'],
      subscriptionStatus: 'active',
      subscriptionPlan: 'premium',
      subscriptionStartDate: new Date('2024-01-01'),
      subscriptionEndDate: new Date('2025-01-01'),
      lastPaymentDate: new Date('2024-12-01'),
      paymentStatus: 'current',
      failedPaymentCount: 0,
      totalPurchases: 3,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date()
    },
    {
      id: 'user-456',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      bio: 'Azure Cloud Engineer',
      roles: ['STUDENT'],
      subscriptionStatus: 'free',
      subscriptionPlan: 'free',
      paymentStatus: 'none',
      failedPaymentCount: 0,
      totalPurchases: 1,
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date()
    },
    {
      id: 'instructor-789',
      email: 'instructor@cloudmastershub.com',
      firstName: 'Mike',
      lastName: 'Wilson',
      bio: 'Cloud Instructor with 10+ years experience',
      roles: ['INSTRUCTOR'],
      subscriptionStatus: 'active',
      subscriptionPlan: 'enterprise',
      subscriptionStartDate: new Date('2024-01-01'),
      lastPaymentDate: new Date('2024-12-01'),
      paymentStatus: 'current',
      failedPaymentCount: 0,
      totalPurchases: 0,
      createdAt: new Date('2023-12-01'),
      updatedAt: new Date()
    }
  ];

  mockUsers.forEach(user => {
    userDatabase.set(user.id, user);
  });

  logger.info('Mock users initialized', { count: mockUsers.length });
};