import { Request, Response, NextFunction } from 'express';
import { referralService } from '../services/referralService';
import { AuthRequest } from '@cloudmastershub/types';
import logger from '../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Get user's referral dashboard data
 */
export const getUserReferralDashboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [stats, referralLink, eligibleEarnings] = await Promise.all([
      referralService.getUserReferralStats(userId),
      referralService.getUserReferralLink(userId),
      referralService.getEligibleEarnings(userId)
    ]);

    const eligibleAmount = eligibleEarnings.reduce((sum: number, earning: any) => sum + earning.earningAmount, 0);

    res.json({
      success: true,
      data: {
        stats,
        referralLink: referralLink?.referralCode || null,
        eligibleForPayout: eligibleAmount,
        referralUrl: referralLink ? `${process.env.FRONTEND_URL}?ref=${referralLink.referralCode}` : null
      }
    });
  } catch (error) {
    logger.error('Failed to get user referral dashboard', { userId: req.user?.id, error });
    next(error);
  }
};

/**
 * Get user's referral earnings history
 */
export const getUserReferralEarnings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const userId = req.user!.id;
    const { status, earningType, page = 1, limit = 20 } = req.query;

    const query: any = { referrerId: userId };
    if (status) query.status = status;
    if (earningType) query.earningType = earningType;

    const skip = (Number(page) - 1) * Number(limit);

    const [earnings, total] = await Promise.all([
      referralService.getUserReferralEarnings(query, skip, Number(limit)),
      referralService.getUserReferralEarningsCount(query)
    ]);

    res.json({
      success: true,
      data: {
        earnings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get user referral earnings', { userId: req.user?.id, error });
    next(error);
  }
};

/**
 * Create a payout request
 */
export const createPayoutRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const userId = req.user!.id;
    const payoutData = req.body;

    const payout = await referralService.createPayoutRequest(userId, payoutData);

    res.status(201).json({
      success: true,
      data: payout,
      message: 'Payout request created successfully'
    });
  } catch (error) {
    logger.error('Failed to create payout request', { userId: req.user?.id, error });
    
    if (error instanceof Error && error.message.includes('exceeds eligible earnings')) {
      res.status(400).json({
        success: false,
        message: error.message
      });
      return;
    }
    
    next(error);
  }
};

/**
 * Get user's payout requests
 */
export const getUserPayoutRequests = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { page = 1, limit = 10 } = req.query;

    const payouts = await referralService.getUserPayoutRequests(
      userId, 
      Number(page), 
      Number(limit)
    );

    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    logger.error('Failed to get user payout requests', { userId: req.user?.id, error });
    next(error);
  }
};

/**
 * Track referral click (public endpoint)
 */
export const trackReferralClick = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Invalid referral code'
      });
      return;
    }

    const { referralCode } = req.params;
    
    const referralLink = await referralService.trackReferralClick(referralCode);
    
    if (!referralLink) {
      res.status(404).json({
        success: false,
        message: 'Referral code not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Referral click tracked'
    });
  } catch (error) {
    logger.error('Failed to track referral click', { referralCode: req.params.referralCode, error });
    next(error);
  }
};

/**
 * Record referral signup (called during user registration)
 */
export const recordReferralSignup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { referredUserId, referralCode } = req.body;
    
    const referrerId = await referralService.recordReferralSignup(referredUserId, referralCode);
    
    res.json({
      success: true,
      data: { referrerId },
      message: 'Referral signup recorded'
    });
  } catch (error) {
    logger.error('Failed to record referral signup', { body: req.body, error });
    next(error);
  }
};

/**
 * Admin: Get referral overview
 */
export const getAdminReferralOverview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const overview = await referralService.getAdminReferralOverview();
    
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Failed to get admin referral overview', { error });
    next(error);
  }
};

/**
 * Admin: Get all referrers with performance data
 */
export const getAdminReferrers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userType, status, sortBy, sortOrder, page = 1, limit = 20 } = req.query;
    
    const filters = {
      userType: userType as string,
      status: status as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as string,
      page: Number(page),
      limit: Number(limit)
    };

    const referrers = await referralService.getAdminReferrers(filters);
    
    res.json({
      success: true,
      data: referrers
    });
  } catch (error) {
    logger.error('Failed to get admin referrers', { error });
    next(error);
  }
};

/**
 * Admin: Get all payout requests
 */
export const getAdminPayoutRequests = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const payouts = await referralService.getAdminPayoutRequests({
      status: status as string,
      page: Number(page),
      limit: Number(limit)
    });
    
    res.json({
      success: true,
      data: payouts
    });
  } catch (error) {
    logger.error('Failed to get admin payout requests', { error });
    next(error);
  }
};

/**
 * Admin: Process payout request
 */
export const processPayoutRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { payoutId } = req.params;
    const updates = req.body;
    const adminUserId = req.user!.id;

    const payout = await referralService.processPayoutRequest(payoutId, updates, adminUserId);
    
    res.json({
      success: true,
      data: payout,
      message: `Payout request ${updates.status} successfully`
    });
  } catch (error) {
    logger.error('Failed to process payout request', { payoutId: req.params.payoutId, error });
    next(error);
  }
};

/**
 * Admin: Update user commission settings
 */
export const updateUserCommissionSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const { userId } = req.params;
    const updates = req.body;

    const settings = await referralService.updateCommissionSettings(userId, updates);
    
    res.json({
      success: true,
      data: settings,
      message: 'Commission settings updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update commission settings', { 
      userId: req.params.userId, 
      updates: req.body, 
      error 
    });
    next(error);
  }
};

// Validation middleware
export const validatePayoutRequest = [
  body('requestedAmount').isNumeric().withMessage('Requested amount must be a number'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('paymentMethod').isIn(['paypal', 'bank_transfer', 'stripe']).withMessage('Invalid payment method'),
  body('paymentDetails').notEmpty().withMessage('Payment details are required')
];

export const validateReferralCode = [
  param('referralCode').isLength({ min: 5 }).withMessage('Invalid referral code')
];

export const validateReferralSignup = [
  body('referredUserId').isMongoId().withMessage('Invalid user ID'),
  body('referralCode').isLength({ min: 5 }).withMessage('Invalid referral code')
];

export const validateProcessPayout = [
  param('payoutId').isMongoId().withMessage('Invalid payout ID'),
  body('status').isIn(['approved', 'rejected', 'paid', 'cancelled']).withMessage('Invalid status'),
  body('adminNote').optional().isString().withMessage('Admin note must be a string')
];

export const validateCommissionUpdate = [
  param('userId').isMongoId().withMessage('Invalid user ID'),
  body('initialCommissionRate').optional().isNumeric().isFloat({ min: 0, max: 100 }).withMessage('Initial rate must be 0-100'),
  body('recurringCommissionRate').optional().isNumeric().isFloat({ min: 0, max: 100 }).withMessage('Recurring rate must be 0-100'),
  body('paymentModel').optional().isIn(['recurring', 'one-time']).withMessage('Invalid payment model'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
];