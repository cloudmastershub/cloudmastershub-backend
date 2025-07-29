import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import logger from '../utils/logger';
import { getCourseEventPublisher } from '../events/courseEventPublisher';
import { Course, CourseProgress } from '../models';
import { CourseCategory, DifficultyLevel, CourseStatus } from '@cloudmastershub/types';

export const getAllCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      level, 
      search, 
      instructor,
      minPrice,
      maxPrice,
      status = CourseStatus.PUBLISHED,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    logger.info('Fetching courses from MongoDB', {
      page,
      limit,
      category,
      level,
      search
    });

    // Build query filter
    const filter: any = {};
    
    // Add status filter - 'all' means no status filter (admin view)
    if (status === 'all') {
      // Admin view: no status filter, show all courses
    } else if (status) {
      // Specific status requested
      filter.status = status;
    } else {
      // Default to published for public endpoints
      filter.status = CourseStatus.PUBLISHED;
    }
    
    if (category && category !== 'all') {
      filter.category = category.toString().toUpperCase();
    }
    
    if (level) {
      filter.level = level;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: search, $options: 'i' } } }
      ];
    }
    
    if (instructor) {
      filter['instructor.id'] = instructor;
    }
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }

    // Build sort object
    const sortOptions: any = {};
    sortOptions[sortBy.toString()] = sortOrder === 'asc' ? 1 : -1;

    try {
      // Execute query with timeout
      const [courses, total] = await Promise.all([
        Course.find(filter)
          .sort(sortOptions)
          .skip((Number(page) - 1) * Number(limit))
          .limit(Number(limit))
          .select('-__v')
          .lean()
          .maxTimeMS(5000), // 5 second timeout
        Course.countDocuments(filter).maxTimeMS(5000)
      ]);

      logger.info(`Retrieved ${courses.length} courses from MongoDB`, {
        filters: filter,
        page: Number(page),
        limit: Number(limit),
        total
      });

      res.json({
        success: true,
        data: courses,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit))
        },
      });
    } catch (dbError: any) {
      logger.error('MongoDB query error:', dbError);
      
      res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: {
          code: 'DATABASE_ERROR',
          details: 'Unable to fetch courses from database. Please try again later.'
        }
      });
      return;
    }
  } catch (error) {
    logger.error('Error fetching courses:', error);
    next(error);
  }
};

export const getCourseById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    logger.info('Fetching course by ID/slug from MongoDB', { id });

    try {
      let course = null;
      
      // First, check if it's a valid MongoDB ObjectId
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(id);
      
      if (isValidObjectId) {
        // Try to find by MongoDB ObjectId first
        course = await Course.findById(id).select('-__v').lean().maxTimeMS(5000);
      }
      
      if (!course) {
        // If not found by ID or not a valid ObjectId, try by slug
        course = await Course.findOne({ slug: id }).select('-__v').lean().maxTimeMS(5000);
      }
      
      if (!course) {
        logger.warn('Course not found', { searchId: id, isValidObjectId });
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

      logger.info('Retrieved course from MongoDB', { 
        courseId: course._id, 
        title: course.title,
        slug: course.slug || 'no-slug',
        searchedBy: isValidObjectId ? 'ObjectId' : 'slug'
      });

      res.json({
        success: true,
        data: course,
      });
    } catch (dbError: any) {
      logger.error('MongoDB query error:', { 
        error: dbError.message, 
        searchId: id,
        stack: dbError.stack 
      });
      
      res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: {
          code: 'DATABASE_ERROR',
          details: 'Unable to fetch course from database. Please try again later.'
        }
      });
      return;
    }
  } catch (error) {
    logger.error('Error fetching course:', error);
    next(error);
  }
};

export const createCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

    const courseData = req.body;
    const instructorId = req.headers['x-user-id'] || courseData.instructorId || 'instructor-123';

    // Create new course
    const course = new Course({
      ...courseData,
      instructor: {
        id: instructorId,
        name: courseData.instructor?.name || 'Unknown Instructor',
        avatar: courseData.instructor?.avatar || 'https://via.placeholder.com/150',
        bio: courseData.instructor?.bio || '',
        expertise: courseData.instructor?.expertise || [],
        rating: courseData.instructor?.rating || 0
      },
      status: CourseStatus.DRAFT,
      curriculum: courseData.curriculum || []
    });

    const savedCourse = await course.save();

    logger.info('Created new course:', {
      courseId: savedCourse._id,
      title: savedCourse.title,
      instructorId
    });

    // Publish course created event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseCreated(savedCourse._id.toString(), {
      title: savedCourse.title,
      description: savedCourse.description,
      instructorId: instructorId.toString(),
      category: savedCourse.category,
      difficulty: savedCourse.level,
      duration: savedCourse.duration,
      price: savedCourse.price
    });

    res.status(201).json({
      success: true,
      data: savedCourse,
      message: 'Course created successfully'
    });
  } catch (error) {
    logger.error('Error creating course:', error);
    
    // Handle MongoDB validation errors
    const err = error as any;
    if (err?.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Course validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          details: err?.errors ? Object.values(err.errors).map((e: any) => e.message) : ['Validation failed']
        }
      });
      return;
    }
    
    next(error);
  }
};

