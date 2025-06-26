import { Router } from 'express';
import { authenticateToken } from '@cloudmastershub/middleware';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  cancelSubscription,
  getSubscriptionPlans,
  createSubscription
} from '../controllers/subscription.controller';

const router = Router();

// Public routes
router.get('/plans', getSubscriptionPlans);

// Protected routes (require authentication)
router.use(authenticateToken);

router.get('/status/:userId', getSubscriptionStatus);
router.post('/checkout-session', createCheckoutSession);
router.post('/create', createSubscription);
router.post('/:subscriptionId/cancel', cancelSubscription);

export default router;