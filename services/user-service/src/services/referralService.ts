import { 
  ReferralCommissionSettings, 
  ReferralEarning, 
  ReferralPayoutRequest, 
  ReferralLink,
  IReferralCommissionSettings,
  IReferralEarning,
  IReferralPayoutRequest,
  IReferralLink
} from '../models/Referral';
import { User } from '../models/User';
import logger from '../utils/logger';
import {
  ReferralStats,
  AdminReferralOverview,
  ReferrerPerformance,
  CreateReferralEarningRequest,
  PayoutRequestData,
  UpdatePayoutRequest,
  ReferralFilters,
  EarningFilters
} from '@cloudmastershub/types';

export class ReferralService {
  
  /**
   * Initialize referral settings for a new user
   */
  async initializeUserReferral(userId: string, userType: 'normal' | 'subscribed' = 'normal') {
    try {
      // Create referral link
      const referralLink = new ReferralLink({ userId });
      await referralLink.save();

      // Create commission settings with default rates
      const defaultRates = this.getDefaultCommissionRates(userType);
      const commissionSettings = new ReferralCommissionSettings({
        userId,
        userType,
        initialCommissionRate: defaultRates.initial,
        recurringCommissionRate: defaultRates.recurring,
        paymentModel: 'recurring',
        isActive: true,
        customRates: false
      });
      await commissionSettings.save();

      logger.info('Referral system initialized for user', { userId, userType });
      
      return {
        referralLink: referralLink.referralCode,
        commissionSettings
      };
    } catch (error) {
      logger.error('Failed to initialize user referral', { userId, error });
      throw error;
    }
  }

  /**
   * Get default commission rates based on user type
   */
  private getDefaultCommissionRates(userType: 'normal' | 'subscribed') {
    if (userType === 'subscribed') {
      return { initial: 40, recurring: 20 };
    }
    return { initial: 20, recurring: 10 };
  }

  /**
   * Track referral click
   */
  async trackReferralClick(referralCode: string) {
    try {
      const referralLink = await ReferralLink.findOne({ referralCode });
      if (referralLink) {
        referralLink.clicks += 1;
        referralLink.lastUsed = new Date();
        await referralLink.save();
        return referralLink;
      }
      return null;
    } catch (error) {
      logger.error('Failed to track referral click', { referralCode, error });
      throw error;
    }
  }

  /**
   * Record referral signup (store referrer ID in user record)
   */
  async recordReferralSignup(referredUserId: string, referralCode: string) {
    try {
      const referralLink = await ReferralLink.findOne({ referralCode });
      if (!referralLink) {
        logger.warn('Invalid referral code used', { referralCode });
        return null;
      }

      // Update user record with referrer information
      await User.findByIdAndUpdate(referredUserId, {
        referredBy: referralLink.userId,
        referralDate: new Date()
      });

      // Increment conversion count
      referralLink.conversions += 1;
      await referralLink.save();

      logger.info('Referral signup recorded', { 
        referredUserId, 
        referrerId: referralLink.userId,
        referralCode 
      });

      return referralLink.userId;
    } catch (error) {
      logger.error('Failed to record referral signup', { referredUserId, referralCode, error });
      throw error;
    }
  }

  /**
   * Create referral earning when referred user makes a purchase
   */
  async createReferralEarning(request: CreateReferralEarningRequest): Promise<IReferralEarning | null> {
    try {
      // Find the referred user's referrer
      const referredUser = await User.findById(request.referredUserId);
      if (!referredUser?.referredBy) {
        logger.info('User has no referrer', { userId: request.referredUserId });
        return null;
      }

      const referrerId = referredUser.referredBy;

      // Get referrer's commission settings
      const commissionSettings = await ReferralCommissionSettings.findOne({ 
        userId: referrerId, 
        isActive: true 
      });

      if (!commissionSettings) {
        logger.warn('No active commission settings found for referrer', { referrerId });
        return null;
      }

      // Determine if this is initial or recurring commission
      const existingEarnings = await ReferralEarning.find({ 
        referrerId, 
        referredUserId: request.referredUserId 
      });
      
      const earningType = existingEarnings.length === 0 ? 'initial' : 'recurring';
      
      // Skip recurring if payment model is one-time only
      if (earningType === 'recurring' && commissionSettings.paymentModel === 'one-time') {
        logger.info('Skipping recurring commission for one-time payment model', { referrerId });
        return null;
      }

      // Calculate commission
      const commissionRate = earningType === 'initial' 
        ? commissionSettings.initialCommissionRate 
        : commissionSettings.recurringCommissionRate;
      
      const earningAmount = (request.grossAmount * commissionRate) / 100;

      // Create earning record
      const earning = new ReferralEarning({
        referrerId,
        referredUserId: request.referredUserId,
        transactionId: request.transactionId,
        transactionType: request.transactionType,
        earningType,
        grossAmount: request.grossAmount,
        commissionRate,
        earningAmount,
        currency: request.currency,
        status: 'pending'
      });

      await earning.save();

      logger.info('Referral earning created', {
        referrerId,
        referredUserId: request.referredUserId,
        earningAmount,
        earningType
      });

      return earning;
    } catch (error) {
      logger.error('Failed to create referral earning', { request, error });
      throw error;
    }
  }

