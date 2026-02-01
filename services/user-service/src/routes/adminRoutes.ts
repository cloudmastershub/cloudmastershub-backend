import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import {
  getAdminStats,
  getAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  updateUserRoles,
  updateUserSubscription,
  updateUserStatus
} from '../controllers/adminController';
import { UserRole } from '../models/User';
import logger from '../utils/logger';
import { db } from '../database/connection';

const router = Router();

/**
 * Admin Routes
 * All routes require authentication and admin role authorization
 */

// Apply authentication middleware to all admin routes
router.use(authenticate);

// Apply admin role authorization to all routes
router.use(authorize([UserRole.ADMIN]));

/**
 * @route   GET /admin/stats
 * @desc    Get comprehensive admin dashboard statistics
 * @access  Admin only
 * @returns AdminStatsResponse with comprehensive platform metrics
 */
router.get('/stats', getAdminStats);

// ============================================================================
// USER MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   GET /admin/users
 * @desc    Get all users with pagination and filtering
 * @access  Admin only
 * @query   page, limit, search, role, subscriptionTier, isActive, sortBy, sortOrder
 */
router.get('/users', getAdminUsers);

/**
 * @route   GET /admin/users/:userId
 * @desc    Get single user by ID
 * @access  Admin only
 */
router.get('/users/:userId', getAdminUser);

/**
 * @route   POST /admin/users
 * @desc    Create new user
 * @access  Admin only
 * @body    AdminCreateUserRequest
 */
router.post('/users', createAdminUser);

/**
 * @route   PUT /admin/users/:userId
 * @desc    Update user
 * @access  Admin only
 * @body    AdminUpdateUserRequest
 */
router.put('/users/:userId', updateAdminUser);

/**
 * @route   DELETE /admin/users/:userId
 * @desc    Delete user (soft delete)
 * @access  Admin only
 */
router.delete('/users/:userId', deleteAdminUser);

/**
 * @route   PUT /admin/users/:userId/roles
 * @desc    Update user roles
 * @access  Admin only
 * @body    { roles: string[] }
 */
router.put('/users/:userId/roles', updateUserRoles);

/**
 * @route   PUT /admin/users/:userId/subscription
 * @desc    Update user subscription tier
 * @access  Admin only
 * @body    { subscriptionTier: string }
 */
router.put('/users/:userId/subscription', updateUserSubscription);

/**
 * @route   PUT /admin/users/:userId/status
 * @desc    Update user status (activate, suspend, ban)
 * @access  Admin only
 * @body    { action: string, reason?: string }
 */
router.put('/users/:userId/status', updateUserStatus);

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

/**
 * @route   GET /admin/analytics/users
 * @desc    Get user analytics and activity metrics
 * @access  Admin only
 * @query   timeframe (7d, 30d, 90d, 1y)
 */
