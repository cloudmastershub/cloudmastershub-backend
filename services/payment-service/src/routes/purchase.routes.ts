import { Router } from 'express';
import { authenticateToken } from '@cloudmastershub/middleware';
import {
  createPurchase,
  getPurchaseHistory,
  getPurchaseStatus,
  refundPurchase
} from '../controllers/purchase.controller';

const router = Router();

// All purchase routes require authentication
router.use(authenticateToken);

router.post('/create', createPurchase);
router.get('/history/:userId', getPurchaseHistory);
router.get('/:purchaseId/status', getPurchaseStatus);
router.post('/:purchaseId/refund', refundPurchase);

export default router;