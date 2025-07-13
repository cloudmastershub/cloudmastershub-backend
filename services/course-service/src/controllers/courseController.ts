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

    logger.info('Fetching courses with mock data (temporary fix)', {
      page,
      limit,
      category,
      level,
      search
    });

    // TEMPORARY FIX: Mock course data while debugging MongoDB query timeout
    const mockCourses = [
      {
        _id: "64a1b2c3d4e5f6789abcdef0",
        title: "AWS Cloud Fundamentals",
        slug: "aws-cloud-fundamentals",
        description: "Learn the basics of Amazon Web Services including EC2, S3, RDS, and more. Perfect for beginners starting their cloud journey.",
        category: "AWS",
        level: "beginner",
        duration: 480,
        thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=300&h=200&fit=crop",
        instructor: {
          id: "instructor1",
          name: "John Smith",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
          bio: "AWS Certified Solutions Architect with 8+ years of cloud experience",
          expertise: ["AWS", "Cloud Architecture", "DevOps"]
        },
        price: 99,
        rating: 4.7,
        enrollmentCount: 1247,
        status: "published",
        sections: [
          {
            id: "section1",
            title: "Getting Started with AWS",
            order: 1,
            lessons: [
              {
                id: "lesson1",
                title: "Introduction to AWS",
                duration: 15,
                order: 1
              }
            ]
          }
        ],
        prerequisites: [],
        tags: ["aws", "cloud", "fundamentals", "beginner"],
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-07-01')
      },
      {
        _id: "64a1b2c3d4e5f6789abcdef1",
        title: "Azure Cloud Essentials",
        slug: "azure-cloud-essentials",
        description: "Master Microsoft Azure cloud platform with hands-on labs and real-world projects. Covers Azure VMs, Storage, and networking.",
        category: "AZURE",
        level: "beginner",
        duration: 360,
        thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&h=200&fit=crop",
        instructor: {
          id: "instructor2",
          name: "Jane Doe",
          avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
          bio: "Microsoft Azure Expert and certified trainer",
          expertise: ["Azure", "Cloud Computing", "Microsoft Technologies"]
        },
        price: 89,
        rating: 4.5,
        enrollmentCount: 892,
        status: "published",
        sections: [
          {
            id: "section1",
            title: "Azure Fundamentals",
            order: 1,
            lessons: [
              {
                id: "lesson1",
                title: "Introduction to Azure",
                duration: 20,
                order: 1
              }
            ]
          }
        ],
        prerequisites: [],
        tags: ["azure", "cloud", "essentials", "microsoft"],
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-06-15')
      },
      {
        _id: "64a1b2c3d4e5f6789abcdef2",
        title: "Google Cloud Platform Deep Dive",
        slug: "gcp-deep-dive",
        description: "Advanced Google Cloud Platform course covering Compute Engine, Cloud Storage, BigQuery, and Kubernetes Engine.",
        category: "GCP",
        level: "intermediate",
        duration: 600,
        thumbnail: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=300&h=200&fit=crop",
        instructor: {
          id: "instructor3",
          name: "Alex Chen",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
          bio: "Google Cloud Professional Architect with enterprise experience",
          expertise: ["GCP", "Kubernetes", "Data Engineering"]
        },
        price: 149,
        rating: 4.8,
        enrollmentCount: 654,
        status: "published",
        sections: [
          {
            id: "section1",
            title: "GCP Core Services",
            order: 1,
            lessons: [
              {
                id: "lesson1",
                title: "GCP Overview and Setup",
                duration: 25,
                order: 1
              }
            ]
          }
        ],
        prerequisites: ["Basic cloud knowledge"],
        tags: ["gcp", "google-cloud", "intermediate", "kubernetes"],
        createdAt: new Date('2024-03-05'),
        updatedAt: new Date('2024-07-10')
      },
      {
        _id: "64a1b2c3d4e5f6789abcdef3",
        title: "DevOps with Kubernetes",
        slug: "devops-kubernetes",
        description: "Learn container orchestration with Kubernetes. Covers deployments, services, ingress, and monitoring.",
        category: "DEVOPS",
        level: "advanced",
        duration: 720,
        thumbnail: "https://images.unsplash.com/photo-1667372393119-3d4c48d07fc9?w=300&h=200&fit=crop",
        instructor: {
          id: "instructor4",
          name: "Sarah Johnson",
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
          bio: "Senior DevOps Engineer specializing in container technologies",
          expertise: ["Kubernetes", "Docker", "CI/CD", "Monitoring"]
        },
        price: 199,
        rating: 4.9,
        enrollmentCount: 423,
        status: "published",
        sections: [
          {
            id: "section1",
            title: "Kubernetes Fundamentals",
            order: 1,
            lessons: [
              {
                id: "lesson1",
                title: "Container Orchestration Basics",
                duration: 30,
                order: 1
              }
            ]
          }
        ],
        prerequisites: ["Docker experience", "Basic cloud knowledge"],
        tags: ["kubernetes", "devops", "containers", "advanced"],
        createdAt: new Date('2024-04-20'),
        updatedAt: new Date('2024-07-05')
      },
      {
        _id: "64a1b2c3d4e5f6789abcdef4",
        title: "Multi-Cloud Strategy",
        slug: "multi-cloud-strategy",
        description: "Learn how to design and implement multi-cloud architectures across AWS, Azure, and GCP.",
        category: "MULTI_CLOUD",
        level: "advanced",
        duration: 540,
        thumbnail: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
        instructor: {
          id: "instructor5",
          name: "Michael Rodriguez",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
          bio: "Cloud Architect with expertise across all major cloud platforms",
          expertise: ["Multi-Cloud", "Architecture", "Migration", "Cost Optimization"]
        },
        price: 249,
        rating: 4.6,
        enrollmentCount: 312,
        status: "published",
        sections: [
          {
            id: "section1",
            title: "Multi-Cloud Fundamentals",
            order: 1,
            lessons: [
              {
                id: "lesson1",
                title: "Why Multi-Cloud?",
                duration: 20,
                order: 1
              }
            ]
          }
        ],
        prerequisites: ["Experience with at least one cloud platform"],
        tags: ["multi-cloud", "architecture", "advanced", "strategy"],
        createdAt: new Date('2024-05-15'),
        updatedAt: new Date('2024-06-30')
      }
    ];

    // Apply filters to mock data
    let filteredCourses = mockCourses;
    
    if (category && category !== 'all') {
      filteredCourses = filteredCourses.filter(course => 
        course.category.toLowerCase() === category.toString().toLowerCase()
      );
    }
    
    if (level) {
      filteredCourses = filteredCourses.filter(course => 
        course.level === level
      );
    }
    
    if (search) {
      const searchTerm = search.toString().toLowerCase();
      filteredCourses = filteredCourses.filter(course => 
        course.title.toLowerCase().includes(searchTerm) ||
        course.description.toLowerCase().includes(searchTerm) ||
        course.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }

    // Apply pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginatedCourses = filteredCourses.slice(skip, skip + limitNum);

    logger.info(`Retrieved ${paginatedCourses.length} mock courses`, {
      filters: { category, level, search },
      page: pageNum,
      limit: limitNum,
      total: filteredCourses.length
    });

    res.json({
      success: true,
      data: paginatedCourses,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: filteredCourses.length,
        totalPages: Math.ceil(filteredCourses.length / limitNum)
      },
    });
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

    // Check if the id is a valid ObjectId or a slug
    let course;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // It's a valid ObjectId
      course = await Course.findById(id).lean();
    } else {
      // Try to find by slug
      course = await Course.findOne({ slug: id }).lean();
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

    logger.info(`Retrieved course: ${course.title}`, { 
      courseId: course._id, 
      slug: course.slug 
    });

    res.json({
      success: true,
      data: course,
    });
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