router.get('/analytics/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { timeframe = '30d' } = req.query;

    logger.info('Admin fetching user analytics', {
      adminId: req.userId,
      timeframe,
    });

    // Parse timeframe to get date range
    const match = String(timeframe).match(/^(\d+)([dwmy])$/);
    let startDate = new Date();
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      switch (unit) {
        case 'd': startDate.setDate(startDate.getDate() - value); break;
        case 'w': startDate.setDate(startDate.getDate() - value * 7); break;
        case 'm': startDate.setMonth(startDate.getMonth() - value); break;
        case 'y': startDate.setFullYear(startDate.getFullYear() - value); break;
      }
    } else {
      startDate.setDate(startDate.getDate() - 30); // Default 30 days
    }

    // Aggregate user analytics using MongoDB
    const User = (await import('../models/User')).default;

    const [userStats, activityStats, growthStats] = await Promise.all([
      // Total user counts and subscription distribution
      User.aggregate([
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalUsers: { $sum: 1 },
                  activeUsers: {
                    $sum: {
                      $cond: [
                        { $gte: ['$lastLogin', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)] },
                        1,
                        0
                      ]
                    }
                  },
                  verifiedUsers: {
                    $sum: { $cond: ['$emailVerified', 1, 0] }
                  }
                }
              }
            ],
            subscriptionDistribution: [
              {
                $group: {
                  _id: '$subscription',
                  count: { $sum: 1 }
                }
              }
            ],
            roleDistribution: [
              { $unwind: '$roles' },
              {
                $group: {
                  _id: '$roles',
                  count: { $sum: 1 }
                }
              }
            ]
          }
        }
      ]),

      // Activity metrics within timeframe
      User.aggregate([
        {
          $facet: {
            // Users who logged in within timeframe
            activeInTimeframe: [
              {
                $match: {
                  lastLogin: { $gte: startDate }
                }
              },
              { $count: 'count' }
            ],
            // New users within timeframe
            newUsers: [
              {
                $match: {
                  createdAt: { $gte: startDate }
                }
              },
              { $count: 'count' }
            ],
            // Daily active users (last 24 hours)
            dailyActive: [
              {
                $match: {
                  lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }
              },
              { $count: 'count' }
            ],
            // Weekly active users (last 7 days)
            weeklyActive: [
              {
                $match: {
                  lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
              },
              { $count: 'count' }
            ]
          }
        }
      ]),

      // Growth trend (users per day/week in timeframe)
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    // Process aggregation results
    const totals = userStats[0]?.totals?.[0] || {
      totalUsers: 0,
      activeUsers: 0,
      verifiedUsers: 0
    };

    const subscriptionDist: Record<string, number> = {};
    (userStats[0]?.subscriptionDistribution || []).forEach((s: any) => {
      subscriptionDist[s._id || 'free'] = s.count;
    });

    const roleDist: Record<string, number> = {};
    (userStats[0]?.roleDistribution || []).forEach((r: any) => {
      roleDist[r._id] = r.count;
    });

    const activity = activityStats[0] || {};

    const analyticsData = {
      timeframe,
      generatedAt: new Date().toISOString(),
      totalUsers: totals.totalUsers,
      activeUsers: totals.activeUsers,
      verifiedUsers: totals.verifiedUsers,
      activeInTimeframe: activity.activeInTimeframe?.[0]?.count || 0,
      newUsersInTimeframe: activity.newUsers?.[0]?.count || 0,
      dailyActiveUsers: activity.dailyActive?.[0]?.count || 0,
      weeklyActiveUsers: activity.weeklyActive?.[0]?.count || 0,
      subscriptionDistribution: {
        free: subscriptionDist.free || 0,
        basic: subscriptionDist.basic || subscriptionDist.individual || 0,
        premium: subscriptionDist.premium || subscriptionDist.professional || 0,
        bootcamp: subscriptionDist.bootcamp || subscriptionDist.enterprise || 0,
      },
      roleDistribution: {
        student: roleDist.student || 0,
        instructor: roleDist.instructor || 0,
        admin: roleDist.admin || 0,
      },
      growthTrend: growthStats.map((g: any) => ({
        date: g._id,
        newUsers: g.count
      })),
      // Calculated metrics
      userRetentionRate: totals.totalUsers > 0
        ? Math.round((totals.activeUsers / totals.totalUsers) * 100 * 10) / 10
        : 0,
      emailVerificationRate: totals.totalUsers > 0
        ? Math.round((totals.verifiedUsers / totals.totalUsers) * 100 * 10) / 10
        : 0,
    };

    logger.info('User analytics fetched', {
      totalUsers: analyticsData.totalUsers,
      activeUsers: analyticsData.activeUsers,
      newUsersInTimeframe: analyticsData.newUsersInTimeframe,
    });

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    logger.error('Error fetching user analytics:', error);
    next(error);
  }
});

// ============================================================================
// INSTRUCTOR APPLICATION ROUTES
// ============================================================================

/**
 * @route   GET /admin/users/instructors/applications
 * @desc    Get all instructor applications with pagination
 * @access  Admin only
 * @query   page, limit, status (pending, approved, rejected)
 */
router.get('/users/instructors/applications', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 20, status = 'pending' } = req.query;

    logger.info('Admin fetching instructor applications', {
      adminId: req.userId,
      filters: { status },
      pagination: { page, limit },
    });

    // Query instructor applications from the database
    // For now, we'll query users who have requested instructor role
    // In a full implementation, there would be a separate instructor_applications table
    const offset = (Number(page) - 1) * Number(limit);

    // Get users with pending instructor applications
    // This is a simplified implementation - in production, use a dedicated applications table
    let query = `
      SELECT
        id,
        email,
        first_name as "firstName",
        last_name as "lastName",
        profile_picture as "profilePicture",
        roles,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users
      WHERE 'instructor' = ANY(roles)
    `;

    let countQuery = `
      SELECT COUNT(*) FROM users
      WHERE 'instructor' = ANY(roles)
    `;

    // If status is 'pending', we'd filter differently in a real implementation
    // For now, return instructors based on status filter
    if (status === 'pending') {
      // Return users who have applied but not yet approved (simplified)
      query = `
        SELECT
          id,
          email,
          first_name as "firstName",
          last_name as "lastName",
          profile_picture as "profilePicture",
          roles,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM users
        WHERE 'instructor' = ANY(roles)
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `SELECT COUNT(*) FROM users WHERE 'instructor' = ANY(roles)`;
    }

    const [applicationsResult, countResult] = await Promise.all([
      db.query(query, [Number(limit), offset]),
      db.query(countQuery)
    ]);

    const applications = applicationsResult.rows.map((user: any) => ({
      id: user.id,
      applicantId: user.id,
      applicantEmail: user.email,
      applicantName: `${user.firstName} ${user.lastName}`,
      profilePicture: user.profilePicture,
      status: 'approved', // Since they already have instructor role
      appliedAt: user.createdAt,
      reviewedAt: user.updatedAt,
    }));

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        applications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching instructor applications:', error);
    next(error);
  }
});

/**
 * @route   PUT /admin/users/instructors/applications/:applicationId
 * @desc    Review an instructor application (approve/reject)
 * @access  Admin only
 * @body    { action: 'approve' | 'reject', notes?: string }
 */
router.put('/users/instructors/applications/:applicationId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { applicationId } = req.params;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({
        success: false,
        error: { message: 'Action must be approve or reject' },
      });
      return;
    }

    logger.info('Admin reviewing instructor application', {
      adminId: req.userId,
      applicationId,
      action,
      notes: notes ? 'provided' : 'none',
    });

    // In this implementation, applicationId is the userId
    const userId = applicationId;

    if (action === 'approve') {
      // Add instructor role if not already present
      const query = `
        UPDATE users
        SET roles = CASE
          WHEN 'instructor' = ANY(roles) THEN roles
          ELSE array_append(roles, 'instructor')
        END,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
        return;
      }

      logger.info('Instructor application approved', { userId, adminId: req.userId });

      res.json({
        success: true,
        message: 'Instructor application approved',
        data: {
          id: result.rows[0].id,
          email: result.rows[0].email,
          roles: result.rows[0].roles,
        },
      });
    } else {
      // Remove instructor role if present
      const query = `
        UPDATE users
        SET roles = array_remove(roles, 'instructor'),
        updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;
      const result = await db.query(query, [userId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: { message: 'User not found' },
        });
        return;
      }

      logger.info('Instructor application rejected', { userId, adminId: req.userId, notes });

      res.json({
        success: true,
        message: 'Instructor application rejected',
        data: {
          id: result.rows[0].id,
          email: result.rows[0].email,
          roles: result.rows[0].roles,
        },
      });
    }
  } catch (error) {
    logger.error('Error reviewing instructor application:', error);
    next(error);
  }
});

export default router;