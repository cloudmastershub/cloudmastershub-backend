import express, { Request, Response, NextFunction } from 'express';
import { Comment, ModerationAction } from '../models/Comment';
import logger from '../utils/logger';

const router = express.Router();

// Middleware to extract user info from request
// In production, this would be extracted from JWT token
interface AuthRequest extends Request {
  userId?: string;
  userRoles?: string[];
}

const extractUser = (req: AuthRequest, _res: Response, next: NextFunction) => {
  // Extract user info from headers (set by API gateway/auth middleware)
  req.userId = req.headers['x-user-id'] as string || req.headers['authorization']?.replace('Bearer ', '') || '';
  req.userRoles = (req.headers['x-user-roles'] as string)?.split(',') || [];
  next();
};

router.use(extractUser);

/**
 * GET /moderation/queue
 * Get flagged/pending comments for moderation
 * Query params:
 *   - courseId: Filter by specific course
 *   - status: 'flagged' | 'pending' | 'all' (default: 'flagged')
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 20)
 */
router.get('/queue', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { courseId, status = 'flagged', page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build query based on status filter
    const query: any = { isHidden: false };

    if (status === 'flagged') {
      query.isFlagged = true;
    } else if (status === 'pending') {
      query.moderatedAt = null;
    }

    if (courseId) {
      query.courseId = courseId;
    }

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .sort({ flaggedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Comment.countDocuments(query)
    ]);

    logger.info('Moderation queue fetched', {
      userId: req.userId,
      status,
      courseId,
      count: comments.length,
      total
    });

    res.json({
      success: true,
      data: {
        comments: comments.map(c => ({
          id: c._id.toString(),
          targetId: c.targetId.toString(),
          targetType: c.targetType,
          authorId: c.authorId,
          authorName: c.authorName,
          authorAvatar: c.authorAvatar,
          content: c.content,
          isFlagged: c.isFlagged,
          flagReason: c.flagReason,
          flaggedBy: c.flaggedBy,
          flaggedAt: c.flaggedAt,
          isHidden: c.isHidden,
          moderationAction: c.moderationAction,
          moderatedBy: c.moderatedBy,
          moderatedAt: c.moderatedAt,
          courseId: c.courseId?.toString(),
          createdAt: c.createdAt
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching moderation queue:', error);
    next(error);
  }
});

/**
 * GET /moderation/stats
 * Get moderation statistics
 */
router.get('/stats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { courseId } = req.query;
    const baseQuery: any = {};

    if (courseId) {
      baseQuery.courseId = courseId;
    }

    const [flaggedCount, hiddenCount, pendingCount, recentActions] = await Promise.all([
      Comment.countDocuments({ ...baseQuery, isFlagged: true, isHidden: false }),
      Comment.countDocuments({ ...baseQuery, isHidden: true }),
      Comment.countDocuments({ ...baseQuery, moderatedAt: null, isFlagged: false, isHidden: false }),
      Comment.find({ ...baseQuery, moderatedAt: { $ne: null } })
        .sort({ moderatedAt: -1 })
        .limit(10)
        .select('moderationAction moderatedBy moderatedAt')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        flagged: flaggedCount,
        hidden: hiddenCount,
        pending: pendingCount,
        total: flaggedCount + pendingCount,
        recentActions: recentActions.map(a => ({
          action: a.moderationAction,
          by: a.moderatedBy,
          at: a.moderatedAt
        }))
      }
    });
  } catch (error) {
    logger.error('Error fetching moderation stats:', error);
    next(error);
  }
});

/**
 * POST /moderation/comments/:id/flag
 * Flag a comment for moderation
 */
router.post('/comments/:id/flag', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const comment = await Comment.findByIdAndUpdate(
      id,
      {
        isFlagged: true,
        flagReason: reason || 'Reported by user',
        flaggedBy: req.userId,
        flaggedAt: new Date()
      },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({
        success: false,
        error: { message: 'Comment not found', code: 'NOT_FOUND' }
      });
      return;
    }

    logger.info('Comment flagged', {
      commentId: id,
      flaggedBy: req.userId,
      reason
    });

    res.json({
      success: true,
      message: 'Comment flagged for moderation',
      data: { id: comment._id.toString() }
    });
  } catch (error) {
    logger.error('Error flagging comment:', error);
    next(error);
  }
});

/**
 * POST /moderation/comments/:id/approve
 * Approve a flagged comment
 */