  /**
   * Get user's referral stats
   */
  async getUserReferralStats(userId: string): Promise<ReferralStats> {
    try {
      const [
        totalReferrals,
        activeReferrals,
        earnings,
        thisMonthData
      ] = await Promise.all([
        // Total referrals
        User.countDocuments({ referredBy: userId }),
        
        // Active referrals (users who made at least one purchase)
        ReferralEarning.distinct('referredUserId', { referrerId: userId }).then(ids => ids.length),
        
        // Earnings aggregation
        ReferralEarning.aggregate([
          { $match: { referrerId: userId } },
          {
            $group: {
              _id: '$status',
              totalAmount: { $sum: '$earningAmount' },
              count: { $sum: 1 }
            }
          }
        ]),
        
        // This month's data
        this.getThisMonthStats(userId)
      ]);

      // Process earnings data
      let totalEarnings = 0;
      let pendingEarnings = 0;
      let paidEarnings = 0;

      earnings.forEach(earning => {
        totalEarnings += earning.totalAmount;
        if (earning._id === 'pending' || earning._id === 'approved') {
          pendingEarnings += earning.totalAmount;
        } else if (earning._id === 'paid') {
          paidEarnings += earning.totalAmount;
        }
      });

      const conversionRate = totalReferrals > 0 ? (activeReferrals / totalReferrals) * 100 : 0;

      return {
        totalReferrals,
        activeReferrals,
        totalEarnings,
        pendingEarnings,
        paidEarnings,
        conversionRate,
        thisMonthReferrals: thisMonthData.referrals,
        thisMonthEarnings: thisMonthData.earnings
      };
    } catch (error) {
      logger.error('Failed to get user referral stats', { userId, error });
      throw error;
    }
  }

  /**
   * Get this month's referral statistics
   */
  private async getThisMonthStats(userId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [referrals, earnings] = await Promise.all([
      User.countDocuments({ 
        referredBy: userId,
        referralDate: { $gte: startOfMonth }
      }),
      ReferralEarning.aggregate([
        {
          $match: {
            referrerId: userId,
            createdAt: { $gte: startOfMonth }
          }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$earningAmount' }
          }
        }
      ])
    ]);

