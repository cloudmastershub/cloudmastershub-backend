import { Router } from 'express';
import { body } from 'express-validator';
import {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  voteQuestion,
  createAnswer,
  updateAnswer,
  deleteAnswer,
  acceptAnswer,
  voteAnswer
} from '../controllers/questionController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Public routes
router.get('/', getQuestions);
router.get('/:id', getQuestionById);

// Protected routes
router.use(authenticate);

router.post(
  '/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('tags').optional().isArray(),
    body('category').optional().isString(),
    body('courseId').optional().isString(),
    body('bountyPoints').optional().isInt({ min: 0 })
  ],
  validateRequest,
  createQuestion
);

router.put(
  '/:id',
  [
    body('title').optional().trim().notEmpty(),
    body('content').optional().trim().notEmpty(),
    body('tags').optional().isArray(),
    body('category').optional().isString()
  ],
  validateRequest,
  updateQuestion
);

router.delete('/:id', deleteQuestion);

router.post(
  '/:id/vote',
  [
    body('vote').isIn([1, -1]).withMessage('Vote must be 1 or -1')
  ],
  validateRequest,
  voteQuestion
);

router.post(
  '/:id/answers',
  [
    body('content').trim().notEmpty().withMessage('Content is required')
  ],
  validateRequest,
  createAnswer
);

export default router;

// Answer-specific routes (mounted at /answers)
export const answerRouter = Router();

answerRouter.use(authenticate);

answerRouter.put(
  '/:answerId',
  [
    body('content').trim().notEmpty().withMessage('Content is required')
  ],
  validateRequest,
  updateAnswer
);

answerRouter.delete('/:answerId', deleteAnswer);

answerRouter.post('/:answerId/accept', acceptAnswer);

answerRouter.post(
  '/:answerId/vote',
  [
    body('vote').isIn([1, -1]).withMessage('Vote must be 1 or -1')
  ],
  validateRequest,
  voteAnswer
);
