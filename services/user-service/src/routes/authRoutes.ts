import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, refreshToken } from '../controllers/authController';
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

router.post('/refresh', refreshToken);

export default router;
