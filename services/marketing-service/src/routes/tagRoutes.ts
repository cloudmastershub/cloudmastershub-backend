import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../middleware/validateRequest';
import {
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  searchTags,
  getTagStats,
  mergeTags,
  syncTagsFromLeads,
} from '../controllers/tagController';
import { TagCategory } from '../models/Tag';

const router = Router();

/**
 * Tag Routes
 * All routes require authentication (handled by API Gateway)
 */

// Search tags (for autocomplete) - must be before /:id route
router.get(
  '/search',
  [
    query('q').optional().isString().trim(),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  validateRequest,
  searchTags
);

// Get tag statistics
router.get('/stats', getTagStats);

// Sync tags from leads
router.post('/sync', syncTagsFromLeads);

// Get all tags
router.get(
  '/',
  [
    query('category').optional().isIn(Object.values(TagCategory)),
    query('search').optional().isString().trim(),
    query('sortBy').optional().isIn(['name', 'usageCount', 'createdAt', 'category']),
    query('sortOrder').optional().isIn(['asc', 'desc']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getAllTags
);

// Create a new tag
router.post(
  '/',
  [
    body('name')
      .notEmpty()
      .withMessage('Tag name is required')
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Tag name must be 1-50 characters'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description must be at most 200 characters'),
    body('category')
      .optional()
      .isIn(Object.values(TagCategory))
      .withMessage('Invalid category'),
    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex color (e.g., #6B7280)'),
  ],
  validateRequest,
  createTag
);

// Get a single tag
router.get(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid tag ID')],
  validateRequest,
  getTagById
);

// Update a tag
router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid tag ID'),
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Tag name must be 1-50 characters'),
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description must be at most 200 characters'),
    body('category')
      .optional()
      .isIn(Object.values(TagCategory))
      .withMessage('Invalid category'),
    body('color')
      .optional()
      .matches(/^#[0-9A-Fa-f]{6}$/)
      .withMessage('Color must be a valid hex color (e.g., #6B7280)'),
  ],
  validateRequest,
  updateTag
);

// Delete a tag
router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid tag ID')],
  validateRequest,
  deleteTag
);

// Merge tags
router.post(
  '/:id/merge',
  [
    param('id').isMongoId().withMessage('Invalid source tag ID'),
    body('targetId').isMongoId().withMessage('Invalid target tag ID'),
  ],
  validateRequest,
  mergeTags
);

export default router;