export const updateCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const instructorId = req.headers['x-user-id'] || 'instructor-123';

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
      return;
    }

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

    // Check if user has permission to update this course
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to update this course',
        error: {
          code: 'UNAUTHORIZED',
          details: 'Only the course instructor or admin can update this course'
        }
      });
      return;
    }

    const oldStatus = course.status;
    
    // Update course fields
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'createdAt') {
        (course as any)[key] = updates[key];
      }
    });

    const updatedCourse = await course.save();

    logger.info(`Updated course: ${updatedCourse.title}`, {
      courseId: id,
      instructorId,
      changes: Object.keys(updates)
    });

    // Publish course updated event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseUpdated(id, updates, instructorId.toString());

    // Check if status was changed
    if (oldStatus !== updatedCourse.status) {
      if (updatedCourse.status === CourseStatus.PUBLISHED) {
        await eventPublisher.publishCoursePublished(id, instructorId.toString());
      } else if (oldStatus === CourseStatus.PUBLISHED) {
        await eventPublisher.publishCourseUnpublished(id, instructorId.toString(), updates.reason || 'Course unpublished');
      }
    }

    res.json({
      success: true,
      data: updatedCourse,
      message: 'Course updated successfully'
    });
  } catch (error) {
    logger.error('Error updating course:', error);
    
    const err = error as any;
    if (err?.name === 'ValidationError') {
      res.status(400).json({
        success: false,
        message: 'Course validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          details: err?.errors ? Object.values(err.errors).map((e: any) => e.message) : ['Validation failed']
        }
      });
      return;
    }
    
    if (err?.name === 'CastError') {
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
    
    next(error);
  }
};

export const deleteCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const instructorId = req.headers['x-user-id'] || 'instructor-123';
    const reason = req.body.reason || 'Course deletion requested';

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

    // Check if user has permission to delete this course
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this course',
        error: {
          code: 'UNAUTHORIZED',
          details: 'Only the course instructor or admin can delete this course'
        }
      });
      return;
    }

    // Delete associated progress records
    await CourseProgress.deleteMany({ courseId: id });

    // Delete the course
    await Course.findByIdAndDelete(id);

    logger.info(`Deleted course: ${course.title}`, {
      courseId: id,
      instructorId,
      reason
    });

    // Publish course deleted event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseDeleted(id, instructorId.toString(), reason);

    res.json({
      success: true,
      message: 'Course deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting course:', error);
    
    const err = error as any;
    if (err?.name === 'CastError') {
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
    
    next(error);
  }
};

export const enrollInCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.headers['x-user-id'] || req.body.userId;
    const { enrollmentType = 'free' } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        error: {
          code: 'MISSING_USER_ID',
          details: 'User ID must be provided in headers or request body'
        }
      });
      return;
    }

    // Check if course exists
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

    // Check if course is published
    if (course.status !== CourseStatus.PUBLISHED) {
      res.status(400).json({
        success: false,
        message: 'Course is not available for enrollment',
        error: {
          code: 'COURSE_NOT_PUBLISHED',
          details: 'Only published courses can be enrolled in'
        }
      });
      return;
    }

    // Check if user is already enrolled
    const existingProgress = await CourseProgress.findOne({ 
      userId, 
      courseId: id 
    });

    if (existingProgress) {
      res.status(409).json({
        success: false,
        message: 'User is already enrolled in this course',
        error: {
          code: 'ALREADY_ENROLLED',
          details: 'User cannot enroll in the same course multiple times'
        }
      });
      return;
    }

    // Create course progress record
    const courseProgress = new CourseProgress({
      userId,
      courseId: id,
      enrolledAt: new Date(),
      progress: 0,
      lastAccessedAt: new Date(),
      completedLessons: [],
      watchedTime: 0
    });

    await courseProgress.save();

    // Increment course enrollment count
    course.enrollmentCount = (course.enrollmentCount || 0) + 1;
    await course.save();

    logger.info(`User ${userId} enrolled in course: ${course.title}`, {
      courseId: id,
      enrollmentType
    });

    // Publish course enrolled event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseEnrolled(id, userId, enrollmentType);

    res.json({
      success: true,
      data: {
        enrollmentId: courseProgress._id,
        courseId: id,
        userId,
        enrollmentType,
        enrolledAt: courseProgress.enrolledAt,
        progress: courseProgress.progress
      },
      message: 'Successfully enrolled in course'
    });
  } catch (error) {
    logger.error('Error enrolling in course:', error);
    
    const err = error as any;
    if (err?.name === 'CastError') {
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
    
    next(error);
  }
};

export const getUserCourses = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    logger.info('Fetching enrolled courses for user', { userId });

    // Find all course progress records for the user
    const enrollments = await CourseProgress.find({ userId })
      .populate('courseId')
      .sort({ enrolledAt: -1 })
      .lean();

    // Transform the data to include progress information with each course
    const coursesWithProgress = enrollments
      .filter(enrollment => enrollment.courseId) // Filter out any null course references
      .map(enrollment => {
        const course = enrollment.courseId as any;
        return {
          ...course,
          _id: course._id,
          id: course._id.toString(),
          // Add progress data
          progress: enrollment.progress || 0,
          enrolledAt: enrollment.enrolledAt,
          lastAccessedAt: enrollment.lastAccessedAt,
          completedLessons: enrollment.completedLessons || [],
          watchedTime: enrollment.watchedTime || 0,
          // Calculate lessons completed count
          lessonsCount: course.sections?.reduce((total: number, section: any) => 
            total + (section.lessons?.length || 0), 0) || 0
        };
      });

    logger.info(`Retrieved ${coursesWithProgress.length} enrolled courses for user ${userId}`);

    res.json({
      success: true,
      data: coursesWithProgress,
    });
  } catch (error) {
    logger.error('Error fetching user courses:', error);
    next(error);
  }
};
