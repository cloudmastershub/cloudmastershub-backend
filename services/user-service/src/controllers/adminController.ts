import { Request, Response } from 'express';
import axios from 'axios';
import logger from '../utils/logger';
import User, { UserRole } from '../models/User';
import { ReferralLink } from '../models/Referral';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Service URLs for inter-service communication
const COURSE_SERVICE_URL = process.env.COURSE_SERVICE_URL || 'http://course-service:3002';
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3004';

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
  subscription: string;
  emailVerified: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
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
  subscription: string;
  emailVerified?: boolean;
}

export interface AdminUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  roles?: string[];
  subscription?: string;
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
                  lastLogin: {
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
            _id: '$subscription',
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

    // Fetch stats from other services in parallel (non-blocking)
    const [courseStats, externalPaymentStats, supportStats] = await Promise.all([
      fetchCourseStats(),
      fetchPaymentStats(),
      fetchSupportStats()
    ]);

    const paymentStats = {
      ...externalPaymentStats,
      payoutPending: referralStatsResult.pendingEarnings
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

/**
 * Fetch course statistics from course-service
 * @private
 */
async function fetchCourseStats(): Promise<{ courseCount: number; pendingCourses: number }> {
  try {
    const response = await axios.get(`${COURSE_SERVICE_URL}/admin/stats`, {
      timeout: 5000,
      headers: { 'X-Internal-Service': 'user-service' }
    });

    if (response.data.success) {
      return {
        courseCount: response.data.data.totalCourses || 0,
        pendingCourses: response.data.data.pendingCourses || 0
      };
    }

    logger.warn('Course service returned unsuccessful response', { response: response.data });
    return { courseCount: 0, pendingCourses: 0 };
  } catch (error) {
    logger.warn('Failed to fetch course stats from course-service', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: `${COURSE_SERVICE_URL}/admin/stats`
    });
    return { courseCount: 0, pendingCourses: 0 };
  }
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
  try {
    const response = await axios.get(`${PAYMENT_SERVICE_URL}/admin/stats`, {
      timeout: 5000,
      headers: { 'X-Internal-Service': 'user-service' }
    });

    if (response.data.success) {
      return {
        revenue: response.data.data.totalRevenue || 0,
        monthlyRevenue: response.data.data.monthlyRevenue || 0,
        monthlyGrowth: response.data.data.monthlyGrowth || 0,
        activeSubscriptions: response.data.data.activeSubscriptions || 0
      };
    }

    logger.warn('Payment service returned unsuccessful response', { response: response.data });
    return { revenue: 0, monthlyRevenue: 0, monthlyGrowth: 0, activeSubscriptions: 0 };
  } catch (error) {
    logger.warn('Failed to fetch payment stats from payment-service', {
      error: error instanceof Error ? error.message : 'Unknown error',
      url: `${PAYMENT_SERVICE_URL}/admin/stats`
    });
    return { revenue: 0, monthlyRevenue: 0, monthlyGrowth: 0, activeSubscriptions: 0 };
  }
}

/**
 * Fetch support statistics from support-service
 * @private
 */
async function fetchSupportStats(): Promise<{ openSupportTickets: number }> {
  // Support service not yet implemented
  return { openSupportTickets: 0 };
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

    logger.info('Admin users request received', {
      adminId: req.userId,
      query: req.query,
      page,
      limit,
      search,
      role,
      subscriptionTier,
      isActive
    });

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
      filter.subscription = subscriptionTier;
    }
    
    if (isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    logger.info('Query filter built', { filter });

    // Build sort object
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);
    
    logger.info('Executing database query', { 
      skip, 
      limit: Number(limit), 
      sort 
    });
    
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -__v')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter)
    ]);
    
    logger.info('Database query completed', { 
      usersFound: users.length, 
      totalCount: total 
    });

    const response: AdminUserListResponse = {
      users: users.map(user => ({
        _id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        subscription: user.subscription,
        emailVerified: user.emailVerified || false,
        avatar: user.avatar,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        lastLogin: user.lastLogin?.toISOString(),
        isActive: user.isActive ?? true
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
      filters: { role, subscriptionTier, isActive, search },
      responseUsersCount: response.users.length
    });

    // Log first user for debugging
    if (response.users.length > 0) {
      logger.info('Sample user from response', {
        firstUser: response.users[0]
      });
    } else {
      logger.warn('No users found in database', {
        filterUsed: filter,
        mongooseConnectionState: mongoose.connection.readyState,
        databaseName: mongoose.connection.db?.databaseName
      });
    }

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
      subscription: user.subscription,
      emailVerified: user.emailVerified || false,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      isActive: user.isActive ?? true
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
      subscription: userData.subscription || 'free',
      emailVerified: userData.emailVerified || false,
      isActive: true
    });

    await user.save();

    const userResponse: AdminUserResponse = {
      _id: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      subscription: user.subscription,
      emailVerified: user.emailVerified || false,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      isActive: user.isActive ?? true
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
    if (updateData.subscription !== undefined) updateFields.subscription = updateData.subscription;
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
      subscription: user.subscription,
      emailVerified: user.emailVerified || false,
      avatar: user.avatar,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLogin: user.lastLogin?.toISOString(),
      isActive: user.isActive ?? true
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

/**
 * Update user roles
 */
export const updateUserRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { roles } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    if (!Array.isArray(roles)) {
      res.status(400).json({
        success: false,
        message: 'Roles must be an array'
      });
      return;
    }

    const validRoles = Object.values(UserRole);
    const invalidRoles = roles.filter(role => !validRoles.includes(role));
    if (invalidRoles.length > 0) {
      res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(', ')}`
      });
      return;
    }

    // Prevent removing admin role from self
    if (userId === req.userId && !roles.includes(UserRole.ADMIN)) {
      res.status(400).json({
        success: false,
        message: 'Cannot remove admin role from your own account'
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        roles,
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

    logger.info('Admin updated user roles', {
      adminId: req.userId,
      targetUserId: userId,
      newRoles: roles,
      previousRoles: user.roles
    });

    res.json({
      success: true,
      message: 'User roles updated successfully',
      data: {
        id: user._id,
        email: user.email,
        roles: user.roles,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update user roles:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user roles',
      error: {
        code: 'USER_ROLES_UPDATE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

/**
 * Update user subscription tier
 */
export const updateUserSubscription = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { subscriptionTier } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    if (!subscriptionTier) {
      res.status(400).json({
        success: false,
        message: 'Subscription tier is required'
      });
      return;
    }

    const validTiers = ['free', 'individual', 'professional', 'enterprise'];
    if (!validTiers.includes(subscriptionTier)) {
      res.status(400).json({
        success: false,
        message: `Invalid subscription tier: ${subscriptionTier}`
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        subscription: subscriptionTier,
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

    logger.info('Admin updated user subscription', {
      adminId: req.userId,
      targetUserId: userId,
      newSubscription: subscriptionTier,
      previousSubscription: user.subscription
    });

    res.json({
      success: true,
      message: 'User subscription updated successfully',
      data: {
        id: user._id,
        email: user.email,
        subscription: user.subscription,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update user subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user subscription',
      error: {
        code: 'USER_SUBSCRIPTION_UPDATE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};

/**
 * Update user status (activate, suspend, ban)
 */
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
      return;
    }

    if (!action) {
      res.status(400).json({
        success: false,
        message: 'Action is required'
      });
      return;
    }

    const validActions = ['activate', 'suspend', 'ban'];
    if (!validActions.includes(action)) {
      res.status(400).json({
        success: false,
        message: `Invalid action: ${action}`
      });
      return;
    }

    // Prevent self-targeting for suspend/ban actions
    if (userId === req.userId && (action === 'suspend' || action === 'ban')) {
      res.status(400).json({
        success: false,
        message: 'Cannot suspend or ban your own account'
      });
      return;
    }

    let updateData: any = {
      updatedAt: new Date()
    };

    switch (action) {
      case 'activate':
        updateData.isActive = true;
        updateData.bannedAt = null;
        updateData.suspendedAt = null;
        break;
      case 'suspend':
        updateData.isActive = false;
        updateData.suspendedAt = new Date();
        updateData.suspensionReason = reason;
        break;
      case 'ban':
        updateData.isActive = false;
        updateData.bannedAt = new Date();
        updateData.banReason = reason;
        break;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password -__v');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    logger.info(`Admin ${action}ed user`, {
      adminId: req.userId,
      targetUserId: userId,
      action,
      reason,
      targetUserEmail: user.email
    });

    res.json({
      success: true,
      message: `User ${action}ed successfully`,
      data: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Failed to update user status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status',
      error: {
        code: 'USER_STATUS_UPDATE_ERROR',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      }
    });
  }
};