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
      instructorId: instructorId,
      requestUrl: req.url,
      userAgent: req.headers['user-agent']?.substring(0, 100)
    });
    
    // Enhanced course lookup with better error handling
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    const isValidSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length >= 3 && id.length <= 100;
    let course = null;
    
    logger.info('Starting course lookup', { 
      searchId: id, 
      instructorId, 
      isValidObjectId,
      isValidSlug,
      searchType: isValidObjectId ? 'ObjectId' : (isValidSlug ? 'slug' : 'unknown')
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
        // Enhanced debugging: check for similar courses and exact matches with different casing
        logger.warn('Course not found, performing comprehensive search');
        
        // Check for exact matches with different casing
        const caseInsensitiveCourse = await Course.findOne({ 
          slug: { $regex: new RegExp(`^${id}$`, 'i') }
        }).select('slug title instructor.id').maxTimeMS(3000);
        
        // Check for similar courses
        const similarCourses = await Course.find({ 
          slug: { $regex: new RegExp(id.substring(0, Math.min(10, id.length)), 'i') } 
        }).select('slug title instructor.id').limit(5).maxTimeMS(3000);
        
        // Check all courses by this instructor
        const allInstructorCourses = await Course.find({ 
          'instructor.id': instructorId 
        }).select('slug title createdAt').sort({ createdAt: -1 }).limit(10).maxTimeMS(3000);
        
        // Check if course exists but belongs to different instructor
        const courseByDifferentInstructor = await Course.findOne({
          slug: id
        }).select('slug title instructor.id instructor.name').maxTimeMS(3000);
        
        logger.error('Course not found - comprehensive debugging info', { 
          searchId: id, 
          instructorId,
          isValidObjectId,
          isValidSlug,
          caseInsensitiveCourse: caseInsensitiveCourse ? {
            slug: caseInsensitiveCourse.slug,
            title: caseInsensitiveCourse.title,
            isOwner: caseInsensitiveCourse.instructor.id === instructorId
          } : null,
          courseByDifferentInstructor: courseByDifferentInstructor ? {
            slug: courseByDifferentInstructor.slug,
            title: courseByDifferentInstructor.title,
            actualInstructor: courseByDifferentInstructor.instructor
          } : null,
          similarCourses: similarCourses.map(c => ({ 
            slug: c.slug, 
            title: c.title,
            isOwner: c.instructor.id === instructorId
          })),
          allInstructorCourses: allInstructorCourses.map(c => ({ 
            slug: c.slug, 
            title: c.title,
            createdAt: c.createdAt
          }))
        });
        
        // Provide helpful error response
        let suggestions = [];
        let details = `No course found with ID or slug: ${id}`;
        
        if (caseInsensitiveCourse && caseInsensitiveCourse.instructor.id === instructorId) {
          suggestions.push(`Did you mean "${caseInsensitiveCourse.slug}"? (case mismatch)`);
          details += `. Found similar course with different casing: "${caseInsensitiveCourse.slug}"`;
        } else if (courseByDifferentInstructor) {
          suggestions.push('Course exists but belongs to different instructor');
          details += `. Course exists but owned by ${courseByDifferentInstructor.instructor.name} (${courseByDifferentInstructor.instructor.id})`;
        } else if (similarCourses.length > 0) {
          const ownedSimilar = similarCourses.filter(c => c.instructor.id === instructorId);
          if (ownedSimilar.length > 0) {
            suggestions.push(`Similar courses you own: ${ownedSimilar.map(c => c.slug).join(', ')}`);
          }
          suggestions.push('Check slug format - must be lowercase with hyphens');
        } else if (allInstructorCourses.length > 0) {
          suggestions.push(`Your available courses: ${allInstructorCourses.slice(0, 3).map(c => c.slug).join(', ')}`);
        } else {
          suggestions.push('No courses found for your account - create a course first');
        }

        res.status(404).json({
          success: false,
          message: 'Course not found',
          error: {
            code: 'COURSE_NOT_FOUND',
            details: details,
            searchedFor: id,
            isValidSlug: isValidSlug,
            suggestions: suggestions,
            debug: {
              instructorId: instructorId,
              totalCoursesOwned: allInstructorCourses.length,
              searchType: isValidObjectId ? 'ObjectId' : (isValidSlug ? 'slug' : 'invalid_format')
            }
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
    
    logger.info('🔍 Instructor stats request received:', {
      instructorId,
      userEmail: req.userEmail,
      userRoles: req.userRoles,
      url: req.url,
      timestamp: new Date().toISOString()
    });
    
    // Get real instructor statistics
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    
    logger.info('📊 Instructor courses query result:', {
      instructorId,
      queryFilter: { 'instructor.id': instructorId },
      foundCourses: instructorCourses.length,
      courseIds: instructorCourses.map(c => c._id),
      courseTitles: instructorCourses.map(c => c.title)
    });
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

// Helper function to extract lessons from curriculum
function extractLessonsFromCurriculum(curriculum: any[]): { lessonId: string; title: string; sectionTitle: string; duration: number }[] {
  const lessons: { lessonId: string; title: string; sectionTitle: string; duration: number }[] = [];
  if (!curriculum) return lessons;

  for (const section of curriculum) {
    if (section.lessons && Array.isArray(section.lessons)) {
      for (const lesson of section.lessons) {
        lessons.push({
          lessonId: lesson.id,
          title: lesson.title,
          sectionTitle: section.title,
          duration: lesson.duration || 0
        });
      }
    }
  }
  return lessons;
}

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

    // Get real enrollment data for analytics
    const { CourseProgress } = await import('../models');
    const enrollments = await CourseProgress.find({
      courseId: course._id.toString()
    }).lean();

    const totalEnrolled = enrollments.length;
    const completedEnrollments = enrollments.filter(e => e.completedAt);
    const completionRate = totalEnrolled > 0
      ? Math.round((completedEnrollments.length / totalEnrolled) * 100)
      : 0;

    // Calculate average watch time
    const totalWatchTime = enrollments.reduce((sum, e) => sum + (e.watchedTime || 0), 0);
    const averageWatchTime = totalEnrolled > 0
      ? Math.round(totalWatchTime / totalEnrolled)
      : 0;

    // Aggregate lesson completion data for top performing lessons
    const lessonCompletionMap: Record<string, number> = {};
    for (const enrollment of enrollments) {
      if (enrollment.completedLessons && Array.isArray(enrollment.completedLessons)) {
        for (const lessonId of enrollment.completedLessons) {
          lessonCompletionMap[lessonId] = (lessonCompletionMap[lessonId] || 0) + 1;
        }
      }
    }

    // Extract lesson details and merge with completion counts
    const lessons = extractLessonsFromCurriculum(course.curriculum);
    const lessonStats = lessons.map(lesson => ({
      lessonId: lesson.lessonId,
      title: lesson.title,
      section: lesson.sectionTitle,
      completions: lessonCompletionMap[lesson.lessonId] || 0,
      completionRate: totalEnrolled > 0
        ? Math.round(((lessonCompletionMap[lesson.lessonId] || 0) / totalEnrolled) * 100)
        : 0
    }));

    // Get top performing lessons (by completion rate)
    const topPerformingLessons = [...lessonStats]
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 5);

    // Calculate enrollments by month (last 6 months)
    const enrollmentsByMonth: { month: string; count: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const count = enrollments.filter(e => {
        const enrolledAt = new Date(e.enrolledAt);
        return enrolledAt >= monthStart && enrolledAt <= monthEnd;
      }).length;
      enrollmentsByMonth.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        count
      });
    }

    const analytics = {
      courseId: course._id,
      title: course.title,
      totalStudents: totalEnrolled,
      rating: course.rating || 0,
      completionRate,
      averageWatchTime,
      revenue: (course.price || 0) * totalEnrolled * 0.7, // Estimate 70% instructor share
      enrollmentsByMonth,
      topPerformingLessons,
      studentFeedback: [], // Would require review data integration
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

// Get lesson-level analytics for a specific course
router.get('/analytics/courses/:courseId/lessons', async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    // Get enrollment data
    const { CourseProgress } = await import('../models');
    const enrollments = await CourseProgress.find({
      courseId: course._id.toString()
    }).lean();

    const totalEnrolled = enrollments.length;

    // Aggregate lesson completion counts
    const lessonCompletionMap: Record<string, Set<string>> = {};
    for (const enrollment of enrollments) {
      if (enrollment.completedLessons && Array.isArray(enrollment.completedLessons)) {
        for (const lessonId of enrollment.completedLessons) {
          if (!lessonCompletionMap[lessonId]) {
            lessonCompletionMap[lessonId] = new Set();
          }
          lessonCompletionMap[lessonId].add(enrollment.userId);
        }
      }
    }

    // Extract lesson details from curriculum
    const lessons = extractLessonsFromCurriculum(course.curriculum);

    // Build lesson analytics with stats
    const lessonAnalytics = lessons.map((lesson, index) => {
      const uniqueViewers = lessonCompletionMap[lesson.lessonId]?.size || 0;
      const completions = lessonCompletionMap[lesson.lessonId]?.size || 0;

      return {
        lessonId: lesson.lessonId,
        title: lesson.title,
        section: lesson.sectionTitle,
        duration: lesson.duration,
        order: index + 1,
        completions,
        uniqueViewers,
        completionRate: totalEnrolled > 0
          ? Math.round((completions / totalEnrolled) * 100)
          : 0,
        dropOffRate: index > 0
          ? (() => {
              const prevLesson = lessons[index - 1];
              const prevCompletions = lessonCompletionMap[prevLesson.lessonId]?.size || 0;
              if (prevCompletions === 0) return 0;
              return Math.round(((prevCompletions - completions) / prevCompletions) * 100);
            })()
          : 0
      };
    });

    // Calculate summary statistics
    const avgCompletionRate = lessonAnalytics.length > 0
      ? Math.round(lessonAnalytics.reduce((sum, l) => sum + l.completionRate, 0) / lessonAnalytics.length)
      : 0;

    const highestDropOff = lessonAnalytics
      .filter(l => l.order > 1)
      .sort((a, b) => b.dropOffRate - a.dropOffRate)[0];

    res.json({
      success: true,
      data: {
        courseId: course._id,
        courseTitle: course.title,
        totalEnrolled,
        totalLessons: lessons.length,
        averageCompletionRate: avgCompletionRate,
        highestDropOffLesson: highestDropOff ? {
          lessonId: highestDropOff.lessonId,
          title: highestDropOff.title,
          dropOffRate: highestDropOff.dropOffRate
        } : null,
        lessons: lessonAnalytics,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Error fetching lesson analytics:', {
      error: error.message,
      courseId: req.params.courseId,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch lesson analytics',
        details: error.message
      }
    });
  }
});

// Get student analytics
router.get('/analytics/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    
    // Get instructor courses
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    const courseIds = instructorCourses.map(c => c._id.toString());
    
    if (courseIds.length === 0) {
      res.json({
        success: true,
        data: {
          totalStudents: 0,
          activeStudents: 0,
          completionRate: 0,
          averageProgress: 0,
          recentActivities: [],
          topPerformers: [],
          strugglingStudents: []
        }
      });
      return;
    }
    
    // Get real enrollment data
    const { CourseProgress } = await import('../models');
    const enrollments = await CourseProgress.find({ 
      courseId: { $in: courseIds } 
    }).lean();
    
    // Calculate real analytics
    const totalStudents = enrollments.length;
    const completedStudents = enrollments.filter(e => e.completedAt).length;
    const completionRate = totalStudents > 0 ? Math.round((completedStudents / totalStudents) * 100) : 0;
    const averageProgress = totalStudents > 0 
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / totalStudents) 
      : 0;
    
    // Recent activity (last 7 days)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 7);
    const activeStudents = enrollments.filter(e => e.lastAccessedAt >= recentDate).length;
    
    // Top performers (highest progress)
    const topPerformers = enrollments
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 5)
      .map(e => ({
        userId: e.userId,
        progress: e.progress,
        courseId: e.courseId
      }));
    
    // Struggling students (low progress, enrolled > 30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const strugglingStudents = enrollments
      .filter(e => e.enrolledAt <= thirtyDaysAgo && e.progress < 25)
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 5)
      .map(e => ({
        userId: e.userId,
        progress: e.progress,
        courseId: e.courseId,
        enrolledAt: e.enrolledAt
      }));
    
    const analytics = {
      totalStudents,
      activeStudents,
      completionRate,
      averageProgress,
      recentActivities: [], // Would require activity log integration
      topPerformers,
      strugglingStudents,
      coursePopularity: instructorCourses.map(course => {
        const courseEnrollments = enrollments.filter(e => e.courseId === course._id.toString());
        return {
          courseId: course._id,
          title: course.title,
          enrollmentCount: courseEnrollments.length,
          completionRate: courseEnrollments.length > 0 
            ? Math.round((courseEnrollments.filter(e => e.completedAt).length / courseEnrollments.length) * 100)
            : 0,
          averageProgress: courseEnrollments.length > 0
            ? Math.round(courseEnrollments.reduce((sum, e) => sum + e.progress, 0) / courseEnrollments.length)
            : 0
        };
      }).sort((a, b) => b.enrollmentCount - a.enrollmentCount),
      timestamp: new Date().toISOString()
    };
    
    logger.info('Retrieved student analytics from database:', {
      instructorId,
      totalStudents,
      activeStudents,
      completionRate,
      averageProgress
    });
    
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

