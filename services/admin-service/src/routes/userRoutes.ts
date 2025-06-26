import { Router } from 'express';
import {
  getUsers,
  getUserById,
  manageUser,
  getInstructorApplications,
  reviewInstructorApplication,
  getUserStats,
  bulkUserAction
} from '../controllers/userController';
import { requireAdmin, requirePermission, logAdminAction } from '../middleware/adminAuth';
import {
  validateUserList,
  validateUserAction,
  validateInstructorAction
} from '../middleware/validation';
import { AdminPermission } from '@cloudmastershub/types';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// User list and details
router.get('/', 
  requirePermission(AdminPermission.MANAGE_USERS),
  validateUserList,
  logAdminAction('VIEW_USERS'),
  getUsers
);

router.get('/stats',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  logAdminAction('VIEW_USER_STATS'),
  getUserStats
);

router.get('/:userId',
  requirePermission(AdminPermission.MANAGE_USERS),
  logAdminAction('VIEW_USER_DETAILS'),
  getUserById
);

// User management actions
router.put('/:userId/status',
  requirePermission(AdminPermission.MANAGE_USERS),
  validateUserAction,
  logAdminAction('MANAGE_USER_STATUS'),
  manageUser
);

router.post('/bulk-action',
  requirePermission(AdminPermission.MANAGE_USERS),
  logAdminAction('BULK_USER_ACTION'),
  bulkUserAction
);

// Instructor application management
router.get('/instructors/applications',
  requirePermission(AdminPermission.MANAGE_USERS),
  logAdminAction('VIEW_INSTRUCTOR_APPLICATIONS'),
  getInstructorApplications
);

router.put('/instructors/applications/:applicationId',
  requirePermission(AdminPermission.MANAGE_USERS),
  validateInstructorAction,
  logAdminAction('REVIEW_INSTRUCTOR_APPLICATION'),
  reviewInstructorApplication
);

export default router;