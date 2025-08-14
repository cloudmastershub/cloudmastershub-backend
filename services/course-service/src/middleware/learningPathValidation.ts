import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import logger from '../utils/logger';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', { errors: errors.array(), path: req.path });
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((error) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      })),
    });
    return;
  }
  next();
};

// Learning Path Creation Validation
export const validateCreateLearningPath = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),

  body('shortDescription')
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('Short description must be between 10 and 300 characters'),

  body('category')
    .isIn(['aws', 'azure', 'gcp', 'devops', 'security', 'data', 'ai', 'general'])
    .withMessage('Invalid category'),

  body('level')
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),

  body('price').isFloat({ min: 0, max: 999999 }).withMessage('Price must be a positive number'),

  body('currency').optional().isIn(['USD', 'EUR', 'GBP']).withMessage('Invalid currency'),

  body('isFree').isBoolean().withMessage('isFree must be a boolean'),

  body('thumbnail').optional().isURL().withMessage('Thumbnail must be a valid URL'),

  body('objectives').isArray({ min: 1, max: 10 }).withMessage('Must have 1-10 learning objectives'),

  body('objectives.*')
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage('Each objective must be 10-200 characters'),

  body('skills').isArray({ min: 1, max: 20 }).withMessage('Must have 1-20 skills'),

  body('skills.*')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Each skill must be 2-50 characters'),

  body('prerequisites')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 prerequisites allowed'),

  body('prerequisites.*')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Each prerequisite must be 5-200 characters'),

  body('tags').optional().isArray({ max: 10 }).withMessage('Maximum 10 tags allowed'),

  body('tags.*')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Each tag must be 2-30 characters'),

  body('supportLevel')
    .optional()
    .isIn(['basic', 'standard', 'premium'])
    .withMessage('Invalid support level'),

  handleValidationErrors,
];

// Learning Path Update Validation
export const validateUpdateLearningPath = [
  param('id').trim().isLength({ min: 1 }).withMessage('Learning path ID is required'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),

  body('shortDescription')
    .optional()
    .trim()
    .isLength({ min: 10, max: 300 })
    .withMessage('Short description must be between 10 and 300 characters'),

  body('category')
    .optional()
    .isIn(['aws', 'azure', 'gcp', 'devops', 'security', 'data', 'ai', 'general'])
    .withMessage('Invalid category'),

  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),

  body('price')
    .optional()
    .isFloat({ min: 0, max: 999999 })
    .withMessage('Price must be a positive number'),

  body('status')
    .optional()
    .isIn(['draft', 'review', 'published', 'archived'])
    .withMessage('Invalid status'),

  handleValidationErrors,
];

// Pathway Step Validation
export const validateAddPathwayStep = [
  param('id').trim().isLength({ min: 1 }).withMessage('Learning path ID is required'),

  body('type').isIn(['course', 'lab', 'assessment', 'project']).withMessage('Invalid step type'),

  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),

  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),

  body('courseId')
    .if(body('type').equals('course'))
    .notEmpty()
    .withMessage('Course ID is required for course steps'),

  body('labId')
    .if(body('type').equals('lab'))
    .notEmpty()
    .withMessage('Lab ID is required for lab steps'),

  body('isRequired').isBoolean().withMessage('isRequired must be a boolean'),

  body('estimatedTimeMinutes')
    .isInt({ min: 1, max: 600 })
    .withMessage('Estimated time must be between 1 and 600 minutes'),

  body('difficulty')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),

  body('skills').optional().isArray({ max: 10 }).withMessage('Maximum 10 skills allowed'),

  body('prerequisites')
    .optional()
    .isArray({ max: 5 })
    .withMessage('Maximum 5 prerequisites allowed'),

  handleValidationErrors,
];

// Learning Path Enrollment Validation
export const validateEnrollment = [
  param('id').trim().isLength({ min: 1 }).withMessage('Learning path ID is required'),

  body('enrollmentType')
    .isIn(['free', 'purchased', 'subscription'])
    .withMessage('Invalid enrollment type'),

  body('paymentId')
    .if(body('enrollmentType').equals('purchased'))
    .notEmpty()
    .withMessage('Payment ID is required for purchased enrollment'),

  body('subscriptionId')
    .if(body('enrollmentType').equals('subscription'))
    .notEmpty()
    .withMessage('Subscription ID is required for subscription enrollment'),

  handleValidationErrors,
];

// Step Progress Update Validation
export const validateStepProgress = [
  param('id').trim().isLength({ min: 1 }).withMessage('Learning path ID is required'),

  param('stepId').trim().isLength({ min: 1 }).withMessage('Step ID is required'),

  body('isCompleted').isBoolean().withMessage('isCompleted must be a boolean'),

  body('timeSpent')
    .optional()
    .isInt({ min: 0, max: 600 })
    .withMessage('Time spent must be between 0 and 600 minutes'),

  body('score')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Score must be between 0 and 100'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),

  body('skipReason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Skip reason must be less than 500 characters'),

  handleValidationErrors,
];

// Query Parameter Validation
export const validateLearningPathQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('category')
    .optional()
    .isIn(['aws', 'azure', 'gcp', 'devops', 'security', 'data', 'ai', 'general'])
    .withMessage('Invalid category'),

  query('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced', 'expert'])
    .withMessage('Invalid difficulty level'),

  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be a positive number'),

  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be a positive number'),

  query('minRating')
    .optional()
    .isFloat({ min: 0, max: 5 })
    .withMessage('Minimum rating must be between 0 and 5'),

  query('isFree').optional().isIn(['true', 'false']).withMessage('isFree must be true or false'),

  query('sortBy')
    .optional()
    .isIn(['newest', 'popular', 'rating', 'price', 'duration'])
    .withMessage('Invalid sort criteria'),

  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be 2-100 characters'),

  handleValidationErrors,
];

// Path ID Validation
export const validatePathId = [
  param('id').trim().isLength({ min: 1 }).withMessage('Learning path ID is required'),

  handleValidationErrors,
];

// User Status Query Validation
export const validateUserStatusQuery = [
  query('status')
    .optional()
    .isIn(['all', 'enrolled', 'in_progress', 'completed'])
    .withMessage('Invalid status filter'),

  handleValidationErrors,
];

// Recommendations Query Validation
export const validateRecommendationsQuery = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),

  handleValidationErrors,
];

// Analytics Query Validation
export const validateAnalyticsQuery = [
  query('timeframe').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid timeframe'),

  handleValidationErrors,
];

// Business Logic Validation
export const validateBusinessRules = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { path, body } = req;

    // Create learning path business rules
    if (path.includes('POST') && body.isFree === false && (!body.price || body.price <= 0)) {
      res.status(400).json({
        success: false,
        message: 'Paid learning paths must have a valid price',
      });
      return;
    }

    // Enrollment business rules
    if (path.includes('enroll')) {
      const { enrollmentType, paymentId, subscriptionId } = body;

      if (enrollmentType === 'purchased' && !paymentId) {
        res.status(400).json({
          success: false,
          message: 'Payment ID is required for purchased enrollment',
        });
        return;
      }

      if (enrollmentType === 'subscription' && !subscriptionId) {
        res.status(400).json({
          success: false,
          message: 'Subscription ID is required for subscription enrollment',
        });
        return;
      }
    }

    next();
  } catch (error: any) {
    logger.error('Business validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal validation error',
    });
  }
};
