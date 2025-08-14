import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { Course } from '../models';
import { CourseStatus } from '@cloudmastershub/types';
import { getCourseEventPublisher } from '../events/courseEventPublisher';

// Helper function to find course by ObjectId or slug
const findCourse = async (courseId: string) => {
  const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(courseId);
  
  let course = null;
  if (isValidObjectId) {
    course = await Course.findById(courseId);
  }
  
  if (!course) {
    course = await Course.findOne({ slug: courseId });
  }
  
  return course;
};

// Add a new section to course curriculum
export const addSection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const sectionData = req.body;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Adding section to course', { courseId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      logger.warn('Course not found for adding section', { courseId, instructorId });
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Generate section ID and ensure order
    const newSection = {
      id: `section-${Date.now()}`,
      title: sectionData.title || 'New Section',
      description: sectionData.description || '',
      order: sectionData.order ?? course.curriculum.length,
      lessons: [],
      duration: 0
    };

    // Add section to curriculum
    course.curriculum.push(newSection);
    
    // Recalculate total duration
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    logger.info('Section added successfully', { 
      courseId, 
      sectionId: newSection.id 
    });

    res.json({
      success: true,
      data: newSection,
      message: 'Section added successfully'
    });
  } catch (error: any) {
    logger.error('Error adding section:', error);
    next(error);
  }
};

// Update a section in course curriculum
export const updateSection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, sectionId } = req.params;
    const updates = req.body;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Updating section', { courseId, sectionId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Find and update section
    const sectionIndex = course.curriculum.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Section not found',
        error: { code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    // Update section fields
    const section = course.curriculum[sectionIndex];
    if (updates.title !== undefined) section.title = updates.title;
    if (updates.description !== undefined) section.description = updates.description;
    if (updates.order !== undefined) section.order = updates.order;

    // Sort curriculum by order
    course.curriculum.sort((a, b) => a.order - b.order);
    
    // Recalculate total duration
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    logger.info('Section updated successfully', { courseId, sectionId });

    res.json({
      success: true,
      data: section,
      message: 'Section updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating section:', error);
    next(error);
  }
};

// Delete a section from course curriculum
export const deleteSection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, sectionId } = req.params;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Deleting section', { courseId, sectionId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Find and remove section
    const sectionIndex = course.curriculum.findIndex(s => s.id === sectionId);
    if (sectionIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Section not found',
        error: { code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    course.curriculum.splice(sectionIndex, 1);
    
    // Reorder remaining sections
    course.curriculum.forEach((section, index) => {
      section.order = index;
    });
    
    // Recalculate total duration
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    logger.info('Section deleted successfully', { courseId, sectionId });

    res.json({
      success: true,
      message: 'Section deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting section:', error);
    next(error);
  }
};

// Reorder sections in curriculum
export const reorderSections = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { sectionOrder } = req.body; // Array of section IDs in new order
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Reordering sections', { courseId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Validate all section IDs exist
    const currentSectionIds = course.curriculum.map(s => s.id);
    const validOrder = sectionOrder.every((id: string) => 
      currentSectionIds.includes(id)
    );

    if (!validOrder || sectionOrder.length !== course.curriculum.length) {
      res.status(400).json({
        success: false,
        message: 'Invalid section order',
        error: { code: 'INVALID_SECTION_ORDER' }
      });
      return;
    }

    // Reorder curriculum based on provided order
    const reorderedCurriculum = sectionOrder.map((sectionId: string, index: number) => {
      const section = course.curriculum.find(s => s.id === sectionId)!;
      section.order = index;
      return section;
    });

    course.curriculum = reorderedCurriculum;
    await course.save();

    logger.info('Sections reordered successfully', { courseId });

    res.json({
      success: true,
      data: course.curriculum,
      message: 'Sections reordered successfully'
    });
  } catch (error: any) {
    logger.error('Error reordering sections:', error);
    next(error);
  }
};

