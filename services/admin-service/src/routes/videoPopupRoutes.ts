import { Router } from 'express';
import {
  listVideoPopups,
  getVideoPopup,
  createVideoPopup,
  updateVideoPopup,
  deleteVideoPopup,
  toggleVideoPopup,
  duplicateVideoPopup,
  getActivePopupsForPage,
  recordPopupView,
  recordPopupClick,
  recordPopupDismiss,
  getPopupAnalytics
} from '../controllers/videoPopupController';
import { authenticateAdmin } from '../middleware/adminAuth';

// Admin routes (protected)
const router = Router();

router.use(authenticateAdmin);

router.get('/', listVideoPopups);
router.get('/:id', getVideoPopup);
router.post('/', createVideoPopup);
router.put('/:id', updateVideoPopup);
router.delete('/:id', deleteVideoPopup);
router.post('/:id/toggle', toggleVideoPopup);
router.post('/:id/duplicate', duplicateVideoPopup);
router.get('/:id/analytics', getPopupAnalytics);

export default router;

// Public routes (no authentication required)
export const publicVideoPopupRouter = Router();

publicVideoPopupRouter.get('/active', getActivePopupsForPage);
publicVideoPopupRouter.post('/:id/view', recordPopupView);
publicVideoPopupRouter.post('/:id/click', recordPopupClick);
publicVideoPopupRouter.post('/:id/dismiss', recordPopupDismiss);
