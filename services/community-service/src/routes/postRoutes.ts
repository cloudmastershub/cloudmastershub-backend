import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  deletePost,
  likePost,
  getPostComments,
  addComment,
  updateComment,
  deleteComment
} from '../controllers/postController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Public routes
router.get('/', getPosts);
router.get('/:id', getPostById);
router.get('/:id/comments', getPostComments);

// Protected routes
router.use(authenticate);

router.post(
  '/',
  [
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('postType').optional().isIn(['general', 'achievement', 'question', 'tip', 'resource']),
    body('visibility').optional().isIn(['public', 'followers', 'private']),
    body('images').optional().isArray(),
    body('links').optional().isArray(),
    body('tags').optional().isArray(),
    body('groupId').optional().isMongoId(),
    body('courseId').optional().isString()
  ],
  validateRequest,
  createPost
);

router.put(
  '/:id',
  [
    body('content').optional().trim().notEmpty(),
    body('postType').optional().isIn(['general', 'achievement', 'question', 'tip', 'resource']),
    body('visibility').optional().isIn(['public', 'followers', 'private']),
    body('images').optional().isArray(),
    body('links').optional().isArray(),
    body('tags').optional().isArray()
  ],
  validateRequest,
  updatePost
);

router.delete('/:id', deletePost);

router.post(
  '/:id/like',
  [
    body('reactionType').optional().isIn(['like', 'love', 'celebrate', 'insightful', 'curious'])
  ],
  validateRequest,
  likePost
);

router.post(
  '/:id/comments',
  [
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('parentId').optional().isMongoId()
  ],
  validateRequest,
  addComment
);

router.put(
  '/comments/:commentId',
  [
    body('content').trim().notEmpty().withMessage('Content is required')
  ],
  validateRequest,
  updateComment
);

router.delete('/comments/:commentId', deleteComment);

export default router;
