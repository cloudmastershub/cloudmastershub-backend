import { Router } from 'express';
import { 
  getSecurityOverview,
  getSecurityLogs,
  getSecuritySettings,
  updateSecuritySettings,
  createSecurityLog,
  updateSecurityLogStatus,
  getSecurityAnalytics,
  runSecurityScan
} from '../controllers/securityController';
import { adminAuth } from '../middleware/adminAuth';
import { validateRequest } from '../middleware/validation';

const router = Router();

// Apply admin authentication to all security routes
router.use(adminAuth);

/**
 * @route   GET /admin/security/overview
 * @desc    Get security overview and metrics
 * @access  Admin only
 */
router.get('/overview', getSecurityOverview);

/**
 * @route   GET /admin/security/logs
 * @desc    Get security logs with filtering and pagination
 * @access  Admin only
 * @query   page, limit, severity, status, search
 */
router.get('/logs', getSecurityLogs);

/**
 * @route   GET /admin/security/settings
 * @desc    Get current security settings
 * @access  Admin only
 */
router.get('/settings', getSecuritySettings);

/**
 * @route   PUT /admin/security/settings
 * @desc    Update security settings
 * @access  Admin only
 * @body    SecuritySettings (partial)
 */
router.put('/settings', updateSecuritySettings);

/**
 * @route   POST /admin/security/logs
 * @desc    Create a new security log entry
 * @access  Admin only
 * @body    { event, severity, source, ip, userAgent, details, user? }
 */
router.post('/logs', createSecurityLog);

/**
 * @route   PUT /admin/security/logs/:logId/status
 * @desc    Update security log status
 * @access  Admin only
 * @body    { status: 'open' | 'investigating' | 'resolved' }
 */
router.put('/logs/:logId/status', updateSecurityLogStatus);

/**
 * @route   GET /admin/security/analytics
 * @desc    Get security analytics and trends
 * @access  Admin only
 * @query   timeframe
 */
router.get('/analytics', getSecurityAnalytics);

/**
 * @route   POST /admin/security/scan
 * @desc    Run security scan
 * @access  Admin only
 */
router.post('/scan', runSecurityScan);

export default router;