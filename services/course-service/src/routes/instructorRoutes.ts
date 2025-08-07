import { Router, Response, NextFunction } from 'express';
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse
} from '../controllers/courseController';
import { authenticate, AuthRequest } from '@cloudmastershub/middleware';
import { requirePremiumSubscription } from '@cloudmastershub/middleware';
import { CourseStatus } from '@cloudmastershub/types';
import { Course } from '../models';
import logger from '../utils/logger';

const router = Router();

// All instructor routes require authentication
router.use(authenticate);

// Instructor course management endpoints
// These endpoints provide instructor-specific functionality for course management

// Get all courses created by the instructor
router.get('/courses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Add instructor filter to the request to only show courses created by this instructor
    req.query.instructor = req.userId;
    // Allow instructors to see all their courses regardless of status
    if (!req.query.status) {
      req.query.status = 'all';
    }
    await getAllCourses(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch instructor courses',
        details: error.message
      }
    });
  }
});

// Get specific course details (instructor must own the course)
router.get('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const instructorId = req.userId;
    
    logger.info('Instructor requesting course details', { 
      courseId: id, 
      instructorId: instructorId 
    });
    
    // Enhanced course lookup with better error handling
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    let course = null;
    
    logger.info('Starting course lookup', { 
      searchId: id, 
      instructorId, 
      isValidObjectId,
      searchType: isValidObjectId ? 'ObjectId' : 'slug'
    });
    
    try {
      if (isValidObjectId) {
        logger.debug('Attempting ObjectId lookup');
        course = await Course.findById(id).select('-__v').lean().maxTimeMS(5000);
        if (course) {
          logger.info('Found course by ObjectId', { courseId: course._id, slug: course.slug });
        }
      }
      
      if (!course) {
        logger.debug('Attempting slug lookup', { slug: id });
        course = await Course.findOne({ slug: id }).select('-__v').lean().maxTimeMS(5000);
        if (course) {
          logger.info('Found course by slug', { courseId: course._id, slug: course.slug });
        }
      }
      
      if (!course) {
        // Enhanced debugging: check for similar courses
        logger.warn('Course not found, checking for similar slugs');
        
        const similarCourses = await Course.find({ 
          slug: { $regex: new RegExp(id.substring(0, Math.min(10, id.length)), 'i') } 
        }).select('slug title instructor.id').limit(5).maxTimeMS(3000);
        
        // Also check recent courses by this instructor
        const recentInstructorCourses = await Course.find({ 
          'instructor.id': instructorId 
        }).select('slug title createdAt').sort({ createdAt: -1 }).limit(3).maxTimeMS(3000);
        
        logger.warn('Course not found - debugging info', { 
          searchId: id, 
          instructorId,
          isValidObjectId,
          similarCourses: similarCourses.map(c => ({ 
            slug: c.slug, 
            title: c.title,
            isOwner: c.instructor.id === instructorId
          })),
          recentInstructorCourses: recentInstructorCourses.map(c => ({ 
            slug: c.slug, 
            title: c.title,
            createdAt: c.createdAt
          }))
        });
        
        res.status(404).json({
          success: false,
          message: 'Course not found',
          error: {
            code: 'COURSE_NOT_FOUND',
            details: `No course found with ID or slug: ${id}`,
            suggestions: similarCourses.length > 0 ? 
              'Similar courses found - check if you\'re using the correct slug' : 
              'No similar courses found - verify the course was created successfully'
          }
        });
        return;
      }
    } catch (dbError: any) {
      logger.error('Database error during course lookup', {
        error: dbError.message,
        searchId: id,
        instructorId,
        stack: dbError.stack
      });
      
      res.status(500).json({
        success: false,
        message: 'Database error while searching for course',
        error: {
          code: 'DATABASE_LOOKUP_ERROR',
          details: 'Unable to search for course due to database connection issues'
        }
      });
      return;
    }
    
    // Check if instructor owns this course
    if (course.instructor.id !== instructorId) {
      logger.warn('Instructor attempted to access course they do not own', {
        courseId: id,
        courseInstructor: course.instructor.id,
        requestingInstructor: instructorId
      });
      res.status(403).json({
        success: false,
        message: 'Access denied',
        error: {
          code: 'COURSE_ACCESS_DENIED',
          details: 'You can only access courses that you have created'
        }
      });
      return;
    }
    
    logger.info('Retrieved instructor course from MongoDB', { 
      courseId: course._id, 
      title: course.title,
      instructorId: course.instructor.id
    });
    
    res.json({
      success: true,
      data: course,
    });
    
  } catch (error: any) {
    logger.error('Error fetching instructor course:', {
      error: error.message,
      courseId: req.params.id,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch course details',
        details: error.message
      }
    });
  }
});

