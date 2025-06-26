import { Router } from 'express';
import {
  startLabSession,
  getSessionStatus,
  stopLabSession,
  getSessionLogs,
  submitLabSolution,
} from '../controllers/sessionController';
import { authenticate } from '@cloudmastershub/middleware';
import { requirePremiumSubscription } from '@cloudmastershub/middleware';

const router = Router();

// All lab session routes require authentication and premium subscription
router.post('/start', authenticate, requirePremiumSubscription(), startLabSession);
router.get('/:sessionId/status', authenticate, getSessionStatus);
router.post('/:sessionId/stop', authenticate, stopLabSession);
router.get('/:sessionId/logs', authenticate, getSessionLogs);
router.post('/:sessionId/submit', authenticate, submitLabSolution);

export default router;
