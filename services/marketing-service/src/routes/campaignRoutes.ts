import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as campaignController from '../controllers/campaignController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';

const router = Router();

// ==========================================
// Validation Schemas
// ==========================================

const createCampaignValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['broadcast', 'newsletter', 'announcement', 'promotion', 're_engagement'])
    .withMessage('Invalid campaign type'),
  body('templateId')
    .notEmpty()
    .withMessage('Template ID is required')
    .isMongoId()
    .withMessage('Invalid template ID'),
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('fromEmail')
    .notEmpty()
    .withMessage('From email is required')
    .isEmail()
    .withMessage('Invalid from email'),
  body('audience')
    .notEmpty()
    .withMessage('Audience is required'),
  body('audience.type')
    .notEmpty()
    .withMessage('Audience type is required')
    .isIn(['all', 'segment', 'list', 'tag'])
    .withMessage('Invalid audience type'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('preheader')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Preheader must be less than 200 characters'),
  body('fromName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('From name must be less than 100 characters'),
  body('replyTo')
    .optional()
    .isEmail()
    .withMessage('Invalid reply-to email'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('scheduling.sendAt')
    .optional()
    .isISO8601()
    .withMessage('Invalid send date'),
  body('scheduling.timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string'),
  body('abTest.enabled')
    .optional()
    .isBoolean()
    .withMessage('A/B test enabled must be a boolean'),
  body('abTest.winnerCriteria')
    .optional()
    .isIn(['open_rate', 'click_rate'])
    .withMessage('Invalid winner criteria'),
  body('abTest.testDuration')
    .optional()
    .isInt({ min: 1, max: 72 })
    .withMessage('Test duration must be between 1 and 72 hours'),
  body('abTest.testPercentage')
    .optional()
    .isInt({ min: 10, max: 50 })
    .withMessage('Test percentage must be between 10 and 50'),
];

const updateCampaignValidation = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('type')
    .optional()
    .isIn(['broadcast', 'newsletter', 'announcement', 'promotion', 're_engagement'])
    .withMessage('Invalid campaign type'),
  body('templateId')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),
  body('subject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('fromEmail')
    .optional()
    .isEmail()
    .withMessage('Invalid from email'),
  body('audience.type')
    .optional()
    .isIn(['all', 'segment', 'list', 'tag'])
    .withMessage('Invalid audience type'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
];

const scheduleCampaignValidation = [
  body('sendAt')
    .notEmpty()
    .withMessage('Send time is required')
    .isISO8601()
    .withMessage('Invalid send date format'),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid campaign ID'),
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
    .isIn(['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'])
    .withMessage('Invalid status'),
  query('type')
    .optional()
    .isIn(['broadcast', 'newsletter', 'announcement', 'promotion', 're_engagement'])
    .withMessage('Invalid type'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'status', 'scheduling.sendAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order'),
];

// ==========================================
// Campaign Routes
// ==========================================

// List campaigns
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  campaignController.listCampaigns
);

// Create campaign
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_CAMPAIGN'),
  createCampaignValidation,
  campaignController.createCampaign
);

// Get campaign by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  campaignController.getCampaign
);

// Update campaign
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_CAMPAIGN'),
  idParamValidation,
  updateCampaignValidation,
  campaignController.updateCampaign
);

// Delete campaign
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_CAMPAIGN'),
  idParamValidation,
  campaignController.deleteCampaign
);

// Schedule campaign
router.post(
  '/:id/schedule',
  authenticate,
  requireAdmin,
  logAdminAction('SCHEDULE_CAMPAIGN'),
  idParamValidation,
  scheduleCampaignValidation,
  campaignController.scheduleCampaign
);

// Send campaign immediately
router.post(
  '/:id/send',
  authenticate,
  requireAdmin,
  logAdminAction('SEND_CAMPAIGN'),
  idParamValidation,
  campaignController.sendCampaign
);

// Pause campaign
router.post(
  '/:id/pause',
  authenticate,
  requireAdmin,
  logAdminAction('PAUSE_CAMPAIGN'),
  idParamValidation,
  campaignController.pauseCampaign
);

// Cancel campaign
router.post(
  '/:id/cancel',
  authenticate,
  requireAdmin,
  logAdminAction('CANCEL_CAMPAIGN'),
  idParamValidation,
  campaignController.cancelCampaign
);

// Get campaign statistics
router.get(
  '/:id/stats',
  authenticate,
  requireAdmin,
  idParamValidation,
  campaignController.getCampaignStats
);

// Preview campaign
router.post(
  '/:id/preview',
  authenticate,
  requireAdmin,
  idParamValidation,
  campaignController.previewCampaign
);

// Duplicate campaign
router.post(
  '/:id/duplicate',
  authenticate,
  requireAdmin,
  logAdminAction('DUPLICATE_CAMPAIGN'),
  idParamValidation,
  campaignController.duplicateCampaign
);

export default router;