router.post('/comments/:id/approve', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findByIdAndUpdate(
      id,
      {
        isFlagged: false,
        isHidden: false,
        flagReason: null,
        moderatedBy: req.userId,
        moderatedAt: new Date(),
        moderationAction: 'approved' as ModerationAction
      },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({
        success: false,
        error: { message: 'Comment not found', code: 'NOT_FOUND' }
      });
      return;
    }

    logger.info('Comment approved', {
      commentId: id,
      moderatedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Comment approved',
      data: { id: comment._id.toString() }
    });
  } catch (error) {
    logger.error('Error approving comment:', error);
    next(error);
  }
});

/**
 * POST /moderation/comments/:id/hide
 * Hide a comment from public view
 */
router.post('/comments/:id/hide', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findByIdAndUpdate(
      id,
      {
        isHidden: true,
        isFlagged: false,
        moderatedBy: req.userId,
        moderatedAt: new Date(),
        moderationAction: 'hidden' as ModerationAction
      },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({
        success: false,
        error: { message: 'Comment not found', code: 'NOT_FOUND' }
      });
      return;
    }

    logger.info('Comment hidden', {
      commentId: id,
      moderatedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Comment hidden',
      data: { id: comment._id.toString() }
    });
  } catch (error) {
    logger.error('Error hiding comment:', error);
    next(error);
  }
});

/**
 * POST /moderation/comments/:id/unhide
 * Restore a hidden comment
 */
router.post('/comments/:id/unhide', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findByIdAndUpdate(
      id,
      {
        isHidden: false,
        moderatedBy: req.userId,
        moderatedAt: new Date(),
        moderationAction: 'approved' as ModerationAction
      },
      { new: true }
    );

    if (!comment) {
      res.status(404).json({
        success: false,
        error: { message: 'Comment not found', code: 'NOT_FOUND' }
      });
      return;
    }

    logger.info('Comment unhidden', {
      commentId: id,
      moderatedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Comment restored',
      data: { id: comment._id.toString() }
    });
  } catch (error) {
    logger.error('Error unhiding comment:', error);
    next(error);
  }
});

/**
 * DELETE /moderation/comments/:id
 * Permanently delete a comment
 */
router.delete('/comments/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const comment = await Comment.findByIdAndDelete(id);

    if (!comment) {
      res.status(404).json({
        success: false,
        error: { message: 'Comment not found', code: 'NOT_FOUND' }
      });
      return;
    }

    logger.info('Comment deleted', {
      commentId: id,
      deletedBy: req.userId
    });

    res.json({
      success: true,
      message: 'Comment deleted permanently'
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    next(error);
  }
});

/**
 * POST /moderation/bulk
 * Perform bulk moderation actions
 */
router.post('/bulk', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { commentIds, action } = req.body as { commentIds: string[]; action: 'approve' | 'hide' | 'delete' };

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'commentIds must be a non-empty array', code: 'INVALID_INPUT' }
      });
      return;
    }

    if (!['approve', 'hide', 'delete'].includes(action)) {
      res.status(400).json({
        success: false,
        error: { message: 'action must be approve, hide, or delete', code: 'INVALID_ACTION' }
      });
      return;
    }

    let result;

    if (action === 'delete') {
      result = await Comment.deleteMany({ _id: { $in: commentIds } });
    } else {
      const updateData: any = {
        moderatedBy: req.userId,
        moderatedAt: new Date(),
        isFlagged: false
      };

      if (action === 'approve') {
        updateData.isHidden = false;
        updateData.moderationAction = 'approved';
      } else if (action === 'hide') {
        updateData.isHidden = true;
        updateData.moderationAction = 'hidden';
      }

      result = await Comment.updateMany(
        { _id: { $in: commentIds } },
        { $set: updateData }
      );
    }

    logger.info('Bulk moderation action performed', {
      action,
      count: commentIds.length,
      performedBy: req.userId
    });

    const modifiedCount = 'deletedCount' in result ? result.deletedCount : result.modifiedCount;

    res.json({
      success: true,
      message: `${action === 'delete' ? 'Deleted' : action === 'approve' ? 'Approved' : 'Hidden'} ${commentIds.length} comments`,
      data: { modifiedCount }
    });
  } catch (error) {
    logger.error('Error performing bulk moderation:', error);
    next(error);
  }
});

export default router;