// Create new course (requires premium subscription for instructors)
// Temporarily modify to bypass subscription check for admin/instructor roles
router.post('/courses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Log the incoming request
    logger.info('📨 Instructor course creation request received:', {
      method: req.method,
      url: req.url,
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : 'none',
        contentType: req.headers['content-type']
      },
      bodyKeys: Object.keys(req.body || {}),
      body: req.body
    });
    
    // Check if user has admin or instructor role
    const userRoles = req.userRoles || req.user?.roles || [];
    const isAdminOrInstructor = userRoles.includes('admin') || userRoles.includes('instructor');
    
    logger.info('🎓 Course creation request:', {
      userId: req.userId,
      userEmail: req.userEmail,
      userRoles: userRoles,
      isAdminOrInstructor,
      hasUserObject: !!req.user,
      userObjectRoles: req.user?.roles
    });
    
    // If not admin/instructor, check subscription
    if (!isAdminOrInstructor) {
      logger.info('📊 User is not admin/instructor, checking subscription...');
      // Apply subscription middleware manually
      return requirePremiumSubscription()(req, res, async () => {
        await createCourse(req, res, next);
      });
    }
    
    logger.info('✅ Admin/instructor detected, bypassing subscription check');
    // Admin/instructor can create courses without subscription check
    await createCourse(req, res, next);
  } catch (error: any) {
    logger.error('Error in instructor course creation route:', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      body: req.body
    });
    
    // Don't override createCourse controller's error response
    // The createCourse controller handles its own error responses
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create course',
          details: error.message
        }
      });
    }
  }
});

// Update course (instructor must own the course)
router.put('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await updateCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to update course',
        details: error.message
      }
    });
  }
});

// Delete course (instructor must own the course)
router.delete('/courses/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await deleteCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete course',
        details: error.message
      }
    });
  }
});

// Publish course
router.post('/courses/:id/publish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // This would typically set the course status to 'published' or 'under_review'
    // For now, we'll use the update course controller with status change
    req.body = { status: 'published' };
    await updateCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to publish course',
        details: error.message
      }
    });
  }
});

// Unpublish course
router.post('/courses/:id/unpublish', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Set course status to draft
    req.body = { status: 'draft' };
    await updateCourse(req, res, next);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to unpublish course',
        details: error.message
      }
    });
  }
});

// Get instructor statistics/analytics (placeholder for now)
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    
    // Get real instructor statistics
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    const publishedCourses = instructorCourses.filter(c => c.status === CourseStatus.PUBLISHED);
    const draftCourses = instructorCourses.filter(c => c.status === CourseStatus.DRAFT);
    
    const stats = {
      totalCourses: instructorCourses.length,
      totalStudents: instructorCourses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0),
      totalRevenue: 0, // Would need payment integration
      averageRating: instructorCourses.length > 0 
        ? instructorCourses.reduce((sum, course) => sum + (course.rating || 0), 0) / instructorCourses.length
        : 0,
      coursesPublished: publishedCourses.length,
      coursesDraft: draftCourses.length,
      deploymentVersion: 'v3-with-instructor-validation',
      timestamp: new Date().toISOString(),
      // Debug info for troubleshooting
      debug: {
        instructorId,
        sampleCourseIds: instructorCourses.slice(0, 3).map(c => ({ id: c._id, title: c.title }))
      }
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Error fetching instructor stats:', {
      error: error.message,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch instructor statistics',
        details: error.message
      }
    });
  }
});

// Analytics endpoints
// Get instructor analytics overview
router.get('/analytics/overview', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    
    // Get instructor courses and basic analytics
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    const publishedCourses = instructorCourses.filter(c => c.status === CourseStatus.PUBLISHED);
    
    const analytics = {
      totalCourses: instructorCourses.length,
      publishedCourses: publishedCourses.length,
      totalStudents: instructorCourses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0),
      averageRating: instructorCourses.length > 0 
        ? instructorCourses.reduce((sum, course) => sum + (course.rating || 0), 0) / instructorCourses.length
        : 0,
      totalRevenue: 0, // Placeholder - would integrate with payment service
      thisMonthEnrollments: 0, // Placeholder - would require date filtering
      coursesInReview: instructorCourses.filter(c => c.status === CourseStatus.UNDER_REVIEW).length,
      draftCourses: instructorCourses.filter(c => c.status === CourseStatus.DRAFT).length,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Error fetching instructor analytics overview:', {
      error: error.message,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch analytics overview',
        details: error.message
      }
    });
  }
});

