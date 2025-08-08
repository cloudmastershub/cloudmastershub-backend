import { Router } from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  enrollInCourse,
  getUserCourses,
} from '../controllers/courseController';
import { authenticate } from '@cloudmastershub/middleware';
import { 
  requireSubscription, 
  requireCourseAccess, 
  requirePremiumSubscription 
} from '@cloudmastershub/middleware';
import { validateSlugParam } from '../utils/slugValidation';

const router = Router();

// Public routes (no authentication required)
router.get('/', getAllCourses); // Browse courses
router.get('/:id', validateSlugParam('id'), getCourseById); // View course details

// Protected routes (authentication required)
router.post('/', authenticate, requirePremiumSubscription(), createCourse); // Create course (instructors)
router.put('/:id', authenticate, validateSlugParam('id'), updateCourse); // Update course (own course or admin)
router.delete('/:id', authenticate, validateSlugParam('id'), deleteCourse); // Delete course (admin only)

// Course enrollment and content access
router.post('/:id/enroll', authenticate, validateSlugParam('id'), enrollInCourse); // Free enrollment
router.get('/:id/content', authenticate, validateSlugParam('id'), (req, res, next) => {
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

// Course progress endpoint (for learning interface)
router.get('/:id/progress', (req, res, next) => {
  const courseSlug = req.params.id;
  const userId = req.headers['x-user-id'] as string;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'User authentication required',
      error: { code: 'USER_ID_REQUIRED' }
    });
  }
  
  // Import and use the progress controller logic directly here
  const { CourseProgress } = require('../models');
  const logger = require('../utils/logger').default;
  
  (async () => {
    try {
      logger.info(`Fetching course progress`, { courseSlug, userId });
      
      // Find course first to get the ObjectId
      const { Course } = require('../models');
      const course = await Course.findOne({ slug: courseSlug }).lean();
      
      if (!course) {
        return res.status(404).json({
          success: false,
          message: 'Course not found',
          error: { code: 'COURSE_NOT_FOUND' }
        });
      }
      
      // Find progress record
      const progress = await CourseProgress.findOne({
        userId,
        courseId: course._id.toString()
      }).lean();
      
      if (!progress) {
        // User not enrolled
        return res.json({
          success: true,
          data: null
        });
      }
      
      logger.info(`Found progress record`, { userId, courseId: course._id.toString(), progress: progress.progress });
      
      res.json({
        success: true,
        data: {
          userId: progress.userId,
          courseId: course.slug,
          enrolledAt: progress.enrolledAt,
          progress: progress.progress || 0,
          lastAccessedAt: progress.lastAccessedAt,
          completedLessons: progress.completedLessons || [],
          currentLesson: progress.currentLesson,
          watchedTime: progress.watchedTime || 0
        }
      });
    } catch (error) {
      logger.error('Error fetching course progress:', error);
      next(error);
    }
  })();
});

// User's enrolled courses (internal service endpoint)
router.get('/user/:userId/courses', getUserCourses);

export default router;
