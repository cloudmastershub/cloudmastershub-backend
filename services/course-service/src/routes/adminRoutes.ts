import { Router, Response, NextFunction } from 'express';
import {
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse
} from '../controllers/courseController';
import { authenticate, authorize, AuthRequest } from '@cloudmastershub/middleware';
import { Course } from '../models';
import logger from '../utils/logger';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

/**
 * Clean up seeded courses (admin only)
 * Removes courses created by seed scripts to comply with no mock data policy
 * MOST SPECIFIC ROUTE - Must come before /courses/:id
 */
router.delete('/courses/cleanup-seeded', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    logger.info('Admin requesting seeded course cleanup', { adminId: req.userId });

    // Define patterns to identify seeded courses
    const seededInstructorIds = [
      'instructor-1', 'instructor-2', 'instructor-3', 'instructor-4', 'instructor-5',
      'instructor-aws-101', 'instructor-azure-201', 'instructor-gcp-301',
      'instructor-multicloud-401', 'instructor-k8s-301'
    ];

    const seededInstructorNames = [
      'Jane Smith', 'John Doe', 'Sarah Wilson', 'Mike Chen', 'Dr. Emily Rodriguez'
    ];

    // Find seeded courses
    const seededCourses = await Course.find({
      $or: [
        { 'instructor.id': { $in: seededInstructorIds } },
        { 'instructor.name': { $in: seededInstructorNames } }
      ]
    });

    if (seededCourses.length === 0) {
      res.json({
        success: true,
        data: {
          removedCourses: [],
          totalRemoved: 0
        },
        message: 'No seeded courses found to clean up'
      });
      return;
    }

    // Log courses being removed
    logger.info(`Removing ${seededCourses.length} seeded courses:`, {
      courses: seededCourses.map(c => ({ id: c._id, title: c.title, instructor: c.instructor.id }))
    });

    // Remove seeded courses
    const result = await Course.deleteMany({
      $or: [
        { 'instructor.id': { $in: seededInstructorIds } },
        { 'instructor.name': { $in: seededInstructorNames } }
      ]
    });

    const removedCourses = seededCourses.map(c => ({
      id: c._id,
      title: c.title,
      instructor: c.instructor.name,
      instructorId: c.instructor.id
    }));

    logger.info(`Successfully removed ${result.deletedCount} seeded courses`, {
      adminId: req.userId,
      removedCount: result.deletedCount
    });

    res.json({
      success: true,
      data: {
        removedCourses,
        totalRemoved: result.deletedCount
      },
      message: `Successfully removed ${result.deletedCount} seeded courses`
    });

  } catch (error: any) {
    logger.error('Failed to cleanup seeded courses:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to cleanup seeded courses',
        details: error.message
      }
    });
  }
});

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
 * Enroll a student in a course (admin privileges)
 * Admins can enroll any student in any course
 */
router.post('/courses/:id/enroll-student', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { studentId, studentEmail } = req.body;

    if (!studentId && !studentEmail) {
      res.status(400).json({
        success: false,
        message: 'Student identifier is required',
        error: {
          code: 'MISSING_STUDENT_ID',
          details: 'Either studentId or studentEmail must be provided'
        }
      });
      return;
    }

    // Find the course
    const course = await Course.findById(id);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID: ${id}`
        }
      });
      return;
    }

    // Import CourseProgress model
    const { CourseProgress } = await import('../models');

    // Check if student is already enrolled
    const existingEnrollment = await CourseProgress.findOne({
      userId: studentId || studentEmail,
      courseId: course.slug // Using slug as courseId
    });

    if (existingEnrollment) {
      res.status(409).json({
        success: false,
        message: 'Student already enrolled',
        error: {
          code: 'ALREADY_ENROLLED',
          details: 'This student is already enrolled in this course'
        }
      });
      return;
    }

    // Create enrollment
    const enrollment = new CourseProgress({
      userId: studentId || studentEmail,
      courseId: course.slug,
      enrolledAt: new Date(),
      progress: 0,
      lastAccessedAt: new Date(),
      completedLessons: [],
      currentLesson: null,
      isCompleted: false
    });

    await enrollment.save();

    // Increment course enrollment count
    course.enrollmentCount = (course.enrollmentCount || 0) + 1;
    await course.save();

    logger.info(`Admin enrolled student ${studentId || studentEmail} in course: ${course.title}`, {
      courseId: id,
      courseSlug: course.slug,
      studentId: studentId || studentEmail,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: {
        enrollment,
        course: {
          id: course.slug,
          title: course.title,
          instructor: course.instructor.name
        }
      },
      message: 'Student enrolled successfully'
    });
  } catch (error: any) {
    logger.error('Admin: Failed to enroll student', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to enroll student',
        details: error.message
      }
    });
  }
});

/**
 * Unenroll a student from a course (admin privileges)
 */
router.delete('/courses/:id/enroll-student/:studentId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, studentId } = req.params;

    // Find the course
    const course = await Course.findById(id);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID: ${id}`
        }
      });
      return;
    }

    // Import CourseProgress model
    const { CourseProgress } = await import('../models');

    // Find and delete enrollment
    const enrollment = await CourseProgress.findOneAndDelete({
      userId: studentId,
      courseId: course.slug
    });

    if (!enrollment) {
      res.status(404).json({
        success: false,
        message: 'Enrollment not found',
        error: {
          code: 'ENROLLMENT_NOT_FOUND',
          details: 'No enrollment found for this student in this course'
        }
      });
      return;
    }

    // Decrement course enrollment count
    if (course.enrollmentCount > 0) {
      course.enrollmentCount -= 1;
      await course.save();
    }

    logger.info(`Admin unenrolled student ${studentId} from course: ${course.title}`, {
      courseId: id,
      courseSlug: course.slug,
      studentId,
      adminId: req.userId
    });

    res.json({
      success: true,
      message: 'Student unenrolled successfully'
    });
  } catch (error: any) {
    logger.error('Admin: Failed to unenroll student', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to unenroll student',
        details: error.message
      }
    });
  }
});

