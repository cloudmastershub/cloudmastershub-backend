import { Router } from 'express';
import {
  getUserProgress,
  getUserStreaks,
  updateProgress,
  getCourseProgress,
  getCompletedCourses,
} from '../controllers/progressController';

const router = Router();

router.get('/user/:userId', getUserProgress);
router.get('/user/:userId/streaks', getUserStreaks);
router.post('/update', updateProgress);
router.get('/course/:courseId/user/:userId', getCourseProgress);
router.get('/completed/:userId', getCompletedCourses);

export default router;
