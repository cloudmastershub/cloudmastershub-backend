import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { getAdminStats } from '../controllers/adminController';
import { UserRole } from '../models/User';

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

export default router;