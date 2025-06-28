import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  getFeatureFlags,
  updateFeatureFlag,
  createFeatureFlag,
  deleteFeatureFlag,
  getSystemConfiguration,
  maintenanceMode,
} from '../controllers/settingsController';
import { requireAdmin, requirePermission, logAdminAction } from '../middleware/adminAuth';
import { validateSettingsUpdate, validateFeatureFlagUpdate } from '../middleware/validation';
import { AdminPermission } from '@cloudmastershub/types';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Platform settings
router.get(
  '/',
  requirePermission(AdminPermission.MANAGE_SETTINGS),
  logAdminAction('VIEW_PLATFORM_SETTINGS'),
  getSettings
);

router.put(
  '/',
  requirePermission(AdminPermission.MANAGE_SETTINGS),
  validateSettingsUpdate,
  logAdminAction('UPDATE_PLATFORM_SETTINGS'),
  updateSettings
);

// Feature flags management
router.get(
  '/feature-flags',
  requirePermission(AdminPermission.MANAGE_SETTINGS),
  logAdminAction('VIEW_FEATURE_FLAGS'),
  getFeatureFlags
);

router.post(
  '/feature-flags',
  requirePermission(AdminPermission.MANAGE_SETTINGS),
  logAdminAction('CREATE_FEATURE_FLAG'),
  createFeatureFlag
);

router.put(
  '/feature-flags/:flagName',
  requirePermission(AdminPermission.MANAGE_SETTINGS),
  validateFeatureFlagUpdate,
  logAdminAction('UPDATE_FEATURE_FLAG'),
  updateFeatureFlag
);

router.delete(
  '/feature-flags/:flagName',
  requirePermission(AdminPermission.MANAGE_SETTINGS),
  logAdminAction('DELETE_FEATURE_FLAG'),
  deleteFeatureFlag
);

// System configuration and maintenance
router.get(
  '/system',
  requirePermission(AdminPermission.SYSTEM_ADMIN),
  logAdminAction('VIEW_SYSTEM_CONFIG'),
  getSystemConfiguration
);

router.put(
  '/maintenance',
  requirePermission(AdminPermission.SYSTEM_ADMIN),
  logAdminAction('UPDATE_MAINTENANCE_MODE'),
  maintenanceMode
);

export default router;
