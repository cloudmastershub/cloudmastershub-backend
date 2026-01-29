import { Request, Response, NextFunction } from 'express';
import { Course } from '../models/Course';
import { CourseProgress } from '../models/CourseProgress';
import logger from '../utils/logger';

// Helper to extract all lessons from a course's curriculum
const extractLessonsFromCourse = (course: any): any[] => {
  const lessons: any[] = [];
  if (!course.curriculum) return lessons;

  for (const section of course.curriculum) {
    if (section.lessons) {
      for (const lesson of section.lessons) {
        lessons.push({
          id: lesson.id,
          sectionId: section.id,
          sectionTitle: section.title,
          courseId: course.slug,
          title: lesson.title,
          description: lesson.description,
          videoUrl: lesson.videoUrl,
          duration: lesson.duration,
          order: lesson.order,
          resources: lesson.resources || [],
          quiz: lesson.quiz || null,
        });
      }
    }
  }

  return lessons.sort((a, b) => a.order - b.order);
};

// Helper to find a specific lesson in a course
const findLessonInCourse = (course: any, lessonId: string): any | null => {
  if (!course.curriculum) return null;

  for (const section of course.curriculum) {
    if (section.lessons) {
      const lesson = section.lessons.find((l: any) => l.id === lessonId);
      if (lesson) {
        const allLessons = extractLessonsFromCourse(course);
        const currentIndex = allLessons.findIndex(l => l.id === lessonId);

        return {
          id: lesson.id,
          sectionId: section.id,
          sectionTitle: section.title,
          courseId: course.slug,
          title: lesson.title,
          description: lesson.description,
          videoUrl: lesson.videoUrl,
          duration: lesson.duration,
          order: lesson.order,
          content: lesson.content || lesson.description,
          resources: lesson.resources || [],
          quiz: lesson.quiz || null,
          nextLesson: currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1]?.id : null,
          previousLesson: currentIndex > 0 ? allLessons[currentIndex - 1]?.id : null,
        };
      }
    }
  }

  return null;
};

export const getLessonsByCourse = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;

    // Fetch course from MongoDB (supports both slug and ObjectId)
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    const lessons = extractLessonsFromCourse(course);

    logger.info(`Fetched ${lessons.length} lessons for course ${courseId}`);

    res.json({
      success: true,
      data: lessons,
    });
  } catch (error: any) {
    logger.error('Error fetching lessons:', error);
    next(error);
  }
};

