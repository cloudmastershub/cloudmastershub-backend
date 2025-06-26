import { Router } from 'express';
import {
  getAllLearningPaths,
  getLearningPathById,
  createLearningPath,
  updateLearningPath,
  deleteLearningPath,
  addPathwayStep,
  removePathwayStep,
  getLearningPathProgress,
} from '../controllers/learningPathController';
import {
  enrollInLearningPath,
  updateStepProgress,
  getUserLearningPaths,
  getLearningPathCertificate,
  getRecommendations,
  getLearningAnalytics,
} from '../controllers/learningPathProgressController';
import {
  validateCreateLearningPath,
  validateUpdateLearningPath,
  validateAddPathwayStep,
  validateEnrollment,
  validateStepProgress,
  validateLearningPathQuery,
  validatePathId,
  validateUserStatusQuery,
  validateRecommendationsQuery,
  validateAnalyticsQuery,
  validateBusinessRules,
} from '../middleware/learningPathValidation';
import { authenticate } from '@cloudmastershub/middleware';
import { 
  requireSubscription, 
  requireLearningPathAccess, 
  requirePremiumSubscription 
} from '@cloudmastershub/middleware';

const router = Router();

// Public routes (no authentication required)
router.get('/', validateLearningPathQuery, getAllLearningPaths);
router.get('/:id', validatePathId, getLearningPathById);

// Protected routes (authentication required)

// Instructor/Admin routes for managing learning paths
router.post('/', authenticate, requirePremiumSubscription(), validateCreateLearningPath, validateBusinessRules, createLearningPath);
router.put('/:id', authenticate, validateUpdateLearningPath, validateBusinessRules, updateLearningPath);
router.delete('/:id', authenticate, validatePathId, deleteLearningPath); // Admin only

// Pathway step management
router.post('/:id/steps', authenticate, validateAddPathwayStep, validateBusinessRules, addPathwayStep);
router.delete('/:id/steps/:stepId', authenticate, validatePathId, removePathwayStep);

// Progress tracking and enrollment (user-specific)
router.get('/:id/progress', authenticate, validatePathId, getLearningPathProgress);
router.post('/:id/enroll', authenticate, validateEnrollment, validateBusinessRules, enrollInLearningPath);
router.post('/:id/steps/:stepId/progress', authenticate, (req, res, next) => {
  const pathId = req.params.id;
  return requireLearningPathAccess(pathId)(req, res, next);
}, validateStepProgress, updateStepProgress);
router.get('/:id/certificate', authenticate, (req, res, next) => {
  const pathId = req.params.id;
  return requireLearningPathAccess(pathId)(req, res, next);
}, validatePathId, getLearningPathCertificate);

// Learning path content access
router.get('/:id/content', authenticate, (req, res, next) => {
  const pathId = req.params.id;
  return requireLearningPathAccess(pathId)(req, res, next);
}, (req, res) => {
  res.json({
    success: true,
    message: 'Learning path content access granted',
    pathId: req.params.id
  });
});

// User dashboard and analytics
router.get('/user/paths', authenticate, validateUserStatusQuery, getUserLearningPaths);
router.get('/user/recommendations', authenticate, validateRecommendationsQuery, getRecommendations);
router.get('/user/analytics', authenticate, validateAnalyticsQuery, getLearningAnalytics);

export default router;
