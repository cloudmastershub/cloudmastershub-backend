import { Router } from 'express';
import { revenueAnalytics, subscriptionAnalytics } from '../controllers/analytics.controller';

const router = Router();

// GET /admin/analytics/revenue?timeframe=30d
router.get('/revenue', revenueAnalytics);

// GET /admin/analytics/subscriptions?timeframe=30d
router.get('/subscriptions', subscriptionAnalytics);

export default router;
