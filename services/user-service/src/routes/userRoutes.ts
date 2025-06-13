import { Router } from 'express';
import { body } from 'express-validator';
import {
  getProfile,
  updateProfile,
  getProgress,
  updateSubscription,
} from '../controllers/userController';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

router.use(authenticate);

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

router.post('/subscription', updateSubscription);

export default router;
