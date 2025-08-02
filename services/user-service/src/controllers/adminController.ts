import { Request, Response } from 'express';
import logger from '../utils/logger';
import User, { UserRole } from '../models/User';
import { ReferralLink } from '../models/Referral';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Extend Request interface to include userId (from authentication middleware)
interface AuthenticatedRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

// Admin interfaces
export interface AdminUserResponse {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  subscriptionTier: string;
  subscriptionStatus: string;
  authProvider: string;
  emailVerified: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface AdminUserListResponse {
  users: AdminUserResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminCreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  roles: string[];
  subscriptionTier: string;
  emailVerified?: boolean;
}

export interface AdminUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  roles?: string[];
  subscriptionTier?: string;
  subscriptionStatus?: string;
  isActive?: boolean;
  emailVerified?: boolean;
}

/**
 * Admin Controller
 * Handles admin-specific operations and dashboard statistics
 */

export interface AdminStatsResponse {
  // User metrics
  userCount: number;
  instructorCount: number;
  studentCount: number;
  activeUsers: number;
  
  // Course metrics (will be fetched from course-service)
  courseCount: number;
  pendingCourses: number;
  
  // Revenue metrics (will be fetched from payment-service)
  revenue: number;           // lifetime gross revenue
  monthlyRevenue: number;    // current month revenue
  monthlyGrowth: number;     // percentage growth
  
  // Payment metrics (will be fetched from payment-service)
  payoutPending: number;     // $ awaiting approval
  activeSubscriptions: number;
  
  // Support metrics (placeholder for future support-service)
  openSupportTickets: number;
  
  // Referral metrics
  referralEarnings: number;
  
  // Subscription distribution
  subscriptionDistribution: {
    free: number;
    premium: number;
    premium_plus: number;
    enterprise: number;
  };
}

/**
 * Get comprehensive admin dashboard statistics
 * Aggregates data from multiple services for admin overview
 */
