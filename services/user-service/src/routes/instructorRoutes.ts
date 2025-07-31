import { Router } from 'express';
import {
  getInstructorStats,
  getInstructorProfile
} from '../controllers/instructorController';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../../../shared/types';

const router = Router();

// All instructor routes require authentication
router.use(authenticate);

// All instructor routes require instructor role
router.use(authorize([UserRole.INSTRUCTOR]));

// Get instructor statistics for dashboard
router.get('/stats', getInstructorStats);

// Get instructor profile
router.get('/profile', getInstructorProfile);

export default router;