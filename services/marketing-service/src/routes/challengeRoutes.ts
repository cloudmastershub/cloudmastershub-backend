import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as challengeController from '../controllers/challengeController';
import { authenticate, requireAdmin, logAdminAction } from '../middleware/auth';
import { ChallengeStatus, ParticipantStatus, DeliveryMode } from '../models';

const router = Router();

// Validation schemas
const challengeStatusValues = Object.values(ChallengeStatus);
const participantStatusValues = Object.values(ParticipantStatus);
const deliveryModeValues = Object.values(DeliveryMode);

// ==========================================
// Validation Schemas
// ==========================================

const createChallengeValidation = [
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
  body('tagline')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Tagline must be less than 200 characters'),
  body('totalDays')
    .notEmpty()
    .withMessage('Total days is required')
    .isInt({ min: 1, max: 30 })
    .withMessage('Total days must be between 1 and 30'),
  body('deliveryMode')
    .notEmpty()
    .withMessage('Delivery mode is required')
    .isIn(deliveryModeValues)
    .withMessage(`Delivery mode must be one of: ${deliveryModeValues.join(', ')}`),
  body('registration.isOpen')
    .optional()
    .isBoolean()
    .withMessage('Registration isOpen must be a boolean'),
  body('registration.startDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('registration.endDate')
    .optional()
    .isISO8601()
    .withMessage('Invalid end date format'),
  body('registration.maxParticipants')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max participants must be a positive integer'),
  body('community.enabled')
    .optional()
    .isBoolean()
    .withMessage('Community enabled must be a boolean'),
  body('community.showLeaderboard')
    .optional()
    .isBoolean()
    .withMessage('Show leaderboard must be a boolean'),
  body('gamification.enabled')
    .optional()
    .isBoolean()
    .withMessage('Gamification enabled must be a boolean'),
  body('gamification.pointsPerDay')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Points per day must be a non-negative integer'),
];

const updateChallengeValidation = [
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
  body('totalDays')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Total days must be between 1 and 30'),
  body('deliveryMode')
    .optional()
    .isIn(deliveryModeValues)
    .withMessage(`Delivery mode must be one of: ${deliveryModeValues.join(', ')}`),
];

const dayValidation = [
  body('title')
    .notEmpty()
    .withMessage('Day title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be less than 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  body('landingPageId')
    .notEmpty()
    .withMessage('Landing page ID is required'),
  body('emailTemplateId')
    .optional()
    .isString()
    .withMessage('Email template ID must be a string'),
  body('content.videoUrl')
    .optional()
    .isURL()
    .withMessage('Invalid video URL'),
  body('content.videoDuration')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Video duration must be a non-negative integer'),
  body('unlockAfterHours')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Unlock after hours must be a non-negative integer'),
  body('estimatedDuration')
    .optional()
    .isInt({ min: 1, max: 480 })
    .withMessage('Estimated duration must be between 1 and 480 minutes'),
  body('completionCriteria.videoWatchPercent')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Video watch percent must be between 0 and 100'),
];

const pitchDayValidation = [
  body('title')
    .notEmpty()
    .withMessage('Pitch day title is required'),
  body('landingPageId')
    .notEmpty()
    .withMessage('Landing page ID is required'),
  body('offerDetails.productName')
    .notEmpty()
    .withMessage('Product name is required'),
  body('offerDetails.originalPrice')
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number'),
  body('offerDetails.discountedPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Discounted price must be a positive number'),
  body('offerDetails.discountExpiresHours')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Discount expiration hours must be a positive integer'),
];

const registrationValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('firstName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters'),
  body('lastName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters'),
];

const completeDayValidation = [
  body('email')
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  body('videoWatchPercent')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Video watch percent must be between 0 and 100'),
  body('timeSpentMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a non-negative integer'),
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
    .isIn(challengeStatusValues)
    .withMessage(`Status must be one of: ${challengeStatusValues.join(', ')}`),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'totalDays', 'metrics.totalRegistrations'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
];

const participantListValidation = [
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
    .isIn(participantStatusValues)
    .withMessage(`Status must be one of: ${participantStatusValues.join(', ')}`),
];

const idParamValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid challenge ID'),
];

const slugParamValidation = [
  param('slug')
    .notEmpty()
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Invalid slug format'),
];

