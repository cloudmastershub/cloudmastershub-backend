import { Router } from 'express';
import { body } from 'express-validator';
import {
  getForums,
  getForumById,
  createForum,
  updateForum,
  deleteForum,
  getForumThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
  replyToThread
} from '../controllers/forumController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Public routes
router.get('/', getForums);
router.get('/:id', getForumById);
router.get('/:id/threads', getForumThreads);

// Protected routes
router.use(authenticate);

// Forum management (admin only)
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('icon').optional().trim(),
    body('color').optional().trim(),
    body('sortOrder').optional().isInt({ min: 0 })
  ],
  validateRequest,
  createForum
);

router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim().notEmpty(),
    body('icon').optional().trim(),
    body('color').optional().trim(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean(),
    body('moderators').optional().isArray()
  ],
  validateRequest,
  updateForum
);

router.delete('/:id', deleteForum);

// Thread routes
router.post(
  '/:id/threads',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('tags').optional().isArray()
  ],
  validateRequest,
  createThread
);

export default router;

// Thread-specific routes (mounted at /threads)
export const threadRouter = Router();

threadRouter.get('/:threadId', getThread);

threadRouter.use(authenticate);

threadRouter.put(
  '/:threadId',
  [
    body('title').optional().trim().notEmpty(),
    body('content').optional().trim().notEmpty(),
    body('tags').optional().isArray(),
    body('isPinned').optional().isBoolean(),
    body('isLocked').optional().isBoolean()
  ],
  validateRequest,
  updateThread
);

threadRouter.delete('/:threadId', deleteThread);

threadRouter.post(
  '/:threadId/replies',
  [
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('parentId').optional().isMongoId()
  ],
  validateRequest,
  replyToThread
);
