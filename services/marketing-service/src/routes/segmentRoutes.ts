import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as segmentController from '../controllers/segmentController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';

const router = Router();

// ==========================================
// Validation Schemas
// ==========================================

const createSegmentValidation = [
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
  body('rootGroup')
    .optional()
    .isObject()
    .withMessage('rootGroup must be an object'),
  body('rootGroup.operator')
    .optional()
    .isIn(['and', 'or'])
    .withMessage('Operator must be and or or'),
  body('rootGroup.rules')
    .optional()
    .isArray()
    .withMessage('Rules must be an array'),
  body('leadIds')
    .optional()
    .isArray()
    .withMessage('leadIds must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const updateSegmentValidation = [
  body('name')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Name must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('rootGroup')
    .optional()
    .isObject()
    .withMessage('rootGroup must be an object'),
  body('leadIds')
    .optional()
    .isArray()
    .withMessage('leadIds must be an array'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const previewSegmentValidation = [
  body('rootGroup')
    .notEmpty()
    .withMessage('rootGroup is required')
    .isObject()
    .withMessage('rootGroup must be an object'),
  body('rootGroup.operator')
    .notEmpty()
    .withMessage('Operator is required')
    .isIn(['and', 'or'])
    .withMessage('Operator must be and or or'),
  body('rootGroup.rules')
    .isArray()
    .withMessage('Rules must be an array'),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid segment ID'),
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
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'estimatedSize'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Invalid sort order'),
];

// ==========================================
// Segment Routes
// ==========================================

// Get available segment fields
router.get(
  '/fields',
  authenticate,
  requireAdmin,
  segmentController.getSegmentFields
);

// Preview segment (estimate size without saving)
router.post(
  '/preview',
  authenticate,
  requireAdmin,
  previewSegmentValidation,
  segmentController.previewSegment
);

// List segments
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  segmentController.listSegments
);

// Create segment
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_SEGMENT'),
  createSegmentValidation,
  segmentController.createSegment
);

// Get segment by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  segmentController.getSegment
);

// Update segment
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_SEGMENT'),
  idParamValidation,
  updateSegmentValidation,
  segmentController.updateSegment
);

// Delete segment
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_SEGMENT'),
  idParamValidation,
  segmentController.deleteSegment
);

// Calculate segment size
router.post(
  '/:id/calculate',
  authenticate,
  requireAdmin,
  idParamValidation,
  segmentController.calculateSegmentSize
);

// Get leads in segment
router.get(
  '/:id/leads',
  authenticate,
  requireAdmin,
  idParamValidation,
  segmentController.getSegmentLeads
);

export default router;