const dayNumberParamValidation = [
  param('dayNumber')
    .isInt({ min: 1, max: 30 })
    .withMessage('Day number must be between 1 and 30'),
];

// ==========================================
// Admin Routes (require authentication)
// ==========================================

// List challenges
router.get(
  '/',
  authenticate,
  requireAdmin,
  listQueryValidation,
  challengeController.listChallenges
);

// Create challenge
router.post(
  '/',
  authenticate,
  requireAdmin,
  logAdminAction('CREATE_CHALLENGE'),
  createChallengeValidation,
  challengeController.createChallenge
);

// Get challenge by ID
router.get(
  '/:id',
  authenticate,
  requireAdmin,
  idParamValidation,
  challengeController.getChallenge
);

// Get challenge by slug
router.get(
  '/slug/:slug',
  authenticate,
  requireAdmin,
  slugParamValidation,
  challengeController.getChallengeBySlug
);

// Update challenge
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_CHALLENGE'),
  idParamValidation,
  updateChallengeValidation,
  challengeController.updateChallenge
);

// Delete challenge
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_CHALLENGE'),
  idParamValidation,
  challengeController.deleteChallenge
);

// Publish challenge
router.post(
  '/:id/publish',
  authenticate,
  requireAdmin,
  logAdminAction('PUBLISH_CHALLENGE'),
  idParamValidation,
  challengeController.publishChallenge
);

// Pause challenge
router.post(
  '/:id/pause',
  authenticate,
  requireAdmin,
  logAdminAction('PAUSE_CHALLENGE'),
  idParamValidation,
  challengeController.pauseChallenge
);

// ==========================================
// Challenge Day Management (Admin)
// ==========================================

// Add/update day
router.put(
  '/:id/days/:dayNumber',
  authenticate,
  requireAdmin,
  logAdminAction('UPDATE_CHALLENGE_DAY'),
  idParamValidation,
  dayNumberParamValidation,
  dayValidation,
  challengeController.upsertDay
);

// Remove day
router.delete(
  '/:id/days/:dayNumber',
  authenticate,
  requireAdmin,
  logAdminAction('DELETE_CHALLENGE_DAY'),
  idParamValidation,
  dayNumberParamValidation,
  challengeController.removeDay
);

// Set pitch day
router.put(
  '/:id/pitch-day',
  authenticate,
  requireAdmin,
  logAdminAction('SET_PITCH_DAY'),
  idParamValidation,
  pitchDayValidation,
  challengeController.setPitchDay
);

// ==========================================
// Participant Management (Admin)
// ==========================================

// Get participants
router.get(
  '/:id/participants',
  authenticate,
  requireAdmin,
  idParamValidation,
  participantListValidation,
  challengeController.getParticipants
);

// Get challenge stats
router.get(
  '/:id/stats',
  authenticate,
  requireAdmin,
  idParamValidation,
  challengeController.getChallengeStats
);

// Get leaderboard (admin view - full data)
router.get(
  '/:id/leaderboard',
  authenticate,
  requireAdmin,
  idParamValidation,
  challengeController.getLeaderboard
);

// ==========================================
// Public Routes (no authentication)
// ==========================================

const publicRouter = Router();

// List published challenges (public)
publicRouter.get(
  '/list',
  challengeController.listPublicChallenges
);

// Get published challenge by slug
publicRouter.get(
  '/:slug',
  slugParamValidation,
  challengeController.getPublicChallenge
);

// Register for challenge
publicRouter.post(
  '/:slug/register',
  slugParamValidation,
  registrationValidation,
  challengeController.registerForChallenge
);

// Get participant progress
publicRouter.get(
  '/:slug/progress',
  slugParamValidation,
  query('email').isEmail().withMessage('Valid email is required'),
  challengeController.getProgress
);

// Mark day complete
publicRouter.post(
  '/:slug/days/:dayNumber/complete',
  slugParamValidation,
  dayNumberParamValidation,
  completeDayValidation,
  challengeController.completeDay
);

// Get public leaderboard
publicRouter.get(
  '/:slug/leaderboard',
  slugParamValidation,
  challengeController.getPublicLeaderboard
);

export { publicRouter as publicChallengeRouter };
export default router;