// Get engagement analytics
router.get('/analytics/engagement', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instructorId = req.userId;
    const { timeframe = 'month' } = req.query;
    
    // Get instructor courses
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).lean();
    const courseIds = instructorCourses.map(c => c._id.toString());
    
    if (courseIds.length === 0) {
      res.json({
        success: true,
        data: {
          activeStudents: 0,
          averageSessionTime: 0,
          completionRate: 0,
          questionResponseTime: 0,
          studentSatisfaction: 0,
          coursesCompleted: 0,
          certificatesIssued: 0,
          retentionRate: 0
        }
      });
      return;
    }
    
    // Get real enrollment data
    const { CourseProgress } = await import('../models');
    const enrollments = await CourseProgress.find({ 
      courseId: { $in: courseIds } 
    }).lean();
    
    // Calculate engagement metrics
    const now = new Date();
    let daysToLookBack = 30; // default for month
    if (timeframe === 'week') daysToLookBack = 7;
    if (timeframe === 'quarter') daysToLookBack = 90;
    if (timeframe === 'year') daysToLookBack = 365;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToLookBack);
    
    // Active students (accessed course in timeframe)
    const activeStudents = enrollments.filter(e => e.lastAccessedAt >= cutoffDate).length;
    
    // Completion metrics
    const completedEnrollments = enrollments.filter(e => e.completedAt && e.completedAt >= cutoffDate);
    const coursesCompleted = completedEnrollments.length;
    const certificatesIssued = completedEnrollments.length; // Assuming certificate on completion
    
    // Overall completion rate
    const completionRate = enrollments.length > 0 
      ? Math.round((enrollments.filter(e => e.completedAt).length / enrollments.length) * 100)
      : 0;
    
    // Retention rate (students who returned after first lesson)
    const studentsWithProgress = enrollments.filter(e => e.progress > 10);
    const retentionRate = enrollments.length > 0
      ? Math.round((studentsWithProgress.length / enrollments.length) * 100)
      : 0;
    
    // Average session time (placeholder - would require session tracking)
    const averageSessionTime = 45; // Default 45 minutes
    
    // Question response time (placeholder - would require Q&A system integration)
    const questionResponseTime = 24; // Default 24 hours
    
    // Student satisfaction (placeholder - would require review system integration)
    const averageRating = instructorCourses.reduce((sum, course) => sum + (course.rating || 0), 0) / (instructorCourses.length || 1);
    const studentSatisfaction = Math.round(averageRating * 10) / 10; // Round to 1 decimal
    
    const engagementMetrics = {
      activeStudents,
      averageSessionTime,
      completionRate,
      questionResponseTime,
      studentSatisfaction,
      coursesCompleted,
      certificatesIssued,
      retentionRate,
      // Additional metrics
      totalEnrollments: enrollments.length,
      newEnrollments: enrollments.filter(e => e.enrolledAt >= cutoffDate).length,
      averageProgress: enrollments.length > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
        : 0,
      timestamp: new Date().toISOString()
    };
    
    logger.info('Retrieved engagement metrics:', {
      instructorId,
      timeframe,
      activeStudents,
      completionRate,
      retentionRate
    });
    
    res.json({
      success: true,
      data: engagementMetrics
    });
  } catch (error: any) {
    logger.error('Error fetching engagement analytics:', {
      error: error.message,
      instructorId: req.userId
    });
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch engagement analytics',
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
    
    // Get instructor courses
    const instructorCourses = await Course.find({ 'instructor.id': instructorId }).select('_id title thumbnail').lean();
    const courseIds = instructorCourses.map(c => c._id.toString());
    
    if (courseIds.length === 0) {
      res.json({
        success: true,
        data: []
      });
      return;
    }
    
    // Get real student enrollment data from CourseProgress
    const { CourseProgress } = await import('../models');
    const enrollments = await CourseProgress.find({ 
      courseId: { $in: courseIds } 
    }).select('userId courseId enrolledAt progress lastAccessedAt completedLessons completedAt').sort({ lastAccessedAt: -1 }).lean();
    
    if (enrollments.length === 0) {
      res.json({
        success: true,
        data: []
      });
      return;
    }
    
    // Get real user data from user service
    const { userServiceClient } = await import('../utils/userServiceClient');
    const userIds = [...new Set(enrollments.map(e => e.userId))]; // Remove duplicates
    const userProfiles = await userServiceClient.getUserProfiles(userIds);
    
    // Transform data to match frontend expectations with real user data
    const students = enrollments.map(enrollment => {
      const course = instructorCourses.find(c => c._id.toString() === enrollment.courseId);
      const userProfile = userProfiles[enrollment.userId];
      
      return {
        id: enrollment._id.toString(),
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        status: enrollment.completedAt ? 'completed' : 'active',
        progress: {
          completedLessons: enrollment.completedLessons?.length || 0,
          totalLessons: course?.curriculum?.reduce((sum, section) => sum + (section.lessons?.length || 0), 0) || 10,
          completedLabs: 0, // Default - would require lab progress integration
          totalLabs: 3, // Default - would be calculated from course curriculum
          overallProgress: enrollment.progress,
          lastActivity: enrollment.lastAccessedAt.toISOString()
        },
        course: {
          id: course?._id.toString() || enrollment.courseId,
          title: course?.title || 'Unknown Course',
          thumbnail: course?.thumbnail || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop'
        },
        user: {
          id: userProfile.id,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          email: userProfile.email,
          avatar: userProfile.avatar
        }
      };
    });
    
    logger.info('Retrieved instructor students with real user data:', {
      instructorId,
      totalCourses: instructorCourses.length,
      totalStudents: students.length,
      usersWithProfiles: Object.keys(userProfiles).length
    });
    
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
    
    // Get real student enrollment data
    const { CourseProgress } = await import('../models');
    const enrollments = await CourseProgress.find({ 
      courseId: course._id.toString() 
    }).select('userId courseId enrolledAt progress lastAccessedAt completedLessons completedAt').sort({ lastAccessedAt: -1 }).lean();
    
    if (enrollments.length === 0) {
      const result = {
        courseId: course._id,
        courseTitle: course.title,
        totalEnrollments: 0,
        students: [],
        enrollmentStats: {
          totalEnrollments: 0,
          activeStudents: 0,
          completedStudents: 0,
          averageProgress: 0
        },
        timestamp: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: result
      });
      return;
    }
    
    // Get real user data from user service
    const { userServiceClient } = await import('../utils/userServiceClient');
    const userIds = [...new Set(enrollments.map(e => e.userId))]; // Remove duplicates
    const userProfiles = await userServiceClient.getUserProfiles(userIds);
    
    // Transform to match frontend expectations with real user data
    const students = enrollments.map(enrollment => {
      const userProfile = userProfiles[enrollment.userId];
      
      return {
        id: enrollment._id.toString(),
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        enrolledAt: enrollment.enrolledAt.toISOString(),
        status: enrollment.completedAt ? 'completed' : 'active',
        progress: {
          completedLessons: enrollment.completedLessons?.length || 0,
          totalLessons: course.curriculum?.reduce((sum, section) => sum + (section.lessons?.length || 0), 0) || 10,
          completedLabs: 0, // Would require lab progress integration
          totalLabs: 3, // Default
          overallProgress: enrollment.progress,
          lastActivity: enrollment.lastAccessedAt.toISOString()
        },
        course: {
          id: course._id.toString(),
          title: course.title,
          thumbnail: course.thumbnail || 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=300&fit=crop'
        },
        user: {
          id: userProfile.id,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          email: userProfile.email,
          avatar: userProfile.avatar
        }
      };
    });
    
    // Calculate stats
    const activeStudents = students.filter(s => s.status === 'active').length;
    const completedStudents = students.filter(s => s.status === 'completed').length;
    const averageProgress = students.length > 0 
      ? students.reduce((sum, s) => sum + s.progress.overallProgress, 0) / students.length 
      : 0;
    
    const result = {
      courseId: course._id,
      courseTitle: course.title,
      totalEnrollments: students.length,
      students: students,
      enrollmentStats: {
        totalEnrollments: students.length,
        activeStudents,
        completedStudents,
        averageProgress: Math.round(averageProgress)
      },
      timestamp: new Date().toISOString()
    };
    
    logger.info('Retrieved course students with real user data:', {
      instructorId,
      courseId: course._id,
      totalStudents: students.length,
      activeStudents,
      completedStudents,
      usersWithProfiles: Object.keys(userProfiles).length
    });
    
    res.json({
      success: true,
      data: result
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