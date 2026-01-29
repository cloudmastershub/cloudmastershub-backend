import { Router } from 'express';
import { authenticateToken, authorize } from '@cloudmastershub/middleware';
import {
  // Public
  getBootcamps,
  getBootcampBySlug,
  getBootcampSessions,
  // Protected
  createBootcampCheckout,
  getUserEnrollments,
  // Admin
  getAllBootcamps,
  getBootcampById,
  createBootcamp,
  updateBootcamp,
  deleteBootcamp,
  createManualEnrollment,
  updateEnrollment,
  getEnrollmentsByBootcamp,
  // Admin - Sessions
  getAllSessions,
  getSessionById,
  createSession,
  updateSession,
  deleteSession
} from '../controllers/bootcamp.controller';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

// List active bootcamps
router.get('/', getBootcamps);

// Get bootcamp by slug
router.get('/slug/:slug', getBootcampBySlug);

// Get visible sessions for a bootcamp (previous, current, next)
router.get('/:bootcampId/sessions', getBootcampSessions);

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
router.get('/admin', getAllBootcamps);
router.get('/admin/:id', getBootcampById);
router.post('/admin', createBootcamp);
router.put('/admin/:id', updateBootcamp);
router.delete('/admin/:id', deleteBootcamp);

// Enrollment management
router.get('/admin/enrollments/bootcamp/:bootcampId', getEnrollmentsByBootcamp);
router.post('/admin/enrollments', createManualEnrollment);
router.put('/admin/enrollments/:id', updateEnrollment);

// Session management
router.get('/admin/:bootcampId/sessions', getAllSessions);
router.get('/admin/sessions/:id', getSessionById);
router.post('/admin/:bootcampId/sessions', createSession);
router.put('/admin/sessions/:id', updateSession);
router.delete('/admin/sessions/:id', deleteSession);

export default router;
