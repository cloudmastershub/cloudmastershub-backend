import { Router } from 'express';
import { body, param } from 'express-validator';
import { register, login, logout, refreshToken, googleAuth, forgotPassword, resetPassword, verifyResetToken } from '../controllers/authController';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().trim(),
    body('lastName').notEmpty().trim(),
  ],
  validateRequest,
  register
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  validateRequest,
  login
);

router.post('/logout', logout);
router.post('/refresh', refreshToken);

// Google OAuth route
router.post(
  '/google',
  [
    body('googleToken').notEmpty().withMessage('Google token is required'),
    body('email').isEmail().normalizeEmail(),
    body('firstName').optional().trim(),
    body('lastName').optional().trim(),
    body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
    body('referralCode').optional().isLength({ min: 5 }).withMessage('Invalid referral code'),
  ],
  validateRequest,
  googleAuth
);

// Password Reset Routes
router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
  ],
  validateRequest,
  forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty()
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid reset token'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  ],
  validateRequest,
  resetPassword
);

router.get(
  '/verify-reset-token/:token',
  [
    param('token')
      .notEmpty()
      .isLength({ min: 64, max: 64 })
      .withMessage('Invalid reset token'),
  ],
  validateRequest,
  verifyResetToken
);

export default router;
