import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { 
  getAdminStats,
  getAdminUsers,
  getAdminUser,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser
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

export default router;