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
  getPopupAnalytics,
  submitPopupForm
} from '../controllers/videoPopupController';
import { requireAdmin } from '../middleware/adminAuth';

// Admin routes (protected)
const router = Router();

router.use(requireAdmin);

// List all popups (supports ?type=video or ?type=lead_capture filter)
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

// Get active popups for page (supports ?type=video or ?type=lead_capture filter)
publicVideoPopupRouter.get('/active', getActivePopupsForPage);

// Analytics tracking
publicVideoPopupRouter.post('/:id/view', recordPopupView);
publicVideoPopupRouter.post('/:id/click', recordPopupClick);
publicVideoPopupRouter.post('/:id/dismiss', recordPopupDismiss);

// Lead capture form submission
publicVideoPopupRouter.post('/:id/submit', submitPopupForm);

// Backward compatibility aliases
export const publicPopupRouter = publicVideoPopupRouter;
export const popupRouter = router;
