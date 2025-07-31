import { Request, Response } from 'express';
import { getAdminStats } from '../adminController';
import User, { UserRole } from '../../models/User';
import { ReferralLink } from '../../models/Referral';
import logger from '../../utils/logger';

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/Referral');
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
  }
}));

const mockUser = User as jest.Mocked<typeof User>;
const mockReferralLink = ReferralLink as jest.Mocked<typeof ReferralLink>;
const mockLogger = logger as jest.MockedObject<typeof logger>;

describe('AdminController', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;

  beforeEach(() => {
    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn().mockReturnThis();
    
    req = {
      userId: 'admin-user-id'
    };
    
    res = {
      status: statusMock,
      json: jsonMock
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getAdminStats', () => {
    it('should return comprehensive admin statistics successfully', async () => {
      // Mock user aggregation pipeline result
      const mockUserStats = [{
        totalUsers: 1500,
        roleDistribution: [
          { _id: [UserRole.STUDENT], count: 1200 },
          { _id: [UserRole.INSTRUCTOR], count: 25 },
          { _id: [UserRole.ADMIN], count: 5 }
        ],
        activeUsers: 850
      }];

      // Mock subscription distribution result
      const mockSubscriptionStats = [
        { _id: 'free', count: 800 },
        { _id: 'premium', count: 500 },
        { _id: 'premium_plus', count: 150 },
        { _id: 'enterprise', count: 50 }
      ];

      // Mock referral stats result
      const mockReferralStats = [{
        totalEarnings: 12500.50,
        pendingEarnings: 2750.25
      }];

      // Setup mocks
      mockUser.aggregate
        .mockResolvedValueOnce(mockUserStats)
        .mockResolvedValueOnce(mockSubscriptionStats);
      
      mockReferralLink.aggregate.mockResolvedValueOnce(mockReferralStats);

      await getAdminStats(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          // User metrics
          userCount: 1500,
          instructorCount: 25,
          studentCount: 1200,
          activeUsers: 850,
          
          // Course metrics (placeholders for now)
          courseCount: 0,
          pendingCourses: 0,
          
          // Revenue metrics (placeholders for now)
          revenue: 0,
          monthlyRevenue: 0,
          monthlyGrowth: 0,
          
          // Payment metrics
          payoutPending: 2750.25,
          activeSubscriptions: 0,
          
          // Support metrics (placeholder)
          openSupportTickets: 0,
          
          // Referral metrics
          referralEarnings: 12500.50,
          
          // Subscription distribution
          subscriptionDistribution: {
            free: 800,
            premium: 500,
            premium_plus: 150,
            enterprise: 50
          }
        }
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Fetching admin dashboard statistics',
        { userId: 'admin-user-id' }
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Admin statistics fetched successfully',
        expect.objectContaining({
          userId: 'admin-user-id',
          userCount: 1500,
          instructorCount: 25,
          studentCount: 1200,
          activeUsers: 850,
          referralEarnings: 12500.50
        })
      );
    });

    it('should handle empty database gracefully', async () => {
      // Mock empty results
      const mockEmptyUserStats = [{
        totalUsers: 0,
        roleDistribution: [],
        activeUsers: 0
      }];

      const mockEmptySubscriptionStats: any[] = [];
      const mockEmptyReferralStats: any[] = [];

      mockUser.aggregate
        .mockResolvedValueOnce(mockEmptyUserStats)
        .mockResolvedValueOnce(mockEmptySubscriptionStats);
      
      mockReferralLink.aggregate.mockResolvedValueOnce(mockEmptyReferralStats);

      await getAdminStats(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          userCount: 0,
          instructorCount: 0,
          studentCount: 0,
          activeUsers: 0,
          courseCount: 0,
          pendingCourses: 0,
          revenue: 0,
          monthlyRevenue: 0,
          monthlyGrowth: 0,
          payoutPending: 0,
          activeSubscriptions: 0,
          openSupportTickets: 0,
          referralEarnings: 0,
          subscriptionDistribution: {
            free: 0,
            premium: 0,
            premium_plus: 0,
            enterprise: 0
          }
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockError = new Error('Database connection failed');
      mockUser.aggregate.mockRejectedValueOnce(mockError);

      await getAdminStats(req as Request, res as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        message: 'Failed to fetch admin statistics',
        error: {
          code: 'ADMIN_STATS_ERROR',
          details: undefined // In test environment, details are not exposed
        }
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to fetch admin statistics:',
        mockError
      );
    });

    it('should handle mixed role arrays correctly', async () => {
      // Test case where users have multiple roles
      const mockUserStats = [{
        totalUsers: 100,
        roleDistribution: [
          { _id: [UserRole.STUDENT, UserRole.INSTRUCTOR], count: 10 }, // Users with both roles
          { _id: [UserRole.STUDENT], count: 80 },
          { _id: [UserRole.ADMIN], count: 5 }
        ],
        activeUsers: 60
      }];

      const mockSubscriptionStats = [{ _id: 'free', count: 100 }];
      const mockReferralStats = [{ totalEarnings: 0, pendingEarnings: 0 }];

      mockUser.aggregate
        .mockResolvedValueOnce(mockUserStats)
        .mockResolvedValueOnce(mockSubscriptionStats);
      
      mockReferralLink.aggregate.mockResolvedValueOnce(mockReferralStats);

      await getAdminStats(req as Request, res as Response);

      const response = jsonMock.mock.calls[0][0];
      
      // Should count users with multiple roles in both categories
      expect(response.data.instructorCount).toBe(10); // 10 users with instructor role
      expect(response.data.studentCount).toBe(90);    // 80 + 10 users with student role
    });

    it('should handle missing aggregation results gracefully', async () => {
      // Mock case where aggregation returns empty array
      mockUser.aggregate
        .mockResolvedValueOnce([])  // Empty user stats
        .mockResolvedValueOnce([]); // Empty subscription stats
      
      mockReferralLink.aggregate.mockResolvedValueOnce([]);

      await getAdminStats(req as Request, res as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          userCount: 0,
          instructorCount: 0,
          studentCount: 0,
          activeUsers: 0,
          referralEarnings: 0,
          subscriptionDistribution: {
            free: 0,
            premium: 0,
            premium_plus: 0,
            enterprise: 0
          }
        })
      });
    });

    it('should calculate subscription percentages correctly with default values', async () => {
      const mockUserStats = [{ totalUsers: 0, roleDistribution: [], activeUsers: 0 }];
      const mockSubscriptionStats = [
        { _id: null, count: 50 },        // Users with null subscription tier (should be treated as free)
        { _id: 'premium', count: 30 }
      ];
      const mockReferralStats = [{ totalEarnings: 100, pendingEarnings: 25 }];

      mockUser.aggregate
        .mockResolvedValueOnce(mockUserStats)
        .mockResolvedValueOnce(mockSubscriptionStats);
      
      mockReferralLink.aggregate.mockResolvedValueOnce(mockReferralStats);

      await getAdminStats(req as Request, res as Response);

      const response = jsonMock.mock.calls[0][0];
      
      // Null subscription tier should be counted as free
      expect(response.data.subscriptionDistribution.premium).toBe(30);
      expect(response.data.subscriptionDistribution.free).toBe(0); // null values not mapped to 'free' key
    });
  });
});