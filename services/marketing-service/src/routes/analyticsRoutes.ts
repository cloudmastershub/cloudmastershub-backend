import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getDashboardOverview,
  getEmailPerformance,
  getSequencePerformance,
  getLifecycleFunnel,
  getFunnelStepAnalytics,
} from '../controllers/analyticsController';

const router = Router();

// All analytics routes require admin auth
router.use(authenticate, requireAdmin);

router.get('/overview', getDashboardOverview);
router.get('/email', getEmailPerformance);
router.get('/sequences', getSequencePerformance);
router.get('/sequences/:id', getSequencePerformance);
router.get('/lifecycle', getLifecycleFunnel);
router.get('/funnels/:id', getFunnelStepAnalytics);

export default router;
