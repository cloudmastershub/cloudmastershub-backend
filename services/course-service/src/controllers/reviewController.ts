import { Request, Response, NextFunction } from 'express';
import { Review } from '../models/Review';
import { Course } from '../models/Course';
import { CourseProgress } from '../models/CourseProgress';
import logger from '../utils/logger';

/**
 * Recalculate and update a course's aggregate rating from all its reviews.
 */
async function recalculateCourseRating(courseSlug: string): Promise<void> {
  const stats = await Review.aggregate([
    { $match: { courseId: courseSlug, status: 'published' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const avg = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
  await Course.findOneAndUpdate({ slug: courseSlug }, { rating: avg });
}

/**
 * POST /courses/:id/reviews - Create a review
 * Requires enrollment in the course.
 */
export const createReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseSlug = req.params.id;
    const userId = (req as any).user?.userId;
    const { rating, title, content } = req.body;

    if (!rating || !title || !content) {
      res.status(400).json({
        success: false,
        message: 'rating, title, and content are required',
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
      return;
    }

    // Verify course exists
    const course = await Course.findOne({ slug: courseSlug });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }

    // Verify user is enrolled
    const progress = await CourseProgress.findOne({ userId, courseId: courseSlug });
    if (!progress) {
      res.status(403).json({
        success: false,
        message: 'You must be enrolled in this course to leave a review',
      });
      return;
    }

    // Check for existing review
    const existing = await Review.findOne({ userId, courseId: courseSlug });
    if (existing) {
      res.status(409).json({
        success: false,
        message: 'You have already reviewed this course. Use PUT to update.',
      });
      return;
    }

    const review = new Review({
      userId,
      courseId: courseSlug,
      rating,
      title: title.trim(),
      content: content.trim(),
    });

    await review.save();
    await recalculateCourseRating(courseSlug);

    logger.info('Review created', { courseId: courseSlug, userId, rating });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: review.toJSON(),
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({
        success: false,
        message: 'You have already reviewed this course',
      });
      return;
    }
    logger.error('Error creating review:', error);
    next(error);
  }
};

/**
 * GET /courses/:id/reviews - List reviews for a course
 * Public endpoint.
 */
export const getCourseReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseSlug = req.params.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const sort = req.query.sort === 'oldest' ? 'createdAt' : req.query.sort === 'helpful' ? '-helpful' : '-createdAt';

    const filter: any = { courseId: courseSlug, status: 'published' };

    const ratingFilter = parseInt(req.query.rating as string);
    if (ratingFilter >= 1 && ratingFilter <= 5) {
      filter.rating = ratingFilter;
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
    ]);

    // Rating distribution
    const distribution = await Review.aggregate([
      { $match: { courseId: courseSlug, status: 'published' } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    const ratingCounts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalReviews = 0;
    let ratingSum = 0;
    for (const d of distribution) {
      ratingCounts[d._id] = d.count;
      totalReviews += d.count;
      ratingSum += d._id * d.count;
    }
    const averageRating = totalReviews > 0 ? Math.round((ratingSum / totalReviews) * 10) / 10 : 0;

    res.status(200).json({
      success: true,
      data: {
        reviews: reviews.map(r => ({
          id: (r as any)._id.toString(),
          userId: r.userId,
          rating: r.rating,
          title: r.title,
          content: r.content,
          helpful: r.helpful,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        summary: {
          averageRating,
          totalReviews,
          distribution: ratingCounts,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching reviews:', error);
    next(error);
  }
};

/**
 * PUT /courses/:id/reviews - Update own review
 */
export const updateReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseSlug = req.params.id;
    const userId = (req as any).user?.userId;
    const { rating, title, content } = req.body;

    const review = await Review.findOne({ userId, courseId: courseSlug });
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
        return;
      }
      review.rating = rating;
    }
    if (title !== undefined) review.title = title.trim();
    if (content !== undefined) review.content = content.trim();

    await review.save();
    await recalculateCourseRating(courseSlug);

    logger.info('Review updated', { courseId: courseSlug, userId });

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: review.toJSON(),
    });
  } catch (error: any) {
    logger.error('Error updating review:', error);
    next(error);
  }
};

/**
 * DELETE /courses/:id/reviews - Delete own review
 */
export const deleteReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const courseSlug = req.params.id;
    const userId = (req as any).user?.userId;

    const review = await Review.findOneAndDelete({ userId, courseId: courseSlug });
    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    await recalculateCourseRating(courseSlug);

    logger.info('Review deleted', { courseId: courseSlug, userId });

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting review:', error);
    next(error);
  }
};

/**
 * POST /courses/:id/reviews/:reviewId/helpful - Mark a review as helpful
 */
export const markReviewHelpful = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { $inc: { helpful: 1 } },
      { new: true }
    );

    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: { helpful: review.helpful },
    });
  } catch (error: any) {
    logger.error('Error marking review helpful:', error);
    next(error);
  }
};

/**
 * POST /courses/:id/reviews/:reviewId/report - Report a review
 */
export const reportReview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findByIdAndUpdate(
      reviewId,
      { reported: true },
      { new: true }
    );

    if (!review) {
      res.status(404).json({ success: false, message: 'Review not found' });
      return;
    }

    logger.info('Review reported', { reviewId });

    res.status(200).json({
      success: true,
      message: 'Review reported for moderation',
    });
  } catch (error: any) {
    logger.error('Error reporting review:', error);
    next(error);
  }
};
