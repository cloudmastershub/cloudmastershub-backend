import { Router } from 'express';
import { authenticateToken } from '@cloudmastershub/middleware';
import {
  getPaymentHistory,
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod
} from '../controllers/payment.controller';

const router = Router();

// All payment routes require authentication
router.use(authenticateToken);

router.get('/history/:userId', getPaymentHistory);
router.get('/methods/:userId', getPaymentMethods);
router.post('/methods', addPaymentMethod);
router.delete('/methods/:paymentMethodId', removePaymentMethod);
router.post('/methods/:paymentMethodId/default', setDefaultPaymentMethod);

export default router;