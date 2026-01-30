import { Router } from 'express';
import { authenticateToken } from '@cloudmastershub/middleware';
import {
  getSubscriptionStatus,
  createCheckoutSession,
  cancelSubscription,
  getSubscriptionPlans,
  getPlanByStripePrice,
  createSubscription,
  updateSubscription,
  pauseSubscription,
  resumeSubscription,
  getTrialStatus,
  extendTrial
} from '../controllers/subscription.controller';

const router = Router();

// Public routes
router.get('/plans', getSubscriptionPlans);
router.get('/plans/by-stripe-price/:stripePriceId', getPlanByStripePrice);

// Protected routes (require authentication)
router.use(authenticateToken);

router.get('/status/:userId', getSubscriptionStatus);
router.post('/checkout-session', createCheckoutSession);
router.post('/create', createSubscription);
router.post('/:subscriptionId/cancel', cancelSubscription);
router.put('/:subscriptionId', updateSubscription);

// Pause and resume subscription
router.post('/:subscriptionId/pause', pauseSubscription);
router.post('/:subscriptionId/resume', resumeSubscription);

// Trial management
router.get('/:subscriptionId/trial-status', getTrialStatus);
router.post('/:subscriptionId/extend-trial', extendTrial);

export default router;