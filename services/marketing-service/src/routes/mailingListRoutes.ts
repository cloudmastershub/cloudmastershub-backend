import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as mailingListController from '../controllers/mailingListController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';

const router = Router();

// ==========================================
// Validation Schemas
// ==========================================

const createMailingListValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['static', 'dynamic'])
    .withMessage('Type must be either static or dynamic'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('segmentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid segment ID'),
  body('memberIds')
    .optional()
    .isArray()
    .withMessage('memberIds must be an array'),
  body('doubleOptIn')
    .optional()
    .isBoolean()
    .withMessage('doubleOptIn must be a boolean'),
  body('welcomeEmailTemplateId')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const updateMailingListValidation = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('segmentId')
    .optional()
    .isMongoId()
    .withMessage('Invalid segment ID'),
  body('doubleOptIn')
    .optional()
    .isBoolean()
    .withMessage('doubleOptIn must be a boolean'),
  body('welcomeEmailTemplateId')
    .optional()
    .isMongoId()
    .withMessage('Invalid template ID'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid mailing list ID'),
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
  query('type')
    .optional()
    .isIn(['static', 'dynamic'])
    .withMessage('Invalid type'),
  query('status')
    .optional()
    .isIn(['active', 'archived'])
    .withMessage('Invalid status'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'memberCount'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order'),
];

const duplicateValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
];

const addMembersValidation = [
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('leadIds must be a non-empty array'),
  body('leadIds.*')
    .isMongoId()
    .withMessage('Invalid lead ID'),
];

const removeMembersValidation = [
  body('leadIds')
    .isArray({ min: 1 })
    .withMessage('leadIds must be a non-empty array'),
  body('leadIds.*')
    .isMongoId()
    .withMessage('Invalid lead ID'),
];

const importMembersValidation = [
  body('members')
    .isArray({ min: 1 })
    .withMessage('members must be a non-empty array'),
  body('members.*.email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('members.*.firstName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name must be less than 100 characters'),
  body('members.*.lastName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name must be less than 100 characters'),
  body('members.*.tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

// ==========================================
// Mailing List Routes
// ==========================================

// List mailing lists
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  mailingListController.listMailingLists
);

// Create mailing list
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_MAILING_LIST'),
  createMailingListValidation,
  mailingListController.createMailingList
);

// Get mailing list by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  mailingListController.getMailingList
);

// Update mailing list
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_MAILING_LIST'),
  idParamValidation,
  updateMailingListValidation,
  mailingListController.updateMailingList
);

// Delete mailing list
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_MAILING_LIST'),
  idParamValidation,
  mailingListController.deleteMailingList
);

// Archive mailing list
router.post(
  '/:id/archive',
  authenticate,
  requireAdmin,
  logAdminAction('ARCHIVE_MAILING_LIST'),
  idParamValidation,
  mailingListController.archiveMailingList
);

// Restore mailing list
router.post(
  '/:id/restore',
  authenticate,
  requireAdmin,
  logAdminAction('RESTORE_MAILING_LIST'),
  idParamValidation,
  mailingListController.restoreMailingList
);

// Duplicate mailing list
router.post(
  '/:id/duplicate',
  authenticate,
  requireAdmin,
  logAdminAction('DUPLICATE_MAILING_LIST'),
  idParamValidation,
  duplicateValidation,
  mailingListController.duplicateMailingList
);

// Get members
router.get(
  '/:id/members',
  authenticate,
  requireAdmin,
  idParamValidation,
  mailingListController.getMembers
);

// Add members
router.post(
  '/:id/members',
  authenticate,
  requireAdmin,
  logAdminAction('ADD_MAILING_LIST_MEMBERS'),
  idParamValidation,
  addMembersValidation,
  mailingListController.addMembers
);

// Remove members
router.delete(
  '/:id/members',
  authenticate,
  requireAdmin,
  logAdminAction('REMOVE_MAILING_LIST_MEMBERS'),
  idParamValidation,
  removeMembersValidation,
  mailingListController.removeMembers
);

// Import members
router.post(
  '/:id/import',
  authenticate,
  requireAdmin,
  logAdminAction('IMPORT_MAILING_LIST_MEMBERS'),
  idParamValidation,
  importMembersValidation,
  mailingListController.importMembers
);

// Export members
router.get(
  '/:id/export',
  authenticate,
  requireAdmin,
  idParamValidation,
  mailingListController.exportMembers
);

export default router;
