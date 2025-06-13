import { Router } from 'express';
import { 
  getLessonsByCourse,
  getLessonById,
  createLesson,
  updateLesson,
  deleteLesson,
  markLessonComplete
} from '../controllers/lessonController';

const router = Router({ mergeParams: true });

router.get('/', getLessonsByCourse);
router.get('/:lessonId', getLessonById);
router.post('/', createLesson);
router.put('/:lessonId', updateLesson);
router.delete('/:lessonId', deleteLesson);
router.post('/:lessonId/complete', markLessonComplete);

export default router;