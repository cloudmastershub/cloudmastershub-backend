import { Router } from 'express';
import {
  getAllPaths,
  getPathById,
  createPath,
  updatePath,
  deletePath,
  addCourseToPath,
  removeCourseFromPath,
  reorderPathSteps,
  getPathAnalytics,
} from '../controllers/pathController';
import { requireAdmin, requirePermission, logAdminAction } from '../middleware/adminAuth';
import {
  validatePathList,
  validateCreatePath,
  validateUpdatePath,
  validatePathAction,
} from '../middleware/validation';
import { AdminPermission } from '@cloudmastershub/types';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Path list and details
router.get(
  '/',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validatePathList,
  logAdminAction('VIEW_LEARNING_PATHS'),
  getAllPaths
);

router.get(
  '/analytics',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  logAdminAction('VIEW_PATH_ANALYTICS'),
  getPathAnalytics
);

router.get(
  '/:pathId',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('VIEW_PATH_DETAILS'),
  getPathById
);

// Path management actions
router.post(
  '/',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validateCreatePath,
  logAdminAction('CREATE_LEARNING_PATH'),
  createPath
);

router.put(
  '/:pathId',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validateUpdatePath,
  logAdminAction('UPDATE_LEARNING_PATH'),
  updatePath
);

router.delete(
  '/:pathId',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('DELETE_LEARNING_PATH'),
  deletePath
);

// Path step management - support both /steps and /courses endpoints for compatibility
router.post(
  '/:pathId/steps',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validatePathAction,
  logAdminAction('ADD_COURSE_TO_PATH'),
  addCourseToPath
);

router.post(
  '/:pathId/courses',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validatePathAction,
  logAdminAction('ADD_COURSE_TO_PATH'),
  addCourseToPath
);

router.delete(
  '/:pathId/steps/:courseId',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('REMOVE_COURSE_FROM_PATH'),
  removeCourseFromPath
);

router.delete(
  '/:pathId/courses/:courseId',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('REMOVE_COURSE_FROM_PATH'),
  removeCourseFromPath
);

router.put(
  '/:pathId/reorder',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validatePathAction,
  logAdminAction('REORDER_PATH_STEPS'),
  reorderPathSteps
);

export default router;