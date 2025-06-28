import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { UserRole, SubscriptionPlanType } from '@cloudmastershub/types';
import { UserStatus, ContentModerationStatus, AnalyticsTimeframe } from '@cloudmastershub/types';
import logger from '../utils/logger';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Admin validation errors:', {
      errors: errors.array(),
      path: req.path,
      method: req.method,
    });

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

// User Management Validation
export const validateUserList = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('role').optional().isIn(Object.values(UserRole)).withMessage('Invalid user role'),

  query('status').optional().isIn(Object.values(UserStatus)).withMessage('Invalid user status'),

  query('subscription')
    .optional()
    .isIn(Object.values(SubscriptionPlanType))
    .withMessage('Invalid subscription plan'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search term must be 2-100 characters'),

  query('sortBy')
    .optional()
    .isIn(['createdAt', 'lastActiveAt', 'email', 'totalSpent'])
    .withMessage('Invalid sort field'),

  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

  handleValidationErrors,
];

export const validateUserAction = [
  param('userId').isUUID().withMessage('Valid user ID required'),

  body('action')
    .isIn(['ban', 'unban', 'suspend', 'promote', 'demote', 'verify'])
    .withMessage('Invalid action'),

  body('reason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be 5-500 characters'),

  body('duration')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Duration must be 1-365 days'),

  handleValidationErrors,
];

export const validateInstructorAction = [
  param('applicationId').isUUID().withMessage('Valid application ID required'),

  body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),

  handleValidationErrors,
];

// Content Moderation Validation
export const validateContentList = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(Object.values(ContentModerationStatus))
    .withMessage('Invalid content status'),

  query('type')
    .optional()
    .isIn(['course', 'learning_path'])
    .withMessage('Type must be course or learning_path'),

  query('sortBy')
    .optional()
    .isIn(['submittedAt', 'title', 'flagCount'])
    .withMessage('Invalid sort field'),

  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),

  handleValidationErrors,
];

export const validateContentAction = [
  param('contentId').isUUID().withMessage('Valid content ID required'),

  body('action').isIn(['approve', 'reject', 'flag', 'unflag']).withMessage('Invalid action'),

  body('contentType')
    .isIn(['course', 'learning_path'])
    .withMessage('Content type must be course or learning_path'),

  body('reason')
    .optional()
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage('Reason must be 5-500 characters'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters'),

  handleValidationErrors,
];

// Analytics Validation
export const validateAnalyticsRequest = [
  query('timeframe')
    .optional()
    .isIn(Object.values(AnalyticsTimeframe))
    .withMessage('Invalid timeframe'),

  query('startDate').optional().isISO8601().withMessage('Start date must be valid ISO 8601 date'),

  query('endDate').optional().isISO8601().withMessage('End date must be valid ISO 8601 date'),

  handleValidationErrors,
];

// Settings Validation
export const validateSettingsUpdate = [
  body('general').optional().isObject().withMessage('General settings must be an object'),

  body('general.siteName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Site name must be 1-100 characters'),

  body('general.supportEmail').optional().isEmail().withMessage('Valid support email required'),

  body('general.maintenanceMode')
    .optional()
    .isBoolean()
    .withMessage('Maintenance mode must be boolean'),

  body('security').optional().isObject().withMessage('Security settings must be an object'),

  body('security.passwordMinLength')
    .optional()
    .isInt({ min: 6, max: 50 })
    .withMessage('Password min length must be 6-50'),

  body('security.sessionTimeout')
    .optional()
    .isInt({ min: 5, max: 1440 })
    .withMessage('Session timeout must be 5-1440 minutes'),

  body('payment').optional().isObject().withMessage('Payment settings must be an object'),

  body('payment.currency').optional().isIn(['USD', 'EUR', 'GBP']).withMessage('Invalid currency'),

  body('payment.refundWindow')
    .optional()
    .isInt({ min: 1, max: 90 })
    .withMessage('Refund window must be 1-90 days'),

  handleValidationErrors,
];

export const validateFeatureFlagUpdate = [
  param('flagName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Flag name must be 1-50 characters'),

  body('enabled').isBoolean().withMessage('Enabled must be boolean'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Description must be less than 200 characters'),

  handleValidationErrors,
];

// Report Validation
export const validateReportRequest = [
  body('type')
    .isIn(['user_activity', 'revenue', 'content_performance', 'subscription_analytics'])
    .withMessage('Invalid report type'),

  body('timeframe').isIn(Object.values(AnalyticsTimeframe)).withMessage('Invalid timeframe'),

  body('format').isIn(['csv', 'pdf', 'excel']).withMessage('Invalid format'),

  body('filters').optional().isObject().withMessage('Filters must be an object'),

  handleValidationErrors,
];
