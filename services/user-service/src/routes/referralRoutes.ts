import { Router } from 'express';
import { 
  getUserReferralDashboard,
  getUserReferralEarnings,
  createPayoutRequest,
  getUserPayoutRequests,
  trackReferralClick,
  recordReferralSignup,
  checkReferralIdAvailability,
  updateUserReferralId,
  getAdminReferralOverview,
  getAdminReferrers,
  getAdminPayoutRequests,
  processPayoutRequest,
  updateUserCommissionSettings,
  validatePayoutRequest,
  validateReferralCode,
  validateReferralSignup,
  validateProcessPayout,
  validateCommissionUpdate,
  validateReferralIdUpdate,
  validateReferralIdAvailability
} from '../controllers/referralController';
import { authenticate, authorize } from '@cloudmastershub/middleware';

const router = Router();

// Public routes (no authentication required)
// IMPORTANT: These must be defined BEFORE the authenticate middleware
router.get('/track/:referralCode', validateReferralCode, trackReferralClick);
router.post('/signup', validateReferralSignup, recordReferralSignup);

// Apply authentication middleware for all routes below this line
// User routes (authenticated)
router.use(authenticate);

// User referral dashboard
router.get('/dashboard', getUserReferralDashboard);
router.get('/earnings', getUserReferralEarnings);

// Payout management
router.post('/payouts', validatePayoutRequest, createPayoutRequest);
router.get('/payouts', getUserPayoutRequests);

// Referral ID management
router.get('/check-availability/:referralId', validateReferralIdAvailability, checkReferralIdAvailability);
router.patch('/update-id', validateReferralIdUpdate, updateUserReferralId);

// Admin routes
router.use(authorize('admin', 'super_admin'));

// Admin overview and management
router.get('/admin/overview', getAdminReferralOverview);
router.get('/admin/referrers', getAdminReferrers);
router.get('/admin/payouts', getAdminPayoutRequests);

// Admin actions
router.patch('/admin/payouts/:payoutId', validateProcessPayout, processPayoutRequest);
router.patch('/admin/users/:userId/commission', validateCommissionUpdate, updateUserCommissionSettings);

export default router;