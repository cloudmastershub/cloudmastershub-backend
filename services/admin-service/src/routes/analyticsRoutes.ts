import { Router } from 'express';
import {
  getDashboardOverview,
  getRevenueAnalytics,
  getSubscriptionAnalytics,
  getEngagementMetrics,
  generateReport,
  getSystemHealth,
  getAnalyticsSummary,
  getRealTimeMetrics,
} from '../controllers/analyticsController';
import { requireAdmin, requirePermission, logAdminAction } from '../middleware/adminAuth';
import { validateAnalyticsRequest, validateReportRequest } from '../middleware/validation';
import { AdminPermission } from '@cloudmastershub/types';

const router = Router();

// All routes require admin authentication
router.use(requireAdmin);

// Dashboard and overview analytics
router.get(
  '/dashboard',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  validateAnalyticsRequest,
  logAdminAction('VIEW_DASHBOARD_ANALYTICS'),
  getDashboardOverview
);

router.get(
  '/summary',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  validateAnalyticsRequest,
  logAdminAction('VIEW_ANALYTICS_SUMMARY'),
  getAnalyticsSummary
);

router.get(
  '/realtime',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  logAdminAction('VIEW_REALTIME_METRICS'),
  getRealTimeMetrics
);

// Financial analytics
router.get(
  '/revenue',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  validateAnalyticsRequest,
  logAdminAction('VIEW_REVENUE_ANALYTICS'),
  getRevenueAnalytics
);

router.get(
  '/subscriptions',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  validateAnalyticsRequest,
  logAdminAction('VIEW_SUBSCRIPTION_ANALYTICS'),
  getSubscriptionAnalytics
);

// Engagement analytics
router.get(
  '/engagement',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  validateAnalyticsRequest,
  logAdminAction('VIEW_ENGAGEMENT_METRICS'),
  getEngagementMetrics
);

// System health monitoring
router.get(
  '/health',
  requirePermission(AdminPermission.SYSTEM_ADMIN),
  logAdminAction('VIEW_SYSTEM_HEALTH'),
  getSystemHealth
);

// Report generation
router.post(
  '/reports/generate',
  requirePermission(AdminPermission.VIEW_ANALYTICS),
  validateReportRequest,
  logAdminAction('GENERATE_REPORT'),
  generateReport
);

export default router;