// Get course-specific analytics
router.get('/analytics/courses/:courseId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.userId;
    
    // Find course by ObjectId or slug
    let course = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(courseId);
    
    if (isValidObjectId) {
      course = await Course.findById(courseId).lean();
    }
    
    if (!course) {
      course = await Course.findOne({ slug: courseId }).lean();
    }
    
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { code: 'COURSE_NOT_FOUND' }
      });
      return;
    }
    
    // Check permission
    if (course.instructor.id !== instructorId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
        error: { code: 'COURSE_ACCESS_DENIED' }
      });
      return;
    }
    
    const analytics = {
      courseId: course._id,
      title: course.title,
      totalStudents: course.enrollmentCount || 0,
      rating: course.rating || 0,
      completionRate: 0, // Placeholder - would require progress analysis
      averageWatchTime: 0, // Placeholder - would require analytics data
      revenue: 0, // Placeholder - would integrate with payment service
      enrollmentsByMonth: [], // Placeholder - would require time-series data
      topPerformingLessons: [], // Placeholder - would require lesson analytics
      studentFeedback: [], // Placeholder - would require review data
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Error fetching course analytics:', {
      error: error.message,
      courseId: req.params.courseId,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch course analytics',
        details: error.message
      }
    });
  }
});

// Get student analytics
router.get('/analytics/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    
    // Get instructor courses to calculate student metrics
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    
    const analytics = {
      totalStudents: instructorCourses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0),
      activeStudents: 0, // Placeholder - would require recent activity data
      newStudentsThisMonth: 0, // Placeholder - would require enrollment date filtering
      studentRetentionRate: 0, // Placeholder - would require completion analysis
      topPerformingStudents: [], // Placeholder - would require student progress data
      studentsByCountry: [], // Placeholder - would require user geographic data
      studentEngagement: {
        averageCompletionRate: 0,
        averageTimeSpent: 0,
        mostActiveHours: []
      },
      coursePopularity: instructorCourses.map(course => ({
        courseId: course._id,
        title: course.title,
        enrollmentCount: course.enrollmentCount || 0,
        rating: course.rating || 0
      })).sort((a, b) => b.enrollmentCount - a.enrollmentCount),
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Error fetching student analytics:', {
      error: error.message,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch student analytics',
        details: error.message
      }
    });
  }
});

// Get revenue analytics
router.get('/analytics/revenue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    
    // Get instructor courses for revenue calculation
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    
    const analytics = {
      totalRevenue: 0, // Placeholder - would integrate with payment service
      thisMonthRevenue: 0, // Placeholder - would require payment data filtering
      revenueByMonth: [], // Placeholder - would require time-series payment data
      revenueByCourse: instructorCourses.map(course => ({
        courseId: course._id,
        title: course.title,
        price: course.price || 0,
        enrollmentCount: course.enrollmentCount || 0,
        estimatedRevenue: (course.price || 0) * (course.enrollmentCount || 0) * 0.7 // 70% instructor share estimate
      })).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue),
      pendingPayouts: 0, // Placeholder - would require payout system integration
      averageOrderValue: 0, // Placeholder - would require payment analysis
      conversionRate: 0, // Placeholder - would require funnel analysis
      refundRate: 0, // Placeholder - would require refund data
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    logger.error('Error fetching revenue analytics:', {
      error: error.message,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch revenue analytics',
        details: error.message
      }
    });
  }
});

// Student management endpoints
// Get all students across instructor's courses
router.get('/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    
    // Get instructor courses to find enrolled students
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    
    const students = {
      totalStudents: instructorCourses.reduce((sum, course) => sum + (course.enrollmentCount || 0), 0),
      courseEnrollments: instructorCourses.map(course => ({
        courseId: course._id,
        title: course.title,
        enrollmentCount: course.enrollmentCount || 0,
        students: [] // Placeholder - would require enrollment/progress data integration
      })),
      recentEnrollments: [], // Placeholder - would require recent enrollment data
      topPerformingStudents: [], // Placeholder - would require progress analysis
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: students
    });
  } catch (error: any) {
    logger.error('Error fetching instructor students:', {
      error: error.message,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch students',
        details: error.message
      }
    });
  }
});

// Get students for specific course
router.get('/courses/:courseId/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.params;
    const instructorId = req.userId;
    
    // Find course by ObjectId or slug
    let course = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(courseId);
    
    if (isValidObjectId) {
      course = await Course.findById(courseId).lean();
    }
    
    if (!course) {
      course = await Course.findOne({ slug: courseId }).lean();
    }
    
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { code: 'COURSE_NOT_FOUND' }
      });
      return;
    }
    
    // Check permission
    if (course.instructor.id !== instructorId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
        error: { code: 'COURSE_ACCESS_DENIED' }
      });
      return;
    }
    
    const students = {
      courseId: course._id,
      courseTitle: course.title,
      totalEnrollments: course.enrollmentCount || 0,
      students: [], // Placeholder - would require CourseProgress integration
      enrollmentStats: {
        totalEnrollments: course.enrollmentCount || 0,
        activeStudents: 0,
        completedStudents: 0,
        averageProgress: 0
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: students
    });
  } catch (error: any) {
    logger.error('Error fetching course students:', {
      error: error.message,
      courseId: req.params.courseId,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch course students',
        details: error.message
      }
    });
  }
});

export default router;