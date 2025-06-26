import { Router, Request, Response } from 'express';
import { handleStripeWebhook } from '../controllers/webhook.controller';

const router = Router();

// Stripe webhook endpoint (no authentication required, verified by Stripe signature)
router.post('/stripe', handleStripeWebhook);

export default router;