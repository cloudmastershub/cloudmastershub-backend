import { Router } from 'express';
import {
  getUserBookmarks,
  getLessonBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  getLastPosition
} from '../controllers/bookmarkController';
import { authenticate } from '@cloudmastershub/middleware';

const router = Router();

// Get all bookmarks for authenticated user (optionally filter by courseId query param)
router.get('/', authenticate, getUserBookmarks);

// Get bookmarks for a specific lesson
router.get('/courses/:courseId/lessons/:lessonId', authenticate, getLessonBookmarks);

// Get last saved position for a lesson (for resume playback)
router.get('/courses/:courseId/lessons/:lessonId/position', authenticate, getLastPosition);

// Create a bookmark for a lesson
router.post('/courses/:courseId/lessons/:lessonId', authenticate, createBookmark);

// Update a bookmark
router.put('/:bookmarkId', authenticate, updateBookmark);

// Delete a bookmark
router.delete('/:bookmarkId', authenticate, deleteBookmark);

export default router;