/**
 * Get all enrolled students for a course (admin view)
 */
router.get('/courses/:id/students', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Find the course
    const course = await Course.findById(id);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID: ${id}`
        }
      });
      return;
    }

    // Import CourseProgress model
    const { CourseProgress } = await import('../models');

    // Get all enrollments for this course
    const enrollments = await CourseProgress.find({
      courseId: course.slug
    }).lean();

    logger.info(`Admin: Retrieved ${enrollments.length} students for course: ${course.title}`, {
      courseId: id,
      courseSlug: course.slug,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: {
        course: {
          id: course.slug,
          title: course.title,
          instructor: course.instructor.name
        },
        students: enrollments,
        total: enrollments.length
      }
    });
  } catch (error: any) {
    logger.error('Admin: Failed to fetch enrolled students', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch enrolled students',
        details: error.message
      }
    });
  }
});

/**
 * LEARNING PATH MANAGEMENT
 */

/**
 * Get all learning paths (admin view)
 * Admins can see all paths regardless of instructor or status
 */
router.get('/paths', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    
    const paths = await LearningPath.find({})
      .sort({ createdAt: -1 })
      .lean();

    logger.info(`Admin: Retrieved ${paths.length} learning paths`, {
      adminId: req.userId
    });

    res.json({
      success: true,
      data: paths,
      total: paths.length
    });
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

/**
 * Create a new learning path (admin privileges)
 */
router.post('/paths', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    const { generateSlug } = await import('@cloudmastershub/utils');
    
    const pathData = {
      ...req.body,
      slug: generateSlug(req.body.title),
      instructorId: req.body.instructorId || req.userId,
      pathway: req.body.pathway || [],
      status: req.body.status || 'draft',
      enrollmentCount: 0,
      rating: 0
    };

    const newPath = new LearningPath(pathData);
    const savedPath = await newPath.save();

    logger.info(`Admin created learning path: ${savedPath.title}`, {
      pathId: savedPath._id,
      adminId: req.userId
    });

    res.status(201).json({
      success: true,
      data: savedPath,
      message: 'Learning path created successfully'
    });
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

/**
 * Update a learning path (admin privileges)
 */
router.put('/paths/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    const { id } = req.params;

    const updatedPath = await LearningPath.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedPath) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    logger.info(`Admin updated learning path: ${updatedPath.title}`, {
      pathId: id,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: updatedPath,
      message: 'Learning path updated successfully'
    });
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

/**
 * Delete a learning path (admin privileges)
 */
router.delete('/paths/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    const { id } = req.params;

    const deletedPath = await LearningPath.findByIdAndDelete(id);

    if (!deletedPath) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    logger.info(`Admin deleted learning path: ${deletedPath.title}`, {
      pathId: id,
      adminId: req.userId
    });

    res.json({
      success: true,
      message: 'Learning path deleted successfully'
    });
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

/**
 * Add a course to a learning path (admin privileges)
 */
router.post('/paths/:id/courses', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    const { id } = req.params;
    const { courseId, order, isRequired = true, estimatedTimeMinutes = 60 } = req.body;

    if (!courseId) {
      res.status(400).json({
        success: false,
        message: 'Course ID is required',
        error: {
          code: 'MISSING_COURSE_ID',
          details: 'courseId field is required to add a course to the path'
        }
      });
      return;
    }

    // Find the learning path
    const path = await LearningPath.findById(id);
    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // Find the course to add
    const course = await Course.findById(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID: ${courseId}`
        }
      });
      return;
    }

    // Create a new pathway step for the course
    const newStep = {
      id: `step-${Date.now()}`,
      pathId: id,
      order: order !== undefined ? order : path.pathway.length,
      type: 'course' as const,
      title: course.title,
      description: course.description,
      courseId: course.slug,
      isRequired,
      isLocked: false,
      estimatedTimeMinutes,
      prerequisites: [],
      unlocks: [],
      difficulty: course.level,
      skills: course.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add the step to the pathway
    path.pathway.push(newStep);
    
    // Sort pathway by order
    path.pathway.sort((a, b) => a.order - b.order);
    
    // Update estimated duration (convert minutes to hours)
    path.estimatedDurationHours = path.pathway.reduce((total, step) => 
      total + (step.estimatedTimeMinutes || 0), 0
    ) / 60;

    const updatedPath = await path.save();

    logger.info(`Admin added course ${course.title} to learning path: ${path.title}`, {
      pathId: id,
      courseId: course.slug,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: updatedPath,
      message: 'Course added to learning path successfully'
    });
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

/**
 * Remove a course from a learning path (admin privileges)
 */
router.delete('/paths/:id/courses/:courseId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    const { id, courseId } = req.params;

    // Find the learning path
    const path = await LearningPath.findById(id);
    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // Remove the course step from the pathway
    const initialLength = path.pathway.length;
    path.pathway = path.pathway.filter(step => 
      step.type !== 'course' || step.courseId !== courseId
    );

    if (path.pathway.length === initialLength) {
      res.status(404).json({
        success: false,
        message: 'Course not found in learning path',
        error: {
          code: 'COURSE_NOT_IN_PATH',
          details: `Course ${courseId} is not part of this learning path`
        }
      });
      return;
    }

    // Re-order remaining steps
    path.pathway.forEach((step, index) => {
      step.order = index;
    });

    // Update estimated duration (convert minutes to hours)
    path.estimatedDurationHours = path.pathway.reduce((total, step) => 
      total + (step.estimatedTimeMinutes || 0), 0
    ) / 60;

    const updatedPath = await path.save();

    logger.info(`Admin removed course ${courseId} from learning path: ${path.title}`, {
      pathId: id,
      courseId,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: updatedPath,
      message: 'Course removed from learning path successfully'
    });
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

/**
 * Reorder courses in a learning path (admin privileges)
 */
router.put('/paths/:id/reorder', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { LearningPath } = await import('../models');
    const { id } = req.params;
    const { orderedSteps } = req.body; // Array of step IDs in new order

    if (!orderedSteps || !Array.isArray(orderedSteps)) {
      res.status(400).json({
        success: false,
        message: 'Ordered steps array is required',
        error: {
          code: 'MISSING_ORDERED_STEPS',
          details: 'orderedSteps must be an array of step IDs in the desired order'
        }
      });
      return;
    }

    // Find the learning path
    const path = await LearningPath.findById(id);
    if (!path) {
      res.status(404).json({
        success: false,
        message: 'Learning path not found',
        error: {
          code: 'PATH_NOT_FOUND',
          details: `No learning path found with ID: ${id}`
        }
      });
      return;
    }

    // Create a map of step ID to step object
    const stepMap = new Map(path.pathway.map(step => [step.id, step]));

    // Reorder the pathway based on the provided order
    const reorderedPathway: any[] = [];
    orderedSteps.forEach((stepId: string, index: number) => {
      const step = stepMap.get(stepId);
      if (step) {
        step.order = index;
        reorderedPathway.push(step);
      }
    });

    // Add any steps that weren't in the ordered list at the end
    path.pathway.forEach(step => {
      if (!orderedSteps.includes(step.id)) {
        step.order = reorderedPathway.length;
        reorderedPathway.push(step);
      }
    });

    path.pathway = reorderedPathway;
    const updatedPath = await path.save();

    logger.info(`Admin reordered courses in learning path: ${path.title}`, {
      pathId: id,
      adminId: req.userId
    });

    res.json({
      success: true,
      data: updatedPath,
      message: 'Learning path reordered successfully'
    });
  } catch (error: any) {
    logger.error('Admin: Failed to reorder learning path', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to reorder learning path',
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
          totalRevenue: { $sum: '$price' }, // This would need to be calculated from actual purchases
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


export default router;