// Add a lesson to a section
export const addLesson = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, sectionId } = req.params;
    const lessonData = req.body;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Adding lesson to section', { courseId, sectionId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Find section
    const section = course.curriculum.find(s => s.id === sectionId);
    if (!section) {
      res.status(404).json({
        success: false,
        message: 'Section not found',
        error: { code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    // Create new lesson
    const newLesson = {
      id: lessonData.id || `lesson-${Date.now()}`,
      sectionId: sectionId,
      title: lessonData.title || 'New Lesson',
      description: lessonData.description || '',
      videoUrl: lessonData.videoUrl || '',
      duration: lessonData.duration || 0,
      order: lessonData.order ?? section.lessons.length,
      resources: lessonData.resources || [],
      quiz: lessonData.quiz || null
    };

    // Add lesson to section
    section.lessons.push(newLesson);
    
    // Update section duration
    section.duration = section.lessons.reduce((total, lesson) => 
      total + (lesson.duration || 0), 0
    );
    
    // Update course duration
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    logger.info('Lesson added successfully', { 
      courseId, 
      sectionId, 
      lessonId: newLesson.id 
    });

    res.json({
      success: true,
      data: newLesson,
      message: 'Lesson added successfully'
    });
  } catch (error: any) {
    logger.error('Error adding lesson:', error);
    next(error);
  }
};

// Update a lesson in a section
export const updateLesson = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const updates = req.body;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Updating lesson', { courseId, sectionId, lessonId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Find section and lesson
    const section = course.curriculum.find(s => s.id === sectionId);
    if (!section) {
      res.status(404).json({
        success: false,
        message: 'Section not found',
        error: { code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    const lessonIndex = section.lessons.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Lesson not found',
        error: { code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    // Update lesson fields
    const lesson = section.lessons[lessonIndex];
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'sectionId') {
        (lesson as any)[key] = updates[key];
      }
    });

    // Sort lessons by order
    section.lessons.sort((a, b) => a.order - b.order);
    
    // Update section duration
    section.duration = section.lessons.reduce((total, lesson) => 
      total + (lesson.duration || 0), 0
    );
    
    // Update course duration
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    logger.info('Lesson updated successfully', { courseId, sectionId, lessonId });

    res.json({
      success: true,
      data: lesson,
      message: 'Lesson updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating lesson:', error);
    next(error);
  }
};

// Delete a lesson from a section
export const deleteLesson = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, sectionId, lessonId } = req.params;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Deleting lesson', { courseId, sectionId, lessonId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Find section
    const section = course.curriculum.find(s => s.id === sectionId);
    if (!section) {
      res.status(404).json({
        success: false,
        message: 'Section not found',
        error: { code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    // Find and remove lesson
    const lessonIndex = section.lessons.findIndex(l => l.id === lessonId);
    if (lessonIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Lesson not found',
        error: { code: 'LESSON_NOT_FOUND' }
      });
      return;
    }

    section.lessons.splice(lessonIndex, 1);
    
    // Reorder remaining lessons
    section.lessons.forEach((lesson, index) => {
      lesson.order = index;
    });
    
    // Update section duration
    section.duration = section.lessons.reduce((total, lesson) => 
      total + (lesson.duration || 0), 0
    );
    
    // Update course duration
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    logger.info('Lesson deleted successfully', { courseId, sectionId, lessonId });

    res.json({
      success: true,
      message: 'Lesson deleted successfully'
    });
  } catch (error: any) {
    logger.error('Error deleting lesson:', error);
    next(error);
  }
};

// Reorder lessons within a section
export const reorderLessons = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId, sectionId } = req.params;
    const { lessonOrder } = req.body; // Array of lesson IDs in new order
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Reordering lessons', { courseId, sectionId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Find section
    const section = course.curriculum.find(s => s.id === sectionId);
    if (!section) {
      res.status(404).json({
        success: false,
        message: 'Section not found',
        error: { code: 'SECTION_NOT_FOUND' }
      });
      return;
    }

    // Validate all lesson IDs exist
    const currentLessonIds = section.lessons.map(l => l.id);
    const validOrder = lessonOrder.every((id: string) => 
      currentLessonIds.includes(id)
    );

    if (!validOrder || lessonOrder.length !== section.lessons.length) {
      res.status(400).json({
        success: false,
        message: 'Invalid lesson order',
        error: { code: 'INVALID_LESSON_ORDER' }
      });
      return;
    }

    // Reorder lessons based on provided order
    const reorderedLessons = lessonOrder.map((lessonId: string, index: number) => {
      const lesson = section.lessons.find(l => l.id === lessonId)!;
      lesson.order = index;
      return lesson;
    });

    section.lessons = reorderedLessons;
    await course.save();

    logger.info('Lessons reordered successfully', { courseId, sectionId });

    res.json({
      success: true,
      data: section.lessons,
      message: 'Lessons reordered successfully'
    });
  } catch (error: any) {
    logger.error('Error reordering lessons:', error);
    next(error);
  }
};

// Update entire curriculum (for bulk updates)
export const updateCurriculum = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { curriculum } = req.body;
    const authReq = req as any;
    const instructorId = authReq.userId;

    logger.info('Updating entire curriculum', { courseId, instructorId });

    const course = await findCourse(courseId);
    if (!course) {
      res.status(404).json({
        success: false,
        message: 'Course not found',
        error: { 
          code: 'COURSE_NOT_FOUND',
          details: `No course found with ID or slug: ${courseId}`
        }
      });
      return;
    }

    // Check permission
    if (course.instructor.id !== instructorId && !req.headers['x-is-admin']) {
      res.status(403).json({
        success: false,
        message: 'Unauthorized to modify this course',
        error: { code: 'UNAUTHORIZED' }
      });
      return;
    }

    // Validate curriculum structure
    if (!Array.isArray(curriculum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid curriculum format',
        error: { code: 'INVALID_CURRICULUM' }
      });
      return;
    }

    // Update curriculum
    course.curriculum = curriculum;
    
    // Recalculate durations
    course.curriculum.forEach(section => {
      section.duration = section.lessons.reduce((total, lesson) => 
        total + (lesson.duration || 0), 0
      );
    });
    
    course.duration = course.curriculum.reduce((total, section) => 
      total + (section.duration || 0), 0
    );

    await course.save();

    // Publish course updated event
    const eventPublisher = getCourseEventPublisher();
    await eventPublisher.publishCourseUpdated(
      courseId, 
      { duration: course.duration }, 
      instructorId.toString()
    );

    logger.info('Curriculum updated successfully', { courseId });

    res.json({
      success: true,
      data: course.curriculum,
      message: 'Curriculum updated successfully'
    });
  } catch (error: any) {
    logger.error('Error updating curriculum:', error);
    next(error);
  }
};