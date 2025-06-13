import { Router } from 'express';
import { 
  getUserProgress,
  updateProgress,
  getCourseProgress,
  getCompletedCourses
} from '../controllers/progressController';

const router = Router();

router.get('/user/:userId', getUserProgress);
router.post('/update', updateProgress);
router.get('/course/:courseId/user/:userId', getCourseProgress);
router.get('/completed/:userId', getCompletedCourses);

export default router;