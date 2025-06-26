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

const router = Router();

// Public routes (no authentication required)
router.get('/', validateLearningPathQuery, getAllLearningPaths);
router.get('/:id', validatePathId, getLearningPathById);

// Protected routes (authentication required)
// TODO: Add authentication middleware when implementing JWT verification

// Instructor/Admin routes for managing learning paths
router.post('/', validateCreateLearningPath, validateBusinessRules, createLearningPath); // TODO: Add instructor/admin middleware
router.put('/:id', validateUpdateLearningPath, validateBusinessRules, updateLearningPath); // TODO: Add ownership/admin middleware
router.delete('/:id', validatePathId, deleteLearningPath); // TODO: Add admin-only middleware

// Pathway step management
router.post('/:id/steps', validateAddPathwayStep, validateBusinessRules, addPathwayStep); // TODO: Add ownership/admin middleware
router.delete('/:id/steps/:stepId', validatePathId, removePathwayStep); // TODO: Add ownership/admin middleware

// Progress tracking and enrollment (user-specific)
router.get('/:id/progress', validatePathId, getLearningPathProgress); // TODO: Add authentication middleware
router.post('/:id/enroll', validateEnrollment, validateBusinessRules, enrollInLearningPath); // TODO: Add authentication middleware
router.post('/:id/steps/:stepId/progress', validateStepProgress, updateStepProgress); // TODO: Add authentication middleware
router.get('/:id/certificate', validatePathId, getLearningPathCertificate); // TODO: Add authentication middleware

// User dashboard and analytics
router.get('/user/paths', validateUserStatusQuery, getUserLearningPaths); // TODO: Add authentication middleware
router.get('/user/recommendations', validateRecommendationsQuery, getRecommendations); // TODO: Add authentication middleware
router.get('/user/analytics', validateAnalyticsQuery, getLearningAnalytics); // TODO: Add authentication middleware

export default router;
