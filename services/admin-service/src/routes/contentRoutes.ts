import { Router } from 'express';
import {
  getContentForModeration,
  getContentDetails,
  moderateContent,
  getFlaggedContent,
  getContentStats,
  getPopularContent,
  bulkModerateContent,
  getContentModerationQueue
} from '../controllers/contentController';
import { requireAdmin, requirePermission, logAdminAction } from '../middleware/adminAuth';
import {
  validateContentList,
  validateContentAction
} from '../middleware/validation';
import { AdminPermission } from '@cloudmastershub/types';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Content moderation queue overview
router.get('/queue',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('VIEW_MODERATION_QUEUE'),
  getContentModerationQueue
);

// Content list and details
router.get('/',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validateContentList,
  logAdminAction('VIEW_CONTENT_MODERATION'),
  getContentForModeration
);

router.get('/stats',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  logAdminAction('VIEW_CONTENT_STATS'),
  getContentStats
);

router.get('/popular',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  logAdminAction('VIEW_POPULAR_CONTENT'),
  getPopularContent
);

router.get('/flagged',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('VIEW_FLAGGED_CONTENT'),
  getFlaggedContent
);

router.get('/:contentId',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('VIEW_CONTENT_DETAILS'),
  getContentDetails
);

// Content moderation actions
router.put('/:contentId/moderate',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  validateContentAction,
  logAdminAction('MODERATE_CONTENT'),
  moderateContent
);

router.post('/bulk-moderate',
  requirePermission(AdminPermission.MODERATE_CONTENT),
  logAdminAction('BULK_MODERATE_CONTENT'),
  bulkModerateContent
);

export default router;