export const getAdminStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    logger.info('Fetching admin dashboard statistics', { userId: req.userId });
    
    // Run all user-related aggregations in parallel for performance
    const [userStats, subscriptionStats, referralStats] = await Promise.all([
      // User count aggregations using MongoDB aggregation pipeline
      User.aggregate([
        {
          $facet: {
            totalUsers: [
              { $count: 'count' }
            ],
            roleDistribution: [
              {
                $group: {
                  _id: '$roles',
                  count: { $sum: 1 }
                }
              }
            ],
            activeUsers: [
              {
                $match: {
                  lastLoginAt: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
                  }
                }
              },
              { $count: 'count' }
            ]
          }
        },
        {
          $project: {
            totalUsers: { $ifNull: [{ $arrayElemAt: ['$totalUsers.count', 0] }, 0] },
            roleDistribution: '$roleDistribution',
            activeUsers: { $ifNull: [{ $arrayElemAt: ['$activeUsers.count', 0] }, 0] }
          }
        }
      ]),
      
      // Subscription distribution aggregation
      User.aggregate([
        {
          $group: {
            _id: '$subscriptionTier',
            count: { $sum: 1 }
          }
        }
      ]),
      
      // Referral earnings aggregation
      ReferralLink.aggregate([
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$totalEarnings' },
            pendingEarnings: { $sum: '$pendingEarnings' }
          }
        }
      ])
    ]);

    // Process user statistics
    const userStatsResult = userStats[0] || {
      totalUsers: 0,
      roleDistribution: [],
      activeUsers: 0
    };

    // Calculate role-based counts
    const roleMap = new Map();
    userStatsResult.roleDistribution.forEach((role: any) => {
      if (Array.isArray(role._id)) {
        role._id.forEach((r: string) => {
          roleMap.set(r, (roleMap.get(r) || 0) + role.count);
        });
      }
    });

    const instructorCount = roleMap.get(UserRole.INSTRUCTOR) || 0;
    const studentCount = roleMap.get(UserRole.STUDENT) || 0;

    // Process subscription distribution
    const subscriptionMap = new Map();
    subscriptionStats.forEach((sub: any) => {
      subscriptionMap.set(sub._id || 'free', sub.count);
    });

    // Process referral statistics
    const referralStatsResult = referralStats[0] || {
      totalEarnings: 0,
      pendingEarnings: 0
    };

    // TODO: Fetch from other services
    // For now, we'll use placeholders and implement service calls later
    const courseStats = {
      courseCount: 0,      // TODO: Fetch from course-service
      pendingCourses: 0    // TODO: Fetch from course-service
    };

    const paymentStats = {
      revenue: 0,              // TODO: Fetch from payment-service
      monthlyRevenue: 0,       // TODO: Fetch from payment-service  
      monthlyGrowth: 0,        // TODO: Calculate from payment-service
      payoutPending: referralStatsResult.pendingEarnings,
      activeSubscriptions: 0   // TODO: Fetch from payment-service
    };

    const supportStats = {
      openSupportTickets: 0    // TODO: Fetch from support-service when available
    };

    // Build comprehensive response
    const adminStats: AdminStatsResponse = {
      // User metrics (real data)
      userCount: userStatsResult.totalUsers,
      instructorCount,
      studentCount,
      activeUsers: userStatsResult.activeUsers,
      
      // Course metrics (placeholder - to be implemented)
      courseCount: courseStats.courseCount,
      pendingCourses: courseStats.pendingCourses,
      
      // Revenue metrics (placeholder - to be implemented)
      revenue: paymentStats.revenue,
      monthlyRevenue: paymentStats.monthlyRevenue,
      monthlyGrowth: paymentStats.monthlyGrowth,
      
      // Payment metrics (partial real data)
      payoutPending: paymentStats.payoutPending,
      activeSubscriptions: paymentStats.activeSubscriptions,
      
      // Support metrics (placeholder)
      openSupportTickets: supportStats.openSupportTickets,
      
      // Referral metrics (real data)
      referralEarnings: referralStatsResult.totalEarnings,
      
      // Subscription distribution (real data)
      subscriptionDistribution: {
        free: subscriptionMap.get('free') || 0,
        premium: subscriptionMap.get('premium') || 0,
        premium_plus: subscriptionMap.get('premium_plus') || 0,
        enterprise: subscriptionMap.get('enterprise') || 0
      }
    };

    logger.info('Admin statistics fetched successfully', {
      userId: req.userId,
      userCount: adminStats.userCount,
      instructorCount: adminStats.instructorCount,
      studentCount: adminStats.studentCount,
      activeUsers: adminStats.activeUsers,
      referralEarnings: adminStats.referralEarnings
    });

    res.json({
      success: true,
      data: adminStats
    });
  } catch (error) {
    logger.error('Failed to fetch admin statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics',
      error: {
        code: 'ADMIN_STATS_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

// TODO: Future implementations for service integration
/**
 * Fetch course statistics from course-service
 * @private
 */
async function fetchCourseStats(): Promise<{ courseCount: number; pendingCourses: number }> {
  // Implementation will make HTTP calls to course-service
  // For now, return placeholders
  return {
    courseCount: 0,
    pendingCourses: 0
  };
}

/**
 * Fetch payment statistics from payment-service
 * @private
 */
async function fetchPaymentStats(): Promise<{
  revenue: number;
  monthlyRevenue: number;
  monthlyGrowth: number;
  activeSubscriptions: number;
}> {
  // Implementation will make HTTP calls to payment-service
  // For now, return placeholders
  return {
    revenue: 0,
    monthlyRevenue: 0,
    monthlyGrowth: 0,
    activeSubscriptions: 0
  };
}

/**
 * Fetch support statistics from support-service
 * @private
 */
async function fetchSupportStats(): Promise<{ openSupportTickets: number }> {
  // Implementation will make HTTP calls to support-service when available
  // For now, return placeholder
  return {
    openSupportTickets: 0
  };
}

// ============================================================================
// USER MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Get all users with pagination and filtering
 */
export const getAdminUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      subscriptionTier = '',
      isActive = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    const filter: any = {};
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (role) {
      filter.roles = { $in: [role] };
    }
    
    if (subscriptionTier) {
      filter.subscriptionTier = subscriptionTier;
    }
    
    if (isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -__v')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    const response: AdminUserListResponse = {
      users: users.map(user => ({
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        subscriptionTier: user.subscriptionTier,
        subscriptionStatus: user.subscriptionStatus,
        authProvider: user.authProvider,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString(),
        isActive: user.isActive
      })),
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit))
    };

    logger.info('Admin users list fetched', {
      adminId: req.userId,
      total,
      page,
      limit,
      filters: { role, subscriptionTier, isActive, search }
    });

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    logger.error('Failed to fetch admin users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: {
        code: 'ADMIN_USERS_FETCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

/**
 * Get single user by ID
 */
export const getAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    const user = await User.findById(userId).select('-password -__v').lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const userResponse: AdminUserResponse = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      isActive: user.isActive
    };

    logger.info('Admin user fetched', {
      adminId: req.userId,
      targetUserId: userId
    });

    res.json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    logger.error('Failed to fetch admin user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: {
        code: 'ADMIN_USER_FETCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

/**
 * Create new user
 */
export const createAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userData: AdminCreateUserRequest = req.body;

    // Validate required fields
    if (!userData.email || !userData.firstName || !userData.lastName) {
      res.status(400).json({
        success: false,
        message: 'Email, first name, and last name are required'
      });
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }

    // Hash password if provided
    let hashedPassword;
    if (userData.password) {
      hashedPassword = await bcrypt.hash(userData.password, 12);
    }

    // Create user
    const user = new User({
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      password: hashedPassword,
      roles: userData.roles || [UserRole.STUDENT],
      subscriptionTier: userData.subscriptionTier || 'free',
      subscriptionStatus: 'active',
      authProvider: hashedPassword ? 'email' : 'admin_created',
      emailVerified: userData.emailVerified || false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await user.save();

    const userResponse: AdminUserResponse = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      isActive: user.isActive
    };

    logger.info('Admin created new user', {
      adminId: req.userId,
      newUserId: user._id,
      email: user.email,
      roles: user.roles
    });

    res.status(201).json({
      success: true,
      data: userResponse,
      message: 'User created successfully'
    });
  } catch (error) {
    logger.error('Failed to create admin user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: {
        code: 'ADMIN_USER_CREATE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

/**
 * Update user
 */
export const updateAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const updateData: AdminUpdateUserRequest = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    // Build update object
    const updateFields: any = {};
    if (updateData.firstName !== undefined) updateFields.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) updateFields.lastName = updateData.lastName;
    if (updateData.roles !== undefined) updateFields.roles = updateData.roles;
    if (updateData.subscriptionTier !== undefined) updateFields.subscriptionTier = updateData.subscriptionTier;
    if (updateData.subscriptionStatus !== undefined) updateFields.subscriptionStatus = updateData.subscriptionStatus;
    if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive;
    if (updateData.emailVerified !== undefined) updateFields.emailVerified = updateData.emailVerified;
    
    updateFields.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password -__v').lean();

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    const userResponse: AdminUserResponse = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      subscriptionTier: user.subscriptionTier,
      subscriptionStatus: user.subscriptionStatus,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString(),
      isActive: user.isActive
    };

    logger.info('Admin updated user', {
      adminId: req.userId,
      targetUserId: userId,
      updatedFields: Object.keys(updateFields)
    });

    res.json({
      success: true,
      data: userResponse,
      message: 'User updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update admin user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: {
        code: 'ADMIN_USER_UPDATE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

/**
 * Delete user (soft delete)
 */
export const deleteAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    // Prevent self-deletion
    if (userId === req.userId) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        isActive: false,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password -__v');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    logger.info('Admin deleted user', {
      adminId: req.userId,
      deletedUserId: userId,
      deletedUserEmail: user.email
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete admin user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: {
        code: 'ADMIN_USER_DELETE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};