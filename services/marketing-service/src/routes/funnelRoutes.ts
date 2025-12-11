import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as funnelController from '../controllers/funnelController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';
import { FunnelType, FunnelStatus, FunnelStepType, DeliveryMode } from '../models';

const router = Router();

// Validation schemas
const funnelTypeValues = Object.values(FunnelType);
const funnelStatusValues = Object.values(FunnelStatus);
const stepTypeValues = Object.values(FunnelStepType);
const deliveryModeValues = Object.values(DeliveryMode);

const createFunnelValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('slug')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Slug must be less than 100 characters')
    .matches(/^[a-z0-9-]*$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(funnelTypeValues)
    .withMessage(`Type must be one of: ${funnelTypeValues.join(', ')}`),
  body('settings.deliveryMode')
    .optional()
    .isIn(deliveryModeValues)
    .withMessage(`Delivery mode must be one of: ${deliveryModeValues.join(', ')}`),
  body('settings.accessDurationDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Access duration must be a positive integer'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const updateFunnelValidation = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('slug')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Slug must be less than 100 characters')
    .matches(/^[a-z0-9-]*$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('type')
    .optional()
    .isIn(funnelTypeValues)
    .withMessage(`Type must be one of: ${funnelTypeValues.join(', ')}`),
  body('settings.deliveryMode')
    .optional()
    .isIn(deliveryModeValues)
    .withMessage(`Delivery mode must be one of: ${deliveryModeValues.join(', ')}`),
];

const stepValidation = [
  body('id')
    .optional()  // Auto-generated if not provided
    .isString()
    .withMessage('Step ID must be a string'),
  body('name')
    .notEmpty()
    .withMessage('Step name is required')
    .isLength({ max: 200 })
    .withMessage('Step name must be less than 200 characters'),
  body('type')
    .notEmpty()
    .withMessage('Step type is required')
    .isIn(stepTypeValues)
    .withMessage(`Step type must be one of: ${stepTypeValues.join(', ')}`),
  body('landingPageId')
    .optional()  // Can be linked later via landing page builder
    .isString()
    .withMessage('Landing page ID must be a string'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
];

const stepsArrayValidation = [
  body('steps')
    .isArray()
    .withMessage('Steps must be an array'),
  body('steps.*.id')
    .notEmpty()
    .withMessage('Step ID is required'),
  body('steps.*.name')
    .notEmpty()
    .withMessage('Step name is required'),
  body('steps.*.type')
    .isIn(stepTypeValues)
    .withMessage(`Step type must be one of: ${stepTypeValues.join(', ')}`),
  body('steps.*.landingPageId')
    .notEmpty()
    .withMessage('Landing page ID is required'),
  body('steps.*.order')
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
];

const reorderStepsValidation = [
  body('stepIds')
    .isArray({ min: 1 })
    .withMessage('Step IDs array is required'),
  body('stepIds.*')
    .isString()
    .withMessage('Each step ID must be a string'),
];

const listQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(funnelStatusValues)
    .withMessage(`Status must be one of: ${funnelStatusValues.join(', ')}`),
  query('type')
    .optional()
    .isIn(funnelTypeValues)
    .withMessage(`Type must be one of: ${funnelTypeValues.join(', ')}`),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'metrics.totalVisitors', 'metrics.totalLeads'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid funnel ID'),
];

const slugParamValidation = [
  param('slug')
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Invalid slug format'),
];

// ==========================================
// Admin Routes (require authentication)
// ==========================================

// List funnels
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  funnelController.listFunnels
);

// Create funnel
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_FUNNEL'),
  createFunnelValidation,
  funnelController.createFunnel
);

// Get funnel by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  funnelController.getFunnel
);

// Get funnel by slug
router.get(
  '/slug/:slug',
  authenticate,
  requireAdmin,
  slugParamValidation,
  funnelController.getFunnelBySlug
);

// Update funnel
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_FUNNEL'),
  idParamValidation,
  updateFunnelValidation,
  funnelController.updateFunnel
);

// Delete funnel
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_FUNNEL'),
  idParamValidation,
  funnelController.deleteFunnel
);

// Publish funnel
router.post(
  '/:id/publish',
  authenticate,
  requireAdmin,
  logAdminAction('PUBLISH_FUNNEL'),
  idParamValidation,
  funnelController.publishFunnel
);

// Unpublish (pause) funnel
router.post(
  '/:id/unpublish',
  authenticate,
  requireAdmin,
  logAdminAction('UNPUBLISH_FUNNEL'),
  idParamValidation,
  funnelController.unpublishFunnel
);

// Archive funnel
router.post(
  '/:id/archive',
  authenticate,
  requireAdmin,
  logAdminAction('ARCHIVE_FUNNEL'),
  idParamValidation,
  funnelController.archiveFunnel
);

// Duplicate funnel
router.post(
  '/:id/duplicate',
  authenticate,
  requireAdmin,
  logAdminAction('DUPLICATE_FUNNEL'),
  idParamValidation,
  funnelController.duplicateFunnel
);

// Update all funnel steps
router.put(
  '/:id/steps',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_FUNNEL_STEPS'),
  idParamValidation,
  stepsArrayValidation,
  funnelController.updateFunnelSteps
);

// Add step to funnel
router.post(
  '/:id/steps',
  authenticate,
  requireAdmin,
  logAdminAction('ADD_FUNNEL_STEP'),
  idParamValidation,
  stepValidation,
  funnelController.addFunnelStep
);

// Update step in funnel
router.put(
  '/:id/steps/:stepId',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_FUNNEL_STEP'),
  idParamValidation,
  param('stepId').notEmpty().withMessage('Step ID is required'),
  [
    body('name')
      .optional()
      .isLength({ max: 200 })
      .withMessage('Step name must be less than 200 characters'),
    body('type')
      .optional()
      .isIn(stepTypeValues)
      .withMessage(`Step type must be one of: ${stepTypeValues.join(', ')}`),
    body('landingPageId')
      .optional()
      .isString()
      .withMessage('Landing page ID must be a string'),
  ],
  funnelController.updateFunnelStep
);

// Remove step from funnel
router.delete(
  '/:id/steps/:stepId',
  authenticate,
  requireAdmin,
  logAdminAction('REMOVE_FUNNEL_STEP'),
  idParamValidation,
  param('stepId').notEmpty().withMessage('Step ID is required'),
  funnelController.removeFunnelStep
);

// Reorder funnel steps
router.post(
  '/:id/steps/reorder',
  authenticate,
  requireAdmin,
  logAdminAction('REORDER_FUNNEL_STEPS'),
  idParamValidation,
  reorderStepsValidation,
  funnelController.reorderFunnelSteps
);

// Get funnel analytics
router.get(
  '/:id/analytics',
  authenticate,
  requireAdmin,
  idParamValidation,
  funnelController.getFunnelAnalytics
);

// ==========================================
// Public Routes (no authentication)
// ==========================================

const publicRouter = Router();

// Get published funnel by slug
publicRouter.get(
  '/:slug',
  slugParamValidation,
  funnelController.getPublicFunnel
);

export { publicRouter as publicFunnelRouter };
export default router;