    return {
      referrals,
      earnings: earnings[0]?.totalEarnings || 0
    };
  }

  /**
   * Get user's referral link
   */
  async getUserReferralLink(userId: string): Promise<IReferralLink | null> {
    try {
      return await ReferralLink.findOne({ userId });
    } catch (error) {
      logger.error('Failed to get user referral link', { userId, error });
      throw error;
    }
  }

  /**
   * Get eligible earnings for payout
   */
  async getEligibleEarnings(userId: string): Promise<IReferralEarning[]> {
    try {
      const now = new Date();
      return await ReferralEarning.find({
        referrerId: userId,
        status: 'pending',
        eligibleForPayoutAt: { $lte: now }
      }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Failed to get eligible earnings', { userId, error });
      throw error;
    }
  }

  /**
   * Create payout request
   */
  async createPayoutRequest(userId: string, payoutData: PayoutRequestData): Promise<IReferralPayoutRequest> {
    try {
      // Get eligible earnings
      const eligibleEarnings = await this.getEligibleEarnings(userId);
      const totalEligible = eligibleEarnings.reduce((sum, earning) => sum + earning.earningAmount, 0);

      if (payoutData.requestedAmount > totalEligible) {
        throw new Error('Requested amount exceeds eligible earnings');
      }

      // Select earnings to include in payout (FIFO)
      let remainingAmount = payoutData.requestedAmount;
      const selectedEarnings: string[] = [];

      for (const earning of eligibleEarnings) {
        if (remainingAmount <= 0) break;
        
        selectedEarnings.push((earning._id as any).toString());
        remainingAmount -= earning.earningAmount;
        
        if (remainingAmount <= 0) break;
      }

      // Create payout request
      const payoutRequest = new ReferralPayoutRequest({
        referrerId: userId,
        requestedAmount: payoutData.requestedAmount,
        currency: payoutData.currency,
        earningIds: selectedEarnings,
        paymentMethod: payoutData.paymentMethod,
        paymentDetails: payoutData.paymentDetails,
        status: 'pending'
      });

      await payoutRequest.save();

      // Update earnings status to approved (reserved for this payout)
      await ReferralEarning.updateMany(
        { _id: { $in: selectedEarnings } },
        { status: 'approved' }
      );

      logger.info('Payout request created', { 
        userId, 
        requestedAmount: payoutData.requestedAmount,
        earningsCount: selectedEarnings.length
      });

      return payoutRequest;
    } catch (error) {
      logger.error('Failed to create payout request', { userId, payoutData, error });
      throw error;
    }
  }

  /**
   * Admin: Get referral overview
   */
  async getAdminReferralOverview(): Promise<AdminReferralOverview> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [
        totalReferrers,
        activeReferrers,
        totalEarnings,
        pendingPayouts,
        thisMonthStats
      ] = await Promise.all([
        ReferralCommissionSettings.countDocuments({ isActive: true }),
        ReferralEarning.distinct('referrerId').then(ids => ids.length),
        ReferralEarning.aggregate([
          { $group: { _id: null, total: { $sum: '$earningAmount' } } }
        ]).then(result => result[0]?.total || 0),
        ReferralPayoutRequest.aggregate([
          { $match: { status: 'pending' } },
          { $group: { _id: null, total: { $sum: '$requestedAmount' } } }
        ]).then(result => result[0]?.total || 0),
        this.getAdminThisMonthStats(startOfMonth)
      ]);

      return {
        totalReferrers,
        activeReferrers,
        totalEarnings,
        pendingPayouts,
        thisMonthStats
      };
    } catch (error) {
      logger.error('Failed to get admin referral overview', { error });
      throw error;
    }
  }

  /**
   * Admin: Get this month's stats
   */
  private async getAdminThisMonthStats(startOfMonth: Date) {
    const [newReferrers, totalEarnings, conversions] = await Promise.all([
      ReferralCommissionSettings.countDocuments({ 
        createdAt: { $gte: startOfMonth } 
      }),
      ReferralEarning.aggregate([
        { $match: { createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$earningAmount' } } }
      ]).then(result => result[0]?.total || 0),
      ReferralEarning.countDocuments({ 
        createdAt: { $gte: startOfMonth } 
      })
    ]);

    return { newReferrers, totalEarnings, conversions };
  }

  /**
   * Admin: Update commission settings
   */
  async updateCommissionSettings(
    userId: string, 
    updates: Partial<IReferralCommissionSettings>
  ): Promise<IReferralCommissionSettings> {
    try {
      const settings = await ReferralCommissionSettings.findOneAndUpdate(
        { userId },
        { ...updates, customRates: true },
        { new: true, upsert: true }
      );

      logger.info('Commission settings updated', { userId, updates });
      return settings!;
    } catch (error) {
      logger.error('Failed to update commission settings', { userId, updates, error });
      throw error;
    }
  }

  /**
   * Get user's referral earnings with pagination
   */
  async getUserReferralEarnings(query: any, skip: number, limit: number): Promise<IReferralEarning[]> {
    try {
      return await ReferralEarning.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
    } catch (error) {
      logger.error('Failed to get user referral earnings', { query, error });
      throw error;
    }
  }

  /**
   * Get count of user's referral earnings
   */
  async getUserReferralEarningsCount(query: any): Promise<number> {
    try {
      return await ReferralEarning.countDocuments(query);
    } catch (error) {
      logger.error('Failed to get user referral earnings count', { query, error });
      throw error;
    }
  }

  /**
   * Get user's payout requests
   */
  async getUserPayoutRequests(userId: string, page: number, limit: number): Promise<any> {
    try {
      const skip = (page - 1) * limit;
      
      const [payouts, total] = await Promise.all([
        ReferralPayoutRequest.find({ referrerId: userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        ReferralPayoutRequest.countDocuments({ referrerId: userId })
      ]);

      return {
        payouts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user payout requests', { userId, error });
      throw error;
    }
  }

  /**
   * Admin: Get all referrers with performance data
   */
  async getAdminReferrers(filters: ReferralFilters & { page: number; limit: number }): Promise<any> {
    try {
      const { userType, status, sortBy = 'recent_activity', sortOrder = 'desc', page, limit } = filters;
      const skip = (page - 1) * limit;

      // Build match query
      const matchQuery: any = {};
      if (userType) matchQuery.userType = userType;
      if (status === 'active') matchQuery.isActive = true;
      if (status === 'inactive') matchQuery.isActive = false;

      // Build sort query
      let sortQuery: any = { createdAt: -1 }; // default
      switch (sortBy) {
        case 'earnings':
          sortQuery = { totalEarnings: sortOrder === 'asc' ? 1 : -1 };
          break;
        case 'referrals':
          sortQuery = { totalReferrals: sortOrder === 'asc' ? 1 : -1 };
          break;
        case 'conversion_rate':
          sortQuery = { conversionRate: sortOrder === 'asc' ? 1 : -1 };
          break;
      }

      const [referrers, total] = await Promise.all([
        this.getAggregatedReferrers(matchQuery, sortQuery, skip, limit),
        ReferralCommissionSettings.countDocuments(matchQuery)
      ]);

      return {
        referrers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get admin referrers', { filters, error });
      throw error;
    }
  }

  /**
   * Get aggregated referrer performance data
   */
  private async getAggregatedReferrers(matchQuery: any, sortQuery: any, skip: number, limit: number) {
    return await ReferralCommissionSettings.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'referral_earnings',
          localField: 'userId',
          foreignField: 'referrerId',
          as: 'earnings'
        }
      },
      {
        $addFields: {
          totalEarnings: { $sum: '$earnings.earningAmount' },
          pendingEarnings: {
            $sum: {
              $filter: {
                input: '$earnings',
                cond: { $eq: ['$$this.status', 'pending'] }
              }
            }
          },
          totalReferrals: { $size: '$earnings' },
          activeReferrals: {
            $size: {
              $setUnion: ['$earnings.referredUserId', []]
            }
          }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: {
              if: { $gt: ['$totalReferrals', 0] },
              then: { $multiply: [{ $divide: ['$activeReferrals', '$totalReferrals'] }, 100] },
              else: 0
            }
          }
        }
      },
      {
        $project: {
          userId: '$userId',
          userName: '$user.name',
          userEmail: '$user.email',
          userType: '$userType',
          totalReferrals: 1,
          activeReferrals: 1,
          totalEarnings: 1,
          pendingEarnings: 1,
          conversionRate: 1,
          lastActivity: '$updatedAt',
          joinedAt: '$createdAt'
        }
      },
      { $sort: sortQuery },
      { $skip: skip },
      { $limit: limit }
    ]);
  }

  /**
   * Admin: Get payout requests
   */
  async getAdminPayoutRequests(filters: { status?: string; page: number; limit: number }): Promise<any> {
    try {
      const { status, page, limit } = filters;
      const skip = (page - 1) * limit;

      const matchQuery: any = {};
      if (status) matchQuery.status = status;

      const [payouts, total] = await Promise.all([
        ReferralPayoutRequest.aggregate([
          { $match: matchQuery },
          {
            $lookup: {
              from: 'users',
              localField: 'referrerId',
              foreignField: '_id',
              as: 'referrer'
            }
          },
          { $unwind: '$referrer' },
          {
            $project: {
              referrerId: 1,
              referrerName: '$referrer.name',
              referrerEmail: '$referrer.email',
              requestedAmount: 1,
              currency: 1,
              status: 1,
              paymentMethod: 1,
              adminNote: 1,
              processedAt: 1,
              createdAt: 1
            }
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit }
        ]),
        ReferralPayoutRequest.countDocuments(matchQuery)
      ]);

      return {
        payouts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get admin payout requests', { filters, error });
      throw error;
    }
  }

  /**
   * Admin: Process payout request
   */
  async processPayoutRequest(
    payoutId: string, 
    updates: UpdatePayoutRequest,
    adminUserId: string
  ): Promise<IReferralPayoutRequest> {
    try {
      const payout = await ReferralPayoutRequest.findByIdAndUpdate(
        payoutId,
        {
          ...updates,
          processedAt: new Date(),
          processedBy: adminUserId
        },
        { new: true }
      );

      if (!payout) {
        throw new Error('Payout request not found');
      }

      // Update earnings status based on payout decision
      let earningStatus: string;
      if (updates.status === 'approved' || updates.status === 'paid') {
        earningStatus = updates.status;
      } else {
        earningStatus = 'pending'; // Reset to pending if rejected/cancelled
      }

      await ReferralEarning.updateMany(
        { _id: { $in: payout.earningIds } },
        { status: earningStatus }
      );

      logger.info('Payout request processed', { 
        payoutId, 
        status: updates.status,
        adminUserId 
      });

      return payout;
    } catch (error) {
      logger.error('Failed to process payout request', { payoutId, updates, error });
      throw error;
    }
  }
}

export const referralService = new ReferralService();