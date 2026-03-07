import { Router } from 'express';
import {
  createReview,
  getCourseReviews,
  updateReview,
  deleteReview,
  markReviewHelpful,
  reportReview,
} from '../controllers/reviewController';
import { authenticate } from '@cloudmastershub/middleware';
import { validateSlugParam } from '../utils/slugValidation';

const router = Router({ mergeParams: true });

// Public - list reviews for a course
router.get('/', validateSlugParam('id'), getCourseReviews);

// Protected - create, update, delete own review
router.post('/', authenticate, validateSlugParam('id'), createReview);
router.put('/', authenticate, validateSlugParam('id'), updateReview);
router.delete('/', authenticate, validateSlugParam('id'), deleteReview);

// Protected - mark helpful / report
router.post('/:reviewId/helpful', authenticate, markReviewHelpful);
router.post('/:reviewId/report', authenticate, reportReview);

export default router;
