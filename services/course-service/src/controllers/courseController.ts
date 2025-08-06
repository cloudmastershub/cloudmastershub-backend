import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { isValidObjectId } from 'mongoose';
import logger from '../utils/logger';
import { getCourseEventPublisher } from '../events/courseEventPublisher';
import { Course, CourseProgress } from '../models';
import { CourseCategory, DifficultyLevel, CourseStatus } from '@cloudmastershub/types';
import { isValidSlug, isLegacyId } from '../utils/slugValidation';

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
    const { id: slug } = req.params;

    // Validate slug format before proceeding
    if (!isValidSlug(slug)) {
      if (isLegacyId(slug)) {
        logger.warn('Legacy ID usage detected in getCourseById', { legacyId: slug });
        res.status(410).json({
          success: false,
          message: 'Legacy course identifiers are no longer supported',
          error: {
            code: 'LEGACY_ID_NOT_SUPPORTED',
            details: 'Please use the course slug (e.g., "aws-fundamentals") instead of legacy IDs',
            legacyId: slug,
            migrationRequired: true
          }
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        message: 'Invalid course identifier format',
        error: {
          code: 'INVALID_SLUG_FORMAT',
          details: 'Course identifiers must be lowercase, alphanumeric with hyphens (e.g., "aws-fundamentals")',
          provided: slug,
          expectedFormat: 'lowercase-slug-format'
        }
      });
      return;
    }

    logger.info('Fetching course by slug from MongoDB', { slug });

    try {
      // Only look up by slug - no legacy ID support
      const course = await Course.findOne({ slug }).select('-__v').lean().maxTimeMS(5000);
      
      if (!course) {
        logger.warn('Course not found', { slug });
        res.status(404).json({
          success: false,
          message: 'Course not found',
          error: {
            code: 'COURSE_NOT_FOUND',
            details: `No course found with slug: ${slug}`
          }
        });
        return;
      }

      logger.info('Retrieved course from MongoDB', { 
        courseId: course._id, 
        title: course.title,
        slug: course.slug || 'no-slug',
        searchedBy: isValidObjectId(slug) ? 'ObjectId' : 'slug'
      });

      res.json({
        success: true,
        data: course,
      });
    } catch (dbError: any) {
      logger.error('MongoDB query error:', { 
        error: dbError.message, 
        searchId: slug,
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
    const courseData = req.body;
    
    // Basic validation for required fields
    if (!courseData.title || !courseData.description || !courseData.category) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'Title, description, and category are required'
        }
      });
      return;
    }
    // Get instructor ID from authenticated user (set by authentication middleware)
    const authReq = req as any; // AuthRequest interface
    const instructorId = authReq.userId || courseData.instructorId;
    const instructorEmail = authReq.userEmail || 'instructor@example.com';

    if (!instructorId) {
      res.status(400).json({
        success: false,
        message: 'Instructor ID is required',
        error: {
          code: 'INSTRUCTOR_ID_REQUIRED',
          details: 'Unable to identify instructor from authentication token'
        }
      });
      return;
    }

    // Prepare course data with defaults and proper structure
    // Only include fields that exist in the Course schema
    const processedCourseData: any = {
      title: courseData.title,
      description: courseData.description,
      category: courseData.category,
      level: courseData.level || DifficultyLevel.BEGINNER,
      duration: courseData.duration || 0,
      thumbnail: courseData.thumbnail || 'https://via.placeholder.com/1280x720',
      preview: courseData.preview || courseData.previewVideo || '',
      instructor: {
        id: instructorId,
        name: courseData.instructor?.name || instructorEmail.split('@')[0] || 'Instructor',
        avatar: courseData.instructor?.avatar || 'https://via.placeholder.com/150',
        bio: courseData.instructor?.bio || '',
        expertise: courseData.instructor?.expertise || [],
        rating: courseData.instructor?.rating || 0
      },
      price: typeof courseData.price === 'object' ? (courseData.price?.amount || 0) : (courseData.price || 0),
      rating: 0,
      enrollmentCount: 0,
      tags: courseData.tags || [],
      requirements: courseData.requirements || [],
      objectives: courseData.objectives || [],
      curriculum: courseData.curriculum || [],
      status: courseData.status || CourseStatus.DRAFT
    };
    
    // Generate slug manually to ensure it's set
    const { generateSlug, generateUniqueSlug } = await import('@cloudmastershub/utils');
    let slug: string;
    
    try {
      const baseSlug = generateSlug(processedCourseData.title);
      logger.info('Generated base slug:', { title: processedCourseData.title, baseSlug });
      
      // Check for existing slugs
      const existingCourses = await Course.find({ 
        slug: { $regex: `^${baseSlug}(-\\d+)?$` } 
      }).select('slug');
      
      const existingSlugs = existingCourses.map(course => course.slug);
      slug = generateUniqueSlug(baseSlug, existingSlugs);
      
      logger.info('Generated unique slug:', { baseSlug, existingSlugs, finalSlug: slug });
    } catch (error) {
      logger.error('Error generating slug, using fallback:', error);
      slug = `course-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Add slug to processed data
    processedCourseData.slug = slug;
    
    // Log the data being sent to help debug validation issues
    logger.info('Processing course creation with data:', {
      originalData: Object.keys(courseData),
      processedData: Object.keys(processedCourseData),
      instructorId,
      title: processedCourseData.title,
      category: processedCourseData.category,
      slug: processedCourseData.slug
    });

    // Create new course
    const course = new Course(processedCourseData);

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
      const validationErrors = err?.errors ? Object.values(err.errors).map((e: any) => ({
        field: e.path,
        message: e.message,
        value: e.value
      })) : ['Validation failed'];
      
      logger.error('Course validation errors:', {
        errors: validationErrors,
        fullError: err.message
      });
      
      res.status(400).json({
        success: false,
        message: 'Course validation failed',
        error: {
          code: 'VALIDATION_ERROR',
          details: err?.errors ? Object.values(err.errors).map((e: any) => e.message) : [err.message || 'Validation failed']
        }
      });
      return;
    }
    
    // Handle MongoDB duplicate key errors (e.g., duplicate slug)
    if (err?.code === 11000) {
      logger.error('Duplicate key error:', err);
      res.status(400).json({
        success: false,
        message: 'Course with this title already exists',
        error: {
          code: 'DUPLICATE_COURSE',
          details: 'A course with a similar title already exists. Please choose a different title.'
        }
      });
      return;
    }
    
    // Handle other database errors
    if (err?.name === 'MongoServerError' || err?.name === 'MongoError') {
      logger.error('MongoDB error:', err);
      res.status(500).json({
        success: false,
        message: 'Database error occurred',
        error: {
          code: 'DATABASE_ERROR',
          details: 'Unable to save course to database. Please try again.'
        }
      });
      return;
    }
    
    // Handle connection errors
    if (err?.name === 'MongooseError' || err?.message?.includes('connection')) {
      logger.error('Database connection error:', err);
      res.status(503).json({
        success: false,
        message: 'Database connection error',
        error: {
          code: 'CONNECTION_ERROR',
          details: 'Unable to connect to database. Please try again later.'
        }
      });
      return;
    }
    
    // Generic error handling
    logger.error('Unexpected error creating course:', {
      message: err?.message,
      name: err?.name,
      stack: err?.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while creating the course',
      error: {
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? err?.message : 'Internal server error'
      }
    });
  }
};

export const updateCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: slug } = req.params;
    const updates = req.body;
    
    // Validate slug format
    if (!isValidSlug(slug)) {
      if (isLegacyId(slug)) {
        res.status(410).json({
          success: false,
          message: 'Legacy course identifiers are no longer supported',
          error: {
            code: 'LEGACY_ID_NOT_SUPPORTED',
            details: 'Please use the course slug instead of legacy IDs'
          }
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        message: 'Invalid course identifier format',
        error: {
          code: 'INVALID_SLUG_FORMAT',
          details: 'Course identifiers must be lowercase, alphanumeric with hyphens'
        }
      });
      return;
    }
    
    // Get instructor ID from authenticated user (set by authentication middleware)
    const authReq = req as any; // AuthRequest interface
    const instructorId = authReq.userId;

    const course = await Course.findOne({ slug });

    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with slug: ${slug}`
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
      courseId: updatedCourse._id,
      instructorId,
      changes: Object.keys(updates)
    });

    // Publish course updated event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseUpdated(updatedCourse._id.toString(), updates, instructorId.toString());

    // Check if status was changed
    if (oldStatus !== updatedCourse.status) {
      if (updatedCourse.status === CourseStatus.PUBLISHED) {
        await eventPublisher.publishCoursePublished(updatedCourse._id.toString(), instructorId.toString());
      } else if (oldStatus === CourseStatus.PUBLISHED) {
        await eventPublisher.publishCourseUnpublished(updatedCourse._id.toString(), instructorId.toString(), updates.reason || 'Course unpublished');
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

    // Support both ObjectId and slug lookup like admin instructor assignment endpoint
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
    await CourseProgress.deleteMany({ courseId: slug });

    // Delete the course
    await Course.findOneAndDelete({ slug });

    logger.info(`Deleted course: ${course.title}`, {
      courseSlug: slug,
      courseId: course._id.toString(),
      instructorId,
      reason
    });

    // Publish course deleted event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseDeleted(course._id.toString(), instructorId.toString(), reason);

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
    const { id: slug } = req.params;
    const userId = req.headers['x-user-id'] || req.body.userId;
    const { enrollmentType = 'free' } = req.body;

    // Validate slug format
    if (!isValidSlug(slug)) {
      if (isLegacyId(slug)) {
        res.status(410).json({
          success: false,
          message: 'Legacy course identifiers are no longer supported',
          error: {
            code: 'LEGACY_ID_NOT_SUPPORTED'
          }
        });
        return;
      }
      
      res.status(400).json({
        success: false,
        message: 'Invalid course identifier format',
        error: {
          code: 'INVALID_SLUG_FORMAT'
        }
      });
      return;
    }

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
    const course = await Course.findOne({ slug });
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: {
          code: 'COURSE_NOT_FOUND',
          details: `No course found with slug: ${slug}`
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
      courseId: course._id.toString() 
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
      courseId: course._id.toString(),
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
      courseId: course._id.toString(),
      enrollmentType
    });

    // Publish course enrolled event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseEnrolled(course._id.toString(), userId, enrollmentType);

    res.json({
      success: true,
      data: {
        enrollmentId: courseProgress._id,
        courseId: course._id.toString(),
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
