import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as emailController from '../controllers/emailController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';

const router = Router();

// ==========================================
// Validation Schemas
// ==========================================

const createTemplateValidation = [
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
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['welcome', 'challenge', 'nurture', 'sales', 'transactional', 'notification', 'other'])
    .withMessage('Invalid category'),
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('htmlContent')
    .notEmpty()
    .withMessage('HTML content is required'),
  body('textContent')
    .optional()
    .isString()
    .withMessage('Text content must be a string'),
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const updateTemplateValidation = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('subject')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Subject must be less than 200 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'active', 'archived'])
    .withMessage('Invalid status'),
];

const createSequenceValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('triggerType')
    .notEmpty()
    .withMessage('Trigger type is required')
    .isIn(['challenge_signup', 'funnel_entry', 'lead_capture', 'purchase', 'manual'])
    .withMessage('Invalid trigger type'),
  body('emails')
    .isArray({ min: 1 })
    .withMessage('At least one email is required'),
  body('emails.*.order')
    .isInt({ min: 0 })
    .withMessage('Email order must be a non-negative integer'),
  body('emails.*.templateId')
    .notEmpty()
    .withMessage('Template ID is required for each email'),
  body('emails.*.delayHours')
    .isInt({ min: 0 })
    .withMessage('Delay hours must be a non-negative integer'),
];

const sendEmailValidation = [
  body('to')
    .notEmpty()
    .withMessage('Recipient email is required')
    .isEmail()
    .withMessage('Invalid email format'),
  body('toName')
    .optional()
    .isString()
    .withMessage('Recipient name must be a string'),
  body('templateId')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),
  body('subject')
    .optional()
    .isString()
    .withMessage('Subject must be a string'),
  body('html')
    .optional()
    .isString()
    .withMessage('HTML content must be a string'),
];

const bulkEmailValidation = [
  body('recipients')
    .isArray({ min: 1, max: 1000 })
    .withMessage('Recipients must be an array with 1-1000 items'),
  body('recipients.*.email')
    .isEmail()
    .withMessage('Each recipient must have a valid email'),
  body('templateId')
    .notEmpty()
    .withMessage('Template ID is required')
    .isMongoId()
    .withMessage('Invalid template ID'),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID'),
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
];

// ==========================================
// Dashboard Stats Route
// ==========================================

// Get email dashboard statistics
router.get(
  '/stats',
  authenticate,
  requireAdmin,
  emailController.getEmailDashboardStats
);

// ==========================================
// Email Template Routes
// ==========================================

// List templates
router.get(
  '/templates',
  authenticate,
  requireAdmin,
  listQueryValidation,
  emailController.listTemplates
);

// Create template
router.post(
  '/templates',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_EMAIL_TEMPLATE'),
  createTemplateValidation,
  emailController.createTemplate
);

// Get template by ID
router.get(
  '/templates/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  emailController.getTemplate
);

// Update template
router.put(
  '/templates/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_EMAIL_TEMPLATE'),
  idParamValidation,
  updateTemplateValidation,
  emailController.updateTemplate
);

// Delete template
router.delete(
  '/templates/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_EMAIL_TEMPLATE'),
  idParamValidation,
  emailController.deleteTemplate
);

// Preview template
router.post(
  '/templates/:id/preview',
  authenticate,
  requireAdmin,
  idParamValidation,
  emailController.previewTemplate
);

// Send test email
router.post(
  '/templates/:id/test',
  authenticate,
  requireAdmin,
  logAdminAction('SEND_TEST_EMAIL'),
  idParamValidation,
  body('testEmail').isEmail().withMessage('Valid test email is required'),
  emailController.sendTestEmail
);

// ==========================================
// Email Sequence Routes
// ==========================================

// List sequences
router.get(
  '/sequences',
  authenticate,
  requireAdmin,
  listQueryValidation,
  emailController.listSequences
);

// Create sequence
router.post(
  '/sequences',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_EMAIL_SEQUENCE'),
  createSequenceValidation,
  emailController.createSequence
);

// Get sequence by ID
router.get(
  '/sequences/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  emailController.getSequence
);

// Update sequence
router.put(
  '/sequences/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_EMAIL_SEQUENCE'),
  idParamValidation,
  emailController.updateSequence
);

// Delete sequence
router.delete(
  '/sequences/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_EMAIL_SEQUENCE'),
  idParamValidation,
  emailController.deleteSequence
);

// ==========================================
// Direct Email Sending Routes
// ==========================================

// Send single email
router.post(
  '/send',
  authenticate,
  requireAdmin,
  logAdminAction('SEND_EMAIL'),
  sendEmailValidation,
  emailController.sendEmail
);

// Send bulk email
router.post(
  '/bulk',
  authenticate,
  requireAdmin,
  logAdminAction('SEND_BULK_EMAIL'),
  bulkEmailValidation,
  emailController.sendBulkEmail
);

// ==========================================
// Internal Service Routes (no authentication)
// ==========================================

// Internal email sending for service-to-service communication
// Requires x-internal-service header
router.post(
  '/internal/send',
  [
    body('to')
      .notEmpty()
      .withMessage('Recipient email is required')
      .isEmail()
      .withMessage('Invalid email format'),
    body('subject')
      .notEmpty()
      .withMessage('Subject is required'),
    body('html')
      .notEmpty()
      .withMessage('HTML content is required'),
  ],
  emailController.sendInternalEmail
);

export default router;
