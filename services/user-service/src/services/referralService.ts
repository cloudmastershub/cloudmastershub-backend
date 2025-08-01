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
      // Check if referral already exists
      const existingLink = await ReferralLink.findOne({ userId });
      if (existingLink) {
        return {
          referralLink: existingLink.referralCode,
          commissionSettings: await ReferralCommissionSettings.findOne({ userId })
        };
      }

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
        referrerId: referralLink.userId,
        referralCode: referralCode
      });

      // Increment conversions count
      referralLink.conversions += 1;
      await referralLink.save();

      logger.info('Referral signup recorded', { 
        referredUserId, 
        referrerId: referralLink.userId, 
        referralCode 
      });

      return referralLink;
    } catch (error) {
      logger.error('Failed to record referral signup', { referredUserId, referralCode, error });
      throw error;
    }
  }

  /**
   * Create referral earning
   */
  async createReferralEarning(data: CreateReferralEarningRequest & { referrerId: string }) {
    try {
      const { referrerId, referredUserId, transactionId, transactionType, grossAmount, currency } = data;

      // Get commission settings for referrer
      const commissionSettings = await ReferralCommissionSettings.findOne({ 
        userId: referrerId, 
        isActive: true 
      });

      if (!commissionSettings) {
        throw new Error('No active commission settings found for referrer');
      }

      // Determine earning type and rate
      const isInitialPurchase = await this.isInitialPurchaseForUser(referredUserId);
      const earningType = isInitialPurchase ? 'initial' : 'recurring';
      const commissionRate = earningType === 'initial' 
        ? commissionSettings.initialCommissionRate 
        : commissionSettings.recurringCommissionRate;

      // Calculate earning amount
      const earningAmount = (grossAmount * commissionRate) / 100;

      // Create earning record
      const earning = new ReferralEarning({
        referrerId,
        referredUserId,
        transactionId,
        transactionType,
        earningType,
        grossAmount,
        commissionRate,
        earningAmount,
        currency,
        status: 'pending'
      });

      await earning.save();

      logger.info('Referral earning created', {
        earningId: earning._id,
        referrerId,
        earningAmount,
        commissionRate
      });

      return earning;
    } catch (error) {
      logger.error('Failed to create referral earning', { data, error });
      throw error;
    }
  }

  /**
   * Check if this is the first purchase for a referred user
   */
  private async isInitialPurchaseForUser(referredUserId: string): Promise<boolean> {
    const existingEarnings = await ReferralEarning.countDocuments({ referredUserId });
    return existingEarnings === 0;
  }

  /**
   * Get user's referral link
   */
  async getUserReferralLink(userId: string): Promise<IReferralLink | null> {
    try {
      let referralLink = await ReferralLink.findOne({ userId });
      
      if (!referralLink) {
        // Auto-initialize if not exists
        const initResult = await this.initializeUserReferral(userId);
        referralLink = await ReferralLink.findOne({ userId });
      }

      return referralLink;
    } catch (error) {
      logger.error('Failed to get user referral link', { userId, error });
      throw error;
    }
  }

  /**
   * Get user's referral statistics
   */
  async getUserReferralStats(userId: string): Promise<ReferralStats> {
    try {
      // Get all referred users
      const referredUsers = await User.find({ referrerId: userId }).select('_id isActive createdAt');
      const totalReferrals = referredUsers.length;
      const activeReferrals = referredUsers.filter(user => user.isActive !== false).length;

      // Get all earnings for this user
      const earnings = await ReferralEarning.find({ referrerId: userId });
      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.earningAmount, 0);
      const pendingEarnings = earnings
        .filter(earning => earning.status === 'pending' || earning.status === 'approved')
        .reduce((sum, earning) => sum + earning.earningAmount, 0);
      const paidEarnings = earnings
        .filter(earning => earning.status === 'paid')
        .reduce((sum, earning) => sum + earning.earningAmount, 0);

      // Calculate conversion rate (users who made a purchase)
      const usersWithPurchases = new Set(earnings.map(earning => earning.referredUserId));
      const conversionRate = totalReferrals > 0 ? (usersWithPurchases.size / totalReferrals) * 100 : 0;

      // This month stats
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const thisMonthReferrals = referredUsers.filter(user => 
        new Date(user.createdAt) >= thisMonthStart
      ).length;

      const thisMonthEarnings = earnings
        .filter(earning => new Date(earning.createdAt) >= thisMonthStart)
        .reduce((sum, earning) => sum + earning.earningAmount, 0);

      return {
        totalReferrals,
        activeReferrals,
        totalEarnings,
        pendingEarnings,
        paidEarnings,
        conversionRate,
        thisMonthReferrals,
        thisMonthEarnings
      };
    } catch (error) {
      logger.error('Failed to get user referral stats', { userId, error });
      throw error;
    }
  }

  /**
   * Get earnings eligible for payout
   */
  async getEligibleEarnings(userId: string): Promise<IReferralEarning[]> {
    try {
      const now = new Date();
      return await ReferralEarning.find({
        referrerId: userId,
        status: 'approved',
        eligibleForPayoutAt: { $lte: now }
      }).sort({ createdAt: 1 });
    } catch (error) {
      logger.error('Failed to get eligible earnings', { userId, error });
      throw error;
    }
  }

  /**
   * Get user's referral earnings with filtering
   */
  async getUserReferralEarnings(
    userId: string, 
    filters: EarningFilters & { page: number; limit: number }
  ) {
    try {
      const { status, earningType, dateFrom, dateTo, page, limit } = filters;
      
      // Build query
      const query: any = { referrerId: userId };
      
      if (status) {
        query.status = status;
      }
      
      if (earningType) {
        query.earningType = earningType;
      }
      
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Execute queries
      const [earnings, total] = await Promise.all([
        ReferralEarning.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        ReferralEarning.countDocuments(query)
      ]);

      return {
        earnings,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Failed to get user referral earnings', { userId, filters, error });
      throw error;
    }
  }

  /**
   * Create payout request
   */
  async createPayoutRequest(userId: string, payoutData: PayoutRequestData) {
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

      // Update earning status to prevent double payouts
      await ReferralEarning.updateMany(
        { _id: { $in: selectedEarnings } },
        { status: 'approved' }
      );

      logger.info('Payout request created', {
        payoutId: payoutRequest._id,
        userId,
        requestedAmount: payoutData.requestedAmount
      });

      return payoutRequest;
    } catch (error) {
      logger.error('Failed to create payout request', { userId, payoutData, error });
      throw error;
    }
  }

  /**
   * Get user's payout requests
   */
  async getUserPayoutRequests(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ) {
    try {
      const [payouts, total] = await Promise.all([
        ReferralPayoutRequest.find({ referrerId: userId })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
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
   * Admin: Get referral overview
   */
  async getAdminReferralOverview(): Promise<AdminReferralOverview> {
    try {
      // Get all users with referral links
      const totalReferrers = await ReferralLink.countDocuments();
      
      // Active referrers (those who have at least one earning or recent activity)
      const activeReferrersQuery = await ReferralEarning.distinct('referrerId');
      const activeReferrers = activeReferrersQuery.length;

      // Total earnings across platform
      const allEarnings = await ReferralEarning.find().lean();
      const totalEarnings = allEarnings.reduce((sum, earning) => sum + earning.earningAmount, 0);

      // Pending payouts
      const pendingPayouts = await ReferralPayoutRequest.find({ 
        status: { $in: ['pending', 'approved'] } 
      }).lean();
      const pendingPayoutAmount = pendingPayouts.reduce((sum, payout) => sum + payout.requestedAmount, 0);

      // This month stats
      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const newReferrers = await ReferralLink.countDocuments({
        createdAt: { $gte: thisMonthStart }
      });

      const thisMonthEarnings = allEarnings
        .filter(earning => new Date(earning.createdAt) >= thisMonthStart)
        .reduce((sum, earning) => sum + earning.earningAmount, 0);

      const conversions = await ReferralEarning.countDocuments({
        createdAt: { $gte: thisMonthStart }
      });

      return {
        totalReferrers,
        activeReferrers,
        totalEarnings,
        pendingPayouts: pendingPayoutAmount,
        thisMonthStats: {
          newReferrers,
          totalEarnings: thisMonthEarnings,
          conversions
        }
      };
    } catch (error) {
      logger.error('Failed to get admin referral overview', { error });
      throw error;
    }
  }

  /**
   * Admin: Get all referrers with performance data
   */
  async getAdminReferrers(
    filters: ReferralFilters & { page: number; limit: number }
  ) {
    try {
      const { userType, status, sortBy = 'recent_activity', sortOrder = 'desc', page, limit } = filters;

      // Build aggregation pipeline
      const pipeline: any[] = [
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: '$user'
        }
      ];

      // Add filters
      const matchConditions: any = {};
      if (userType) {
        matchConditions['user.subscriptionTier'] = userType === 'subscribed' ? { $ne: 'free' } : 'free';
      }
      if (status) {
        matchConditions['user.isActive'] = status === 'active';
      }

      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }

      // Add earnings data
      pipeline.push(
        {
          $lookup: {
            from: 'referral_earnings',
            localField: 'userId',
            foreignField: 'referrerId',
            as: 'earnings'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: 'referrerId',
            as: 'referredUsers'
          }
        }
      );

      // Project final shape
      pipeline.push({
        $project: {
          userId: '$userId',
          userName: '$user.name',
          userEmail: '$user.email',
          userType: {
            $cond: {
              if: { $ne: ['$user.subscriptionTier', 'free'] },
              then: 'subscribed',
              else: 'normal'
            }
          },
          totalReferrals: { $size: '$referredUsers' },
          activeReferrals: {
            $size: {
              $filter: {
                input: '$referredUsers',
                cond: { $ne: ['$$this.isActive', false] }
              }
            }
          },
          totalEarnings: { $sum: '$earnings.earningAmount' },
          pendingEarnings: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$earnings',
                    cond: { $in: ['$$this.status', ['pending', 'approved']] }
                  }
                },
                in: '$$this.earningAmount'
              }
            }
          },
          conversionRate: {
            $cond: {
              if: { $gt: [{ $size: '$referredUsers' }, 0] },
              then: {
                $multiply: [
                  {
                    $divide: [
                      { $size: { $setUnion: ['$earnings.referredUserId', []] } },
                      { $size: '$referredUsers' }
                    ]
                  },
                  100
                ]
              },
              else: 0
            }
          },
          lastActivity: '$lastUsed',
          joinedAt: '$createdAt'
        }
      });

      // Add sorting
      const sortField = this.mapSortField(sortBy);
      const sortDirection = sortOrder === 'desc' ? -1 : 1;
      pipeline.push({ $sort: { [sortField]: sortDirection } });

      // Execute aggregation with pagination
      const [referrers, totalCount] = await Promise.all([
        ReferralLink.aggregate([
          ...pipeline,
          { $skip: (page - 1) * limit },
          { $limit: limit }
        ]),
        ReferralLink.aggregate([
          ...pipeline,
          { $count: 'total' }
        ])
      ]);

      const total = totalCount[0]?.total || 0;

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
   * Map sort field names
   */
  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      'earnings': 'totalEarnings',
      'referrals': 'totalReferrals',
      'conversion_rate': 'conversionRate',
      'recent_activity': 'lastActivity'
    };
    return fieldMap[sortBy] || 'lastActivity';
  }

  /**
   * Admin: Get payout requests
   */
  async getAdminPayoutRequests(
    status?: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const query: any = {};
      if (status && status !== 'all') {
        query.status = status;
      }

      const [payouts, total] = await Promise.all([
        ReferralPayoutRequest.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('referrerId', 'name email')
          .lean(),
        ReferralPayoutRequest.countDocuments(query)
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
      logger.error('Failed to get admin payout requests', { status, error });
      throw error;
    }
  }

  /**
   * Admin: Update payout request
   */
  async updatePayoutRequest(
    payoutId: string,
    updates: UpdatePayoutRequest,
    adminUserId: string
  ) {
    try {
      const payout = await ReferralPayoutRequest.findById(payoutId);
      if (!payout) {
        throw new Error('Payout request not found');
      }

      // Update payout request
      payout.status = updates.status;
      if (updates.adminNote) {
        payout.adminNote = updates.adminNote;
      }
      payout.processedAt = new Date();
      payout.processedBy = adminUserId;

      await payout.save();

      // If approved, mark earnings as paid
      if (updates.status === 'paid') {
        await ReferralEarning.updateMany(
          { _id: { $in: payout.earningIds } },
          { status: 'paid' }
        );
      } else if (updates.status === 'rejected' || updates.status === 'cancelled') {
        // If rejected/cancelled, revert earnings status
        await ReferralEarning.updateMany(
          { _id: { $in: payout.earningIds } },
          { status: 'approved' }
        );
      }

      logger.info('Payout request updated', {
        payoutId,
        status: updates.status,
        adminUserId
      });

      return payout;
    } catch (error) {
      logger.error('Failed to update payout request', { payoutId, updates, error });
      throw error;
    }
  }

  /**
   * Check if referral ID is available
   */
  async checkReferralIdAvailability(referralId: string): Promise<boolean> {
    try {
      const existing = await ReferralLink.findOne({ referralCode: referralId });
      return !existing;
    } catch (error) {
      logger.error('Failed to check referral ID availability', { referralId, error });
      throw error;
    }
  }

  /**
   * Update user's referral ID
   */
  async updateUserReferralId(userId: string, newReferralId: string): Promise<{ referralUrl: string }> {
    try {
      // Check if referral ID is available
      const isAvailable = await this.checkReferralIdAvailability(newReferralId);
      if (!isAvailable) {
        throw new Error('Referral ID is already taken');
      }

      // Find user's existing referral link
      const referralLink = await ReferralLink.findOne({ userId });
      if (!referralLink) {
        throw new Error('Referral link not found for user');
      }

      // Update the referral code
      referralLink.referralCode = newReferralId;
      await referralLink.save();

      const referralUrl = `${process.env.FRONTEND_URL}?ref=${newReferralId}`;

      logger.info('Referral ID updated', {
        userId,
        oldCode: referralLink.referralCode,
        newCode: newReferralId
      });

      return { referralUrl };
    } catch (error) {
      logger.error('Failed to update referral ID', { userId, newReferralId, error });
      throw error;
    }
  }

  /**
   * Admin: Update user commission settings
   */
  async updateCommissionSettings(
    userId: string,
    updates: {
      initialCommissionRate?: number;
      recurringCommissionRate?: number;
      paymentModel?: 'recurring' | 'one-time';
      isActive?: boolean;
    }
  ) {
    try {
      const settings = await ReferralCommissionSettings.findOne({ userId });
      if (!settings) {
        throw new Error('Commission settings not found for user');
      }

      // Update fields
      if (updates.initialCommissionRate !== undefined) {
        settings.initialCommissionRate = updates.initialCommissionRate;
        settings.customRates = true;
      }
      if (updates.recurringCommissionRate !== undefined) {
        settings.recurringCommissionRate = updates.recurringCommissionRate;
        settings.customRates = true;
      }
      if (updates.paymentModel !== undefined) {
        settings.paymentModel = updates.paymentModel;
      }
      if (updates.isActive !== undefined) {
        settings.isActive = updates.isActive;
      }

      await settings.save();

      logger.info('Commission settings updated', {
        userId,
        updates
      });

      return settings;
    } catch (error) {
      logger.error('Failed to update commission settings', { userId, updates, error });
      throw error;
    }
  }
}

export const referralService = new ReferralService();