export const getLessonById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, lessonId } = req.params;

    // Fetch course from MongoDB
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    const lesson = findLessonInCourse(course, lessonId);

    if (!lesson) {
      res.status(404).json({
        success: false,
        error: { message: 'Lesson not found', code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    logger.info(`Fetched lesson ${lessonId} from course ${courseId}`);

    res.json({
      success: true,
      data: lesson,
    });
  } catch (error: any) {
    logger.error('Error fetching lesson:', error);
    next(error);
  }
};

export const createLesson = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { sectionId, title, description, videoUrl, duration, order, resources, quiz } = req.body;

    // Validate required fields
    if (!sectionId || !title || !description || !videoUrl || duration === undefined || order === undefined) {
      res.status(400).json({
        success: false,
        error: { message: 'Missing required fields: sectionId, title, description, videoUrl, duration, order', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Fetch course from MongoDB
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    // Find the section
    const sectionIndex = course.curriculum?.findIndex((s: any) => s.id === sectionId);
    if (sectionIndex === undefined || sectionIndex === -1) {
      res.status(404).json({
        success: false,
        error: { message: 'Section not found', code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    // Create new lesson
    const lessonId = `lesson-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newLesson = {
      id: lessonId,
      sectionId,
      title,
      description,
      videoUrl,
      duration,
      order,
      resources: resources || [],
      quiz: quiz || undefined,
    };

    // Add lesson to section
    if (!course.curriculum![sectionIndex].lessons) {
      course.curriculum![sectionIndex].lessons = [];
    }
    course.curriculum![sectionIndex].lessons.push(newLesson as any);

    await course.save();

    logger.info(`Created lesson ${lessonId} in course ${courseId}, section ${sectionId}`);

    res.status(201).json({
      success: true,
      data: {
        ...newLesson,
        courseId: course.slug,
        createdAt: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Error creating lesson:', error);
    next(error);
  }
};

export const updateLesson = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, lessonId } = req.params;
    const updates = req.body;

    // Fetch course from MongoDB
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    // Find and update the lesson
    let lessonUpdated = false;
    let updatedLesson: any = null;

    if (course.curriculum) {
      for (const section of course.curriculum) {
        if (section.lessons) {
          const lessonIndex = section.lessons.findIndex((l: any) => l.id === lessonId);
          if (lessonIndex !== -1) {
            // Update allowed fields
            const allowedUpdates = ['title', 'description', 'videoUrl', 'duration', 'order', 'resources', 'quiz'];
            for (const key of allowedUpdates) {
              if (updates[key] !== undefined) {
                (section.lessons[lessonIndex] as any)[key] = updates[key];
              }
            }
            updatedLesson = section.lessons[lessonIndex];
            lessonUpdated = true;
            break;
          }
        }
      }
    }

    if (!lessonUpdated) {
      res.status(404).json({
        success: false,
        error: { message: 'Lesson not found', code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    await course.save();

    logger.info(`Updated lesson ${lessonId} in course ${courseId}`);

    res.json({
      success: true,
      data: {
        ...updatedLesson,
        courseId: course.slug,
        updatedAt: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Error updating lesson:', error);
    next(error);
  }
};

export const deleteLesson = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, lessonId } = req.params;

    // Fetch course from MongoDB
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    // Find and delete the lesson
    let lessonDeleted = false;

    if (course.curriculum) {
      for (const section of course.curriculum) {
        if (section.lessons) {
          const lessonIndex = section.lessons.findIndex((l: any) => l.id === lessonId);
          if (lessonIndex !== -1) {
            section.lessons.splice(lessonIndex, 1);
            lessonDeleted = true;
            break;
          }
        }
      }
    }

    if (!lessonDeleted) {
      res.status(404).json({
        success: false,
        error: { message: 'Lesson not found', code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    await course.save();

    logger.info(`Deleted lesson ${lessonId} from course ${courseId}`);

    res.json({
      success: true,
      message: 'Lesson deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting lesson:', error);
    next(error);
  }
};

export const markLessonComplete = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, lessonId } = req.params;
    const userId = req.body.userId || (req as any).user?.userId;
    const { watchTime = 0 } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: { message: 'User ID is required', code: 'VALIDATION_ERROR' }
      });
      return;
    }

    // Verify the course and lesson exist
    let course = await Course.findOne({ slug: courseId });
    if (!course) {
      course = await Course.findById(courseId).catch(() => null);
    }

    if (!course) {
      res.status(404).json({
        success: false,
        error: { message: 'Course not found', code: 'COURSE_NOT_FOUND' }
      });
      return;
    }

    const lesson = findLessonInCourse(course, lessonId);
    if (!lesson) {
      res.status(404).json({
        success: false,
        error: { message: 'Lesson not found', code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    // Find or create progress record
    let progress = await CourseProgress.findOne({ userId, courseId: course.slug });

    if (!progress) {
      // Create new progress record if user is enrolled
      progress = new CourseProgress({
        userId,
        courseId: course.slug,
        enrolledAt: new Date(),
        progress: 0,
        lastAccessedAt: new Date(),
        completedLessons: [],
        watchedTime: 0,
      });
    }

    // Mark lesson complete using the model method
    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
    }

    // Update watched time
    progress.watchedTime = (progress.watchedTime || 0) + watchTime;
    progress.lastAccessedAt = new Date();
    progress.currentLesson = lesson.nextLesson || lessonId;

    // Calculate overall progress
    const allLessons = extractLessonsFromCourse(course);
    const totalLessons = allLessons.length;
    if (totalLessons > 0) {
      const completedCount = progress.completedLessons.length;
      progress.progress = Math.round((completedCount / totalLessons) * 100);

      // Mark course as completed if 100%
      if (progress.progress >= 100 && !progress.completedAt) {
        progress.completedAt = new Date();
      }
    }

    await progress.save();

    logger.info(`User ${userId} completed lesson ${lessonId} in course ${courseId}. Progress: ${progress.progress}%`);

    res.json({
      success: true,
      data: {
        userId,
        courseId: course.slug,
        lessonId,
        completedAt: new Date(),
        watchTime,
        courseProgress: progress.progress,
        totalLessonsCompleted: progress.completedLessons.length,
        totalLessons,
        courseCompleted: progress.progress >= 100,
      },
    });
  } catch (error: any) {
    logger.error('Error marking lesson complete:', error);
    next(error);
  }
};
