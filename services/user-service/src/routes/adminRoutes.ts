import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
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

export default router;