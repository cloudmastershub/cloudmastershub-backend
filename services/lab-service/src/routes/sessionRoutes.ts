import { Router } from 'express';
import {
  startLabSession,
  getSessionStatus,
  stopLabSession,
  getSessionLogs,
  submitLabSolution,
} from '../controllers/sessionController';

const router = Router();

router.post('/start', startLabSession);
router.get('/:sessionId/status', getSessionStatus);
router.post('/:sessionId/stop', stopLabSession);
router.get('/:sessionId/logs', getSessionLogs);
router.post('/:sessionId/submit', submitLabSolution);

export default router;
