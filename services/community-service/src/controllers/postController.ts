import { Response, NextFunction } from 'express';
import { AuthRequest } from '@cloudmastershub/middleware';
import { Post, Comment, Like, Connection } from '../models';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export const getPosts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;
    const filter = req.query.filter as string;
    const tag = req.query.tag as string;
    const postType = req.query.postType as string;

    let query: any = { visibility: 'public' };

    if (userId && filter === 'following') {
      const following = await Connection.find({
        followerId: userId,
        status: 'following'
      }).select('followingId');

      const followingIds = following.map(c => c.followingId);
      followingIds.push(userId);

      query = {
        $or: [
          { authorId: { $in: followingIds } },
          { visibility: 'public' }
        ]
      };
    }

    if (tag) {
      query.tags = tag;
    }

    if (postType) {
      query.postType = postType;
    }

    const [posts, total] = await Promise.all([
      Post.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(query)
    ]);

    let postsWithLikeStatus = posts;
    if (userId) {
      const postIds = posts.map(p => p._id);
      const userLikes = await Like.find({
        targetId: { $in: postIds },
        targetType: 'post',
        userId
      });
      const likedPostIds = new Set(userLikes.map(l => l.targetId.toString()));

      postsWithLikeStatus = posts.map(post => ({
        ...post.toJSON(),
        isLiked: likedPostIds.has(post._id.toString())
      })) as any;
    }

    res.json({
      success: true,
      data: {
        posts: postsWithLikeStatus,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching posts:', error);
    next(error);
  }
};

export const getPostById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.visibility === 'private' && post.authorId !== userId) {
      throw new ForbiddenError('This post is private');
    }

    let isLiked = false;
    if (userId) {
      const like = await Like.findOne({
        targetId: id,
        targetType: 'post',
        userId
      });
      isLiked = !!like;
    }

    res.json({
      success: true,
      data: {
        ...post.toJSON(),
        isLiked
      }
    });
  } catch (error) {
    logger.error('Error fetching post:', error);
    next(error);
  }
};

export const createPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { content, postType, visibility, images, links, tags, groupId, courseId } = req.body;

    if (!content) {
      throw new BadRequestError('Content is required');
    }

    const post = new Post({
      authorId: userId,
      authorName: req.user?.email?.split('@')[0] || 'User',
      content,
      postType: postType || 'general',
      visibility: visibility || 'public',
      images: images || [],
      links: links || [],
      tags: tags || [],
      groupId,
      courseId
    });

    await post.save();

    logger.info(`Post created by ${userId}`);

    res.status(201).json({
      success: true,
      data: post
    });
  } catch (error) {
    logger.error('Error creating post:', error);
    next(error);
  }
};

export const updatePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;

    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own posts');
    }

    const { content, postType, visibility, images, links, tags } = req.body;

    if (content !== undefined) post.content = content;
    if (postType !== undefined) post.postType = postType;
    if (visibility !== undefined) post.visibility = visibility;
    if (images !== undefined) post.images = images;
    if (links !== undefined) post.links = links;
    if (tags !== undefined) post.tags = tags;

    post.isEdited = true;
    post.editedAt = new Date();

    await post.save();

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    logger.error('Error updating post:', error);
    next(error);
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const isModerator = userRoles.includes('admin') || userRoles.includes('moderator');
    if (post.authorId !== userId && !isModerator) {
      throw new ForbiddenError('You can only delete your own posts');
    }

    await Comment.deleteMany({ targetId: id, targetType: 'post' });
    await Like.deleteMany({ targetId: id, targetType: 'post' });
    await Post.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting post:', error);
    next(error);
  }
};

export const likePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { reactionType } = req.body;

    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const existingLike = await Like.findOne({
      targetId: id,
      targetType: 'post',
      userId
    });

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      await Post.findByIdAndUpdate(id, { $inc: { likeCount: -1 } });

      res.json({
        success: true,
        data: { liked: false, likeCount: post.likeCount - 1 }
      });
    } else {
      const like = new Like({
        targetId: id,
        targetType: 'post',
        userId,
        reactionType: reactionType || 'like'
      });
      await like.save();
      await Post.findByIdAndUpdate(id, { $inc: { likeCount: 1 } });

      res.json({
        success: true,
        data: { liked: true, likeCount: post.likeCount + 1 }
      });
    }
  } catch (error) {
    logger.error('Error liking post:', error);
    next(error);
  }
};

export const getPostComments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const [comments, total] = await Promise.all([
      Comment.find({ targetId: id, targetType: 'post', parentId: null })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments({ targetId: id, targetType: 'post', parentId: null })
    ]);

    const commentIds = comments.map(c => c._id);
    const replies = await Comment.find({
      parentId: { $in: commentIds }
    }).sort({ createdAt: 1 });

    const commentsWithReplies = comments.map(comment => ({
      ...comment.toJSON(),
      replies: replies.filter(r => r.parentId?.toString() === comment._id.toString())
    }));

    res.json({
      success: true,
      data: {
        comments: commentsWithReplies,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching comments:', error);
    next(error);
  }
};

export const addComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.userId!;
    const { content, parentId } = req.body;

    if (!content) {
      throw new BadRequestError('Content is required');
    }

    const post = await Post.findById(id);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const comment = new Comment({
      targetId: id,
      targetType: 'post',
      parentId: parentId || null,
      authorId: userId,
      authorName: req.user?.email?.split('@')[0] || 'User',
      content
    });

    await comment.save();

    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }

    await Post.findByIdAndUpdate(id, { $inc: { commentCount: 1 } });

    res.status(201).json({
      success: true,
      data: comment
    });
  } catch (error) {
    logger.error('Error adding comment:', error);
    next(error);
  }
};

export const updateComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.userId!;
    const { content } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    if (comment.authorId !== userId) {
      throw new ForbiddenError('You can only edit your own comments');
    }

    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await comment.save();

    res.json({
      success: true,
      data: comment
    });
  } catch (error) {
    logger.error('Error updating comment:', error);
    next(error);
  }
};

export const deleteComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    const isModerator = userRoles.includes('admin') || userRoles.includes('moderator');
    if (comment.authorId !== userId && !isModerator) {
      throw new ForbiddenError('You can only delete your own comments');
    }

    await Comment.deleteMany({ parentId: commentId });
    await Like.deleteMany({ targetId: commentId, targetType: 'comment' });
    await Comment.findByIdAndDelete(commentId);

    if (comment.parentId) {
      await Comment.findByIdAndUpdate(comment.parentId, { $inc: { replyCount: -1 } });
    }

    await Post.findByIdAndUpdate(comment.targetId, { $inc: { commentCount: -1 } });

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting comment:', error);
    next(error);
  }
};
