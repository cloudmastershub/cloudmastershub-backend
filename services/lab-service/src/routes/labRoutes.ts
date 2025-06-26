import { Router } from 'express';
import {
  getAllLabs,
  getLabById,
  createLab,
  updateLab,
  deleteLab,
  getLabByCourse,
} from '../controllers/labController';
import { authenticate } from '@cloudmastershub/middleware';
import { 
  requireSubscription, 
  requireLabAccess, 
  requirePremiumSubscription 
} from '@cloudmastershub/middleware';

const router = Router();

// Public routes (no authentication required)
router.get('/', getAllLabs); // Browse available labs
router.get('/:id', getLabById); // View lab details

// Course-specific labs
router.get('/course/:courseId', getLabByCourse); // Get labs for a course

// Protected routes (authentication + subscription required)
router.post('/', authenticate, requirePremiumSubscription(), createLab); // Create lab (instructors)
router.put('/:id', authenticate, updateLab); // Update lab (instructor/admin)
router.delete('/:id', authenticate, deleteLab); // Delete lab (admin only)

// Lab access endpoint (requires premium subscription)
router.get('/:id/access', authenticate, (req, res, next) => {
  const labId = req.params.id;
  return requireLabAccess(labId)(req, res, next);
}, (req, res) => {
  res.json({
    success: true,
    message: 'Lab access granted',
    labId: req.params.id,
    accessLevel: 'premium'
  });
});

export default router;
