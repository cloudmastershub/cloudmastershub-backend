import { Router } from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollInCourse,
} from '../controllers/courseController';
import { authenticate } from '@cloudmastershub/middleware';
import { 
  requireSubscription, 
  requireCourseAccess, 
  requirePremiumSubscription 
} from '@cloudmastershub/middleware';

const router = Router();

// Public routes (no authentication required)
router.get('/', getAllCourses); // Browse courses
router.get('/:id', getCourseById); // View course details

// Protected routes (authentication required)
router.post('/', authenticate, requirePremiumSubscription(), createCourse); // Create course (instructors)
router.put('/:id', authenticate, updateCourse); // Update course (own course or admin)
router.delete('/:id', authenticate, deleteCourse); // Delete course (admin only)

// Course enrollment and content access
router.post('/:id/enroll', authenticate, enrollInCourse); // Free enrollment
router.get('/:id/content', authenticate, (req, res, next) => {
  // Dynamic subscription check based on course
  const courseId = req.params.id;
  return requireCourseAccess(courseId)(req, res, next);
}, (req, res) => {
  // This would be the actual content endpoint
  res.json({
    success: true,
    message: 'Course content access granted',
    courseId: req.params.id
  });
});

export default router;
