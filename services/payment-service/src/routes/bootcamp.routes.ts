import { Router } from 'express';
import { authenticateToken, authorize } from '@cloudmastershub/middleware';
import {
  // Public
  getBootcamps,
  getBootcampBySlug,
  // Protected
  createBootcampCheckout,
  getUserEnrollments,
  // Admin
  getAllBootcamps,
  createBootcamp,
  updateBootcamp,
  deleteBootcamp,
  createManualEnrollment,
  updateEnrollment,
  getEnrollmentsByBootcamp
} from '../controllers/bootcamp.controller';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

// List active bootcamps
router.get('/', getBootcamps);

// Get bootcamp by slug
router.get('/slug/:slug', getBootcampBySlug);

// ============================================================================
// PROTECTED ROUTES (require authentication)
// ============================================================================

router.use(authenticateToken);

// Create checkout session for bootcamp purchase
router.post('/checkout', createBootcampCheckout);

// Get user's bootcamp enrollments
router.get('/enrollments/user/:userId', getUserEnrollments);

// ============================================================================
// ADMIN ROUTES (require admin role)
// ============================================================================

router.use(authorize('admin'));

// Bootcamp CRUD
router.get('/admin/all', getAllBootcamps);
router.post('/admin', createBootcamp);
router.put('/admin/:id', updateBootcamp);
router.delete('/admin/:id', deleteBootcamp);

// Enrollment management
router.get('/admin/enrollments/bootcamp/:bootcampId', getEnrollmentsByBootcamp);
router.post('/admin/enrollments', createManualEnrollment);
router.put('/admin/enrollments/:id', updateEnrollment);

export default router;
