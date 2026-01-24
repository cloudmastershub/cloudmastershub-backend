import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as leadController from '../controllers/leadController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';

const router = Router();

// ==========================================
// Validation Schemas
// ==========================================

const createLeadValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('firstName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('phone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),
  body('company')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Company must be less than 200 characters'),
  body('jobTitle')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Job title must be less than 100 characters'),
  body('source')
    .optional()
    .isObject()
    .withMessage('Source must be an object'),
  body('source.type')
    .optional()
    .isIn(['funnel', 'landing_page', 'popup', 'referral', 'organic', 'paid_ad', 'social', 'email', 'webinar', 'challenge', 'direct', 'api'])
    .withMessage('Invalid source type'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('emailConsent')
    .optional()
    .isBoolean()
    .withMessage('emailConsent must be a boolean'),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
];

const updateLeadValidation = [
  body('firstName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('phone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),
  body('company')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Company must be less than 200 characters'),
  body('jobTitle')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Job title must be less than 100 characters'),
  body('status')
    .optional()
    .isIn(['new', 'engaged', 'qualified', 'converted', 'unsubscribed', 'bounced', 'inactive'])
    .withMessage('Invalid status'),
  body('score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('emailConsent')
    .optional()
    .isBoolean()
    .withMessage('emailConsent must be a boolean'),
  body('customFields')
    .optional()
    .isObject()
    .withMessage('customFields must be an object'),
  body('country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters'),
  body('city')
    .optional()
    .isLength({ max: 100 })
    .withMessage('City must be less than 100 characters'),
  body('timezone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Timezone must be less than 50 characters'),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid lead ID'),
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
    .isIn(['new', 'engaged', 'qualified', 'converted', 'unsubscribed', 'bounced', 'inactive'])
    .withMessage('Invalid status'),
  query('scoreLevel')
    .optional()
    .isIn(['cold', 'warm', 'hot', 'very_hot'])
    .withMessage('Invalid score level'),
  query('source')
    .optional()
    .isIn(['funnel', 'landing_page', 'popup', 'referral', 'organic', 'paid_ad', 'social', 'email', 'webinar', 'challenge', 'direct', 'api'])
    .withMessage('Invalid source'),
  query('sortBy')
    .optional()
    .isIn(['capturedAt', 'createdAt', 'updatedAt', 'score', 'email', 'firstName', 'lastName', 'lastActivityAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Invalid date format'),
];

const searchValidation = [
  body('query')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters'),
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

const addTagValidation = [
  body('tags')
    .isArray({ min: 1 })
    .withMessage('Tags must be a non-empty array'),
  body('tags.*')
    .isString()
    .withMessage('Each tag must be a string')
    .isLength({ max: 50 })
    .withMessage('Each tag must be less than 50 characters'),
];

const bulkUpdateValidation = [
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('leadIds must be a non-empty array'),
  body('leadIds.*')
    .isMongoId()
    .withMessage('Invalid lead ID'),
  body('updates')
    .isObject()
    .withMessage('updates must be an object'),
  body('updates.status')
    .optional()
    .isIn(['new', 'engaged', 'qualified', 'converted', 'unsubscribed', 'bounced', 'inactive'])
    .withMessage('Invalid status'),
  body('updates.score')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),
  body('updates.addTags')
    .optional()
    .isArray()
    .withMessage('addTags must be an array'),
  body('updates.removeTags')
    .optional()
    .isArray()
    .withMessage('removeTags must be an array'),
];

const bulkDeleteValidation = [
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('leadIds must be a non-empty array'),
  body('leadIds.*')
    .isMongoId()
    .withMessage('Invalid lead ID'),
];

const importLeadsValidation = [
  body('leads')
    .isArray({ min: 1 })
    .withMessage('leads must be a non-empty array'),
  body('leads.*.email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('leads.*.firstName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('leads.*.lastName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('leads.*.phone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters'),
  body('leads.*.company')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Company must be less than 200 characters'),
  body('leads.*.tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('source')
    .optional()
    .isIn(['funnel', 'landing_page', 'popup', 'referral', 'organic', 'paid_ad', 'social', 'email', 'webinar', 'challenge', 'direct', 'api'])
    .withMessage('Invalid source'),
];

const mergeLeadsValidation = [
  body('primaryId')
    .isMongoId()
    .withMessage('Invalid primary lead ID'),
  body('secondaryId')
    .isMongoId()
    .withMessage('Invalid secondary lead ID'),
];

// ==========================================
// PUBLIC Lead Routes (no authentication)
// ==========================================

// Capture bootcamp interest - PUBLIC endpoint for curriculum downloads
const bootcampInterestValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('bootcamp_slug')
    .notEmpty()
    .isLength({ max: 100 })
    .withMessage('Bootcamp slug is required'),
  body('firstName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('lastName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
];

router.post(
  '/bootcamp-interest',
  bootcampInterestValidation,
  leadController.captureBootcampInterest
);

// ==========================================
// Protected Lead Routes
// ==========================================

// Get lead statistics (must be before /:id route)
router.get(
  '/stats',
  authenticate,
  requireAdmin,
  leadController.getStats
);

// Get all tags
router.get(
  '/tags',
  authenticate,
  requireAdmin,
  leadController.getAllTags
);

// Export leads
router.get(
  '/export',
  authenticate,
  requireAdmin,
  leadController.exportLeads
);

// List leads
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  leadController.listLeads
);

// Create lead
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_LEAD'),
  createLeadValidation,
  leadController.createLead
);

// Search leads
router.post(
  '/search',
  authenticate,
  requireAdmin,
  searchValidation,
  leadController.searchLeads
);

// Bulk update leads
router.post(
  '/bulk/update',
  authenticate,
  requireAdmin,
  logAdminAction('BULK_UPDATE_LEADS'),
  bulkUpdateValidation,
  leadController.bulkUpdate
);

// Bulk delete leads
router.post(
  '/bulk/delete',
  authenticate,
  requireAdmin,
  logAdminAction('BULK_DELETE_LEADS'),
  bulkDeleteValidation,
  leadController.bulkDelete
);

// Import leads
router.post(
  '/import',
  authenticate,
  requireAdmin,
  logAdminAction('IMPORT_LEADS'),
  importLeadsValidation,
  leadController.importLeads
);

// Merge leads
router.post(
  '/merge',
  authenticate,
  requireAdmin,
  logAdminAction('MERGE_LEADS'),
  mergeLeadsValidation,
  leadController.mergeLeads
);

// Get lead by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  leadController.getLead
);

// Update lead
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_LEAD'),
  idParamValidation,
  updateLeadValidation,
  leadController.updateLead
);

// Delete lead
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_LEAD'),
  idParamValidation,
  leadController.deleteLead
);

// Add tag to lead
router.post(
  '/:id/tags',
  authenticate,
  requireAdmin,
  logAdminAction('ADD_LEAD_TAG'),
  idParamValidation,
  addTagValidation,
  leadController.addTag
);

// Remove tags from lead (accepts array of tags in body)
router.delete(
  '/:id/tags',
  authenticate,
  requireAdmin,
  logAdminAction('REMOVE_LEAD_TAGS'),
  idParamValidation,
  addTagValidation, // Reuse same validation - expects { tags: string[] }
  leadController.removeTags
);

// Remove single tag from lead (legacy - tag in URL)
router.delete(
  '/:id/tags/:tag',
  authenticate,
  requireAdmin,
  logAdminAction('REMOVE_LEAD_TAG'),
  idParamValidation,
  leadController.removeTag
);

export default router;
