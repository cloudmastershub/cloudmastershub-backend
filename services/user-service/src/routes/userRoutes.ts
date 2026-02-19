import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProfile,
  updateProfile,
  getProgress,
  getStreaks,
  updateSubscription,
  getUserCourses,
} from '../controllers/userController';
import {
  verifyEmail,
  resendVerification,
  getVerificationStatus,
} from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Public verification routes (no auth required)
router.post(
  '/verify-email',
  [
    body('token')
      .notEmpty()
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid verification token'),
  ],
  validateRequest,
  verifyEmail
);

router.post(
  '/resend-verification',
  [
    body('email').optional().isEmail().normalizeEmail(),
  ],
  validateRequest,
  resendVerification
);

// All routes below require authentication
router.use(authenticate);

router.get('/verification-status', getVerificationStatus);

router.get('/profile', getProfile);

router.put(
  '/profile',
  [
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('bio').optional().trim(),
  ],
  validateRequest,
  updateProfile
);

router.get('/progress', getProgress);

router.get('/progress/streaks', getStreaks);

router.post('/subscription', updateSubscription);

router.get('/courses', getUserCourses);

export default router;
