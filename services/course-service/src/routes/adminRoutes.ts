import { Router, Response, NextFunction } from 'express';
import {
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse
} from '../controllers/courseController';
import {
  getAllLearningPaths,
  getLearningPathById,
  createLearningPath,
  updateLearningPath,
  deleteLearningPath,
  addPathwayStep,
  removePathwayStep
} from '../controllers/learningPathController';
import { authenticate, authorize, AuthRequest } from '@cloudmastershub/middleware';
import { Course } from '../models';
import logger from '../utils/logger';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

/**
 * Update course instructor assignment
 * Allows admins to assign/reassign instructors to any course
 * SPECIFIC ROUTE - Must come before general /courses/:id
 */
router.put('/courses/:id/instructor', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info(`Admin instructor assignment request for course: ${req.params.id}`, { 
      adminId: req.userId,
      body: req.body 
    });

    const { id } = req.params;
    const { instructorId, instructorName, instructorAvatar, instructorBio, instructorExpertise } = req.body;

    if (!instructorId) {
      res.status(400).json({
        success: false,
        message: 'Instructor ID is required',
        error: {
          code: 'MISSING_INSTRUCTOR_ID',
          details: 'instructorId field is required for instructor assignment'
        }
      });
      return;
    }

    // Support both ObjectId and slug lookup like main course controller
    let course = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    
    if (isValidObjectId) {
      course = await Course.findById(id);
    }
    
    if (!course) {
      course = await Course.findOne({ slug: id });
    }

    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${id}`
        }
      });
      return;
    }

    const oldInstructorId = course.instructor.id;

    // Update instructor information
    course.instructor = {
      id: instructorId,
      name: instructorName || 'Unknown Instructor',
      email: instructorId || '', // Use instructorId as email since it's typically the email address
      avatar: instructorAvatar || course.instructor.avatar || 'https://via.placeholder.com/150',
      bio: instructorBio || course.instructor.bio || '',
      expertise: instructorExpertise || course.instructor.expertise || [],
      rating: course.instructor.rating || 0
    };

    const updatedCourse = await course.save();

    logger.info(`Admin assigned instructor ${instructorId} to course: ${course.title}`, {
      courseId: id,
      oldInstructorId,
      newInstructorId: instructorId,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: updatedCourse,
      message: 'Instructor assigned successfully'
    });
  } catch (error: any) {
    logger.error('Admin: Failed to assign instructor', error);
    
    if (error.name === 'CastError') {
      res.status(400).json({
        success: false,
        message: 'Invalid course ID format',
        error: {
          code: 'INVALID_ID_FORMAT',
          details: 'Course ID must be a valid MongoDB ObjectId'
        }
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to assign instructor',
        details: error.message
      }
    });
  }
});

/**
 * Get all courses in the system (admin view)
 * Admins can see all courses regardless of instructor or status
 */
router.get('/courses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin requesting all courses', { 
      adminId: req.userId,
      queryParams: req.query 
    });

    // Remove instructor filter and status filter for admin view
    const originalQuery = { ...req.query };
    
    // Force status to 'all' to show drafts, published, and archived courses
    req.query.status = 'all';
    
    // Don't filter by instructor - show all courses
    delete req.query.instructor;
    
    logger.info('Admin courses query processed', { 
      originalQuery,
      modifiedQuery: req.query,
      statusOverride: 'all'
    });
    
    await getAllCourses(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to fetch all courses', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch courses',
        details: error.message
      }
    });
  }
});

/**
 * Get course details (admin view)
 * Admins can view any course regardless of instructor
 */
router.get('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await getCourseById(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to fetch course details', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch course details',
        details: error.message
      }
    });
  }
});

/**
 * Update any course (admin privileges)
 * Admins can update any course regardless of ownership
 */
router.put('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Add admin flag to headers for authorization check in updateCourse
    req.headers['x-is-admin'] = 'true';
    req.headers['x-user-id'] = req.userId;
    
    await updateCourse(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to update course', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update course',
        details: error.message
      }
    });
  }
});

/**
 * Delete any course (admin privileges)
 * Admins can delete any course regardless of ownership
 */
router.delete('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Add admin flag to headers for authorization check in deleteCourse
    req.headers['x-is-admin'] = 'true';
    req.headers['x-user-id'] = req.userId;
    
    await deleteCourse(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to delete course', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete course',
        details: error.message
      }
    });
  }
});

/**
 * Get all instructors in the system
 * Returns a list of unique instructors from all courses
 */
router.get('/instructors', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Aggregate unique instructors from all courses
    const instructors = await Course.aggregate([
      {
        $group: {
          _id: '$instructor.id',
          name: { $first: '$instructor.name' },
          avatar: { $first: '$instructor.avatar' },
          bio: { $first: '$instructor.bio' },
          expertise: { $first: '$instructor.expertise' },
          rating: { $avg: '$instructor.rating' },
          courseCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: 1,
          avatar: 1,
          bio: 1,
          expertise: 1,
          rating: { $round: ['$rating', 1] },
          courseCount: 1
        }
      },
      {
        $sort: { courseCount: -1 }
      }
    ]);

    logger.info(`Admin: Retrieved ${instructors.length} unique instructors`);

    res.json({
      success: true,
      data: instructors,
      total: instructors.length
    });
  } catch (error: any) {
    logger.error('Admin: Failed to fetch instructors', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch instructors',
        details: error.message
      }
    });
  }
});

/**
 * Get course statistics for admin dashboard
 */
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await Course.aggregate([
      {
        $group: {
          _id: null,
          totalCourses: { $sum: 1 },
          publishedCourses: {
            $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
          },
          draftCourses: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          totalEnrollments: { $sum: '$enrollmentCount' },
          averageRating: { $avg: '$rating' },
          totalRevenue: { $sum: '$price' },
          uniqueInstructors: { $addToSet: '$instructor.id' }
        }
      },
      {
        $project: {
          _id: 0,
          totalCourses: 1,
          publishedCourses: 1,
          draftCourses: 1,
          totalEnrollments: 1,
          averageRating: { $round: ['$averageRating', 1] },
          totalRevenue: 1,
          uniqueInstructors: { $size: '$uniqueInstructors' }
        }
      }
    ]);

    const result = stats[0] || {
      totalCourses: 0,
      publishedCourses: 0,
      draftCourses: 0,
      totalEnrollments: 0,
      averageRating: 0,
      totalRevenue: 0,
      uniqueInstructors: 0
    };

    logger.info('Admin: Retrieved platform statistics', result);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Admin: Failed to fetch platform statistics', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch platform statistics',
        details: error.message
      }
    });
  }
});

/**
 * Learning Path Management Routes
 * Admins can manage all learning paths
 */

// Get all learning paths (admin view)
router.get('/paths', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin requesting all learning paths', { 
      adminId: req.userId,
      queryParams: req.query 
    });
    await getAllLearningPaths(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to fetch learning paths', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch learning paths',
        details: error.message
      }
    });
  }
});

// Get learning path details (admin view)
router.get('/paths/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await getLearningPathById(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to fetch learning path details', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch learning path details',
        details: error.message
      }
    });
  }
});

// Create learning path (admin only)
router.post('/paths', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin creating learning path', {
      adminId: req.userId,
      pathData: req.body
    });
    await createLearningPath(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to create learning path', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to create learning path',
        details: error.message
      }
    });
  }
});

// Update learning path (admin only)
router.put('/paths/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin updating learning path', {
      adminId: req.userId,
      pathId: req.params.id,
      updates: req.body
    });
    await updateLearningPath(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to update learning path', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update learning path',
        details: error.message
      }
    });
  }
});

// Delete learning path (admin only)
router.delete('/paths/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin deleting learning path', {
      adminId: req.userId,
      pathId: req.params.id
    });
    await deleteLearningPath(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to delete learning path', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete learning path',
        details: error.message
      }
    });
  }
});

// Add course to learning path (admin only)
router.post('/paths/:id/courses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin adding course to learning path', {
      adminId: req.userId,
      pathId: req.params.id,
      courseData: req.body
    });
    await addPathwayStep(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to add course to learning path', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to add course to learning path',
        details: error.message
      }
    });
  }
});

// Remove course from learning path (admin only)
router.delete('/paths/:id/courses/:courseId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin removing course from learning path', {
      adminId: req.userId,
      pathId: req.params.id,
      courseId: req.params.courseId
    });
    
    // Set the stepId parameter for the removePathwayStep function
    req.params.stepId = req.params.courseId;
    await removePathwayStep(req, res, next);
  } catch (error: any) {
    logger.error('Admin: Failed to remove course from learning path', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to remove course from learning path',
        details: error.message
      }
    });
  }
});

export default router;