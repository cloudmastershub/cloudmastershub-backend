import { Router } from 'express';
import {
  addSection,
  updateSection,
  deleteSection,
  reorderSections,
  addLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  updateCurriculum
} from '../controllers/curriculumController';
import { authenticate } from '@cloudmastershub/middleware';

const router = Router();

// Curriculum management routes - all require authentication
router.use(authenticate);

// Section management
router.post('/:courseId/sections', addSection);
router.put('/:courseId/sections/:sectionId', updateSection);
router.delete('/:courseId/sections/:sectionId', deleteSection);
router.put('/:courseId/sections/reorder', reorderSections);

// Lesson management within sections
router.post('/:courseId/sections/:sectionId/lessons', addLesson);
router.put('/:courseId/sections/:sectionId/lessons/:lessonId', updateLesson);
router.delete('/:courseId/sections/:sectionId/lessons/:lessonId', deleteLesson);
router.put('/:courseId/sections/:sectionId/lessons/reorder', reorderLessons);

// Bulk curriculum update
router.put('/:courseId/curriculum', updateCurriculum);

export default router;