import { Request, Response } from 'express';
import logger from '../utils/logger';
import User, { UserRole } from '../models/User';
import { ReferralLink } from '../models/Referral';

// Extend Request interface to include userId (from authentication middleware)
interface AuthenticatedRequest extends Request {
  userId?: string;
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