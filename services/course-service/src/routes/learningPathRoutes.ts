import { Router, Request, Response, NextFunction } from 'express';
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

// Admin role check middleware
const requireAdminRole = (req: any, res: any, next: any) => {
  // Check if user has admin role
  if (!req.userRoles || !req.userRoles.includes('admin')) {
    return res.status(403).json({
      success: false,
      message: 'Admin role required for this operation',
      error: {
        code: 'ADMIN_ROLE_REQUIRED',
        details: 'Learning path creation, updating, and deletion requires admin privileges.'
      }
    });
  }
  next();
};

// Public routes (no authentication required)
router.get('/', validateLearningPathQuery, getAllLearningPaths);
router.get('/:id', validatePathId, getLearningPathById);

// Protected routes (authentication required)

// Admin-only CRUD operations (create, update, delete)
router.post('/', authenticate, requireAdminRole, validateCreateLearningPath, validateBusinessRules, createLearningPath);
router.put('/:id', authenticate, requireAdminRole, validateUpdateLearningPath, validateBusinessRules, updateLearningPath);
router.delete('/:id', authenticate, requireAdminRole, validatePathId, deleteLearningPath);

// Admin-only pathway step management
router.post('/:id/steps', authenticate, requireAdminRole, validateAddPathwayStep, validateBusinessRules, addPathwayStep);
router.delete('/:id/steps/:stepId', authenticate, requireAdminRole, validatePathId, removePathwayStep);

// Progress tracking and enrollment (user-specific, no admin restriction)
router.get('/:id/progress', authenticate, validatePathId, getLearningPathProgress);
router.post('/:id/enroll', authenticate, validateEnrollment, validateBusinessRules, enrollInLearningPath);
router.post('/:id/steps/:stepId/progress', authenticate, (req: Request, res: Response, next: NextFunction) => {
  const pathId = req.params.id;
  return requireLearningPathAccess(pathId)(req, res, next);
}, validateStepProgress, updateStepProgress);
router.get('/:id/certificate', authenticate, (req: Request, res: Response, next: NextFunction) => {
  const pathId = req.params.id;
  return requireLearningPathAccess(pathId)(req, res, next);
}, validatePathId, getLearningPathCertificate);

// Learning path access check
router.get('/:id/access', authenticate, validatePathId, (req, res) => {
  res.json({
    success: true,
    data: {
      hasAccess: true,
      subscriptionRequired: false,
      currentSubscription: 'premium',
      requiredSubscription: 'free',
      isEnrolled: true
    }
  });
});

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

// User dashboard and analytics (no admin restriction)
router.get('/user/paths', authenticate, validateUserStatusQuery, getUserLearningPaths);
router.get('/user/recommendations', authenticate, validateRecommendationsQuery, getRecommendations);
router.get('/user/analytics', authenticate, validateAnalyticsQuery, getLearningAnalytics);

export default router;