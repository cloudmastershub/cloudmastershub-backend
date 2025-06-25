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
    // Support both single 'name' field and separate firstName/lastName fields
    body('name').optional().notEmpty().trim(),
    body('firstName').optional().notEmpty().trim(),
    body('lastName').optional().notEmpty().trim(),
    // Custom validation to ensure either name OR (firstName AND lastName) is provided
    body().custom((value, { req }) => {
      const { name, firstName, lastName } = req.body;
      if (!name && (!firstName || !lastName)) {
        throw new Error('Either provide name field or both firstName and lastName');
      }
      return true;
    }),
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
