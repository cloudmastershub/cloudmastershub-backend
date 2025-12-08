import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { requireAdmin, logAdminAction } from '../middleware/adminAuth';
import {
  listLandingPages,
  getLandingPage,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
  publishLandingPage,
  unpublishLandingPage,
  duplicateLandingPage,
  updateLandingPageBlocks,
  getLandingPageAnalytics,
  getPublicLandingPage,
  recordConversion
} from '../controllers/landingPageController';
import { BlockType, LandingPageStatus } from '../models/LandingPage';

const router = Router();

// Validation middleware
const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array()
      }
    });
    return;
  }
  next();
};

// Validation rules
const createLandingPageValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
    .isLength({ max: 100 }).withMessage('Slug must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters'),
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 70 }).withMessage('Meta title must be at most 70 characters'),
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 }).withMessage('Meta description must be at most 160 characters'),
  body('metaKeywords')
    .optional()
    .isArray().withMessage('Meta keywords must be an array'),
  body('metaKeywords.*')
    .optional()
    .isString().withMessage('Each meta keyword must be a string'),
  body('ogImage')
    .optional()
    .trim()
    .isURL().withMessage('OG Image must be a valid URL'),
  body('blocks')
    .optional()
    .isArray().withMessage('Blocks must be an array'),
  body('blocks.*.id')
    .optional()
    .isString().withMessage('Block ID must be a string'),
  body('blocks.*.type')
    .optional()
    .isIn(Object.values(BlockType)).withMessage('Invalid block type'),
  body('blocks.*.data')
    .optional()
    .isObject().withMessage('Block data must be an object'),
  body('blocks.*.position')
    .optional()
    .isInt({ min: 0 }).withMessage('Block position must be a non-negative integer'),
  body('template')
    .optional()
    .isString().withMessage('Template must be a string'),
  validate
];

const updateLandingPageValidation = [
  param('id')
    .isMongoId().withMessage('Invalid landing page ID'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),
  body('slug')
    .optional()
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage('Slug can only contain lowercase letters, numbers, and hyphens')
    .isLength({ max: 100 }).withMessage('Slug must be at most 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Description must be at most 1000 characters'),
  body('metaTitle')
    .optional()
    .trim()
    .isLength({ max: 70 }).withMessage('Meta title must be at most 70 characters'),
  body('metaDescription')
    .optional()
    .trim()
    .isLength({ max: 160 }).withMessage('Meta description must be at most 160 characters'),
  body('metaKeywords')
    .optional()
    .isArray().withMessage('Meta keywords must be an array'),
  body('ogImage')
    .optional()
    .trim(),
  body('blocks')
    .optional()
    .isArray().withMessage('Blocks must be an array'),
  body('template')
    .optional()
    .isString().withMessage('Template must be a string'),
  validate
];

const updateBlocksValidation = [
  param('id')
    .isMongoId().withMessage('Invalid landing page ID'),
  body('blocks')
    .isArray().withMessage('Blocks must be an array'),
  body('blocks.*.id')
    .isString().withMessage('Block ID must be a string'),
  body('blocks.*.type')
    .isIn(Object.values(BlockType)).withMessage('Invalid block type'),
  body('blocks.*.data')
    .isObject().withMessage('Block data must be an object'),
  body('blocks.*.position')
    .isInt({ min: 0 }).withMessage('Block position must be a non-negative integer'),
  validate
];

const idParamValidation = [
  param('id')
    .isMongoId().withMessage('Invalid landing page ID'),
  validate
];

const slugParamValidation = [
  param('slug')
    .trim()
    .matches(/^[a-z0-9-]+$/).withMessage('Invalid slug format'),
  validate
];

const listQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(Object.values(LandingPageStatus)).withMessage('Invalid status'),
  query('search')
    .optional()
    .isString().withMessage('Search must be a string'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'title', 'viewCount', 'conversionCount']).withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  validate
];

// ================================
// ADMIN ROUTES (require authentication)
// ================================

// Apply admin authentication to all routes
router.use(requireAdmin);

// List landing pages
router.get(
  '/',
  listQueryValidation,
  logAdminAction('LIST_LANDING_PAGES'),
  listLandingPages
);

// Get a single landing page
router.get(
  '/:id',
  idParamValidation,
  logAdminAction('GET_LANDING_PAGE'),
  getLandingPage
);

// Create a new landing page
router.post(
  '/',
  createLandingPageValidation,
  logAdminAction('CREATE_LANDING_PAGE'),
  createLandingPage
);

// Update a landing page
router.put(
  '/:id',
  updateLandingPageValidation,
  logAdminAction('UPDATE_LANDING_PAGE'),
  updateLandingPage
);

// Delete a landing page
router.delete(
  '/:id',
  idParamValidation,
  logAdminAction('DELETE_LANDING_PAGE'),
  deleteLandingPage
);

// Publish a landing page
router.post(
  '/:id/publish',
  idParamValidation,
  logAdminAction('PUBLISH_LANDING_PAGE'),
  publishLandingPage
);

// Unpublish a landing page
router.post(
  '/:id/unpublish',
  idParamValidation,
  logAdminAction('UNPUBLISH_LANDING_PAGE'),
  unpublishLandingPage
);

// Duplicate a landing page
router.post(
  '/:id/duplicate',
  idParamValidation,
  logAdminAction('DUPLICATE_LANDING_PAGE'),
  duplicateLandingPage
);

// Update blocks for a landing page
router.put(
  '/:id/blocks',
  updateBlocksValidation,
  logAdminAction('UPDATE_LANDING_PAGE_BLOCKS'),
  updateLandingPageBlocks
);

// Get analytics for a landing page
router.get(
  '/:id/analytics',
  idParamValidation,
  logAdminAction('GET_LANDING_PAGE_ANALYTICS'),
  getLandingPageAnalytics
);

export default router;

// ================================
// PUBLIC ROUTES (separate router for public access)
// ================================
export const publicLandingPageRouter = Router();

// Get a published landing page by slug
publicLandingPageRouter.get(
  '/:slug',
  slugParamValidation,
  getPublicLandingPage
);

// Record a conversion event
publicLandingPageRouter.post(
  '/:slug/convert',
  slugParamValidation,
  recordConversion
);
