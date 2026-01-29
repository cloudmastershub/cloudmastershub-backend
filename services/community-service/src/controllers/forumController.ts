import { Response, NextFunction } from 'express';
import { AuthRequest } from '@cloudmastershub/middleware';
import { Forum, Thread, Comment } from '../models';
import { NotFoundError, BadRequestError, ForbiddenError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

export const getForums = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const forums = await Forum.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 });

    res.json({
      success: true,
      data: forums
    });
  } catch (error) {
    logger.error('Error fetching forums:', error);
    next(error);
  }
};

export const getForumById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const forum = await Forum.findById(id);
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }

    res.json({
      success: true,
      data: forum
    });
  } catch (error) {
    logger.error('Error fetching forum:', error);
    next(error);
  }
};

export const createForum = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    const userRoles = req.userRoles || [];

    if (!userRoles.includes('admin') && !userRoles.includes('moderator')) {
      throw new ForbiddenError('Only admins can create forums');
    }

    const { name, description, icon, color, sortOrder } = req.body;

    if (!name || !description) {
      throw new BadRequestError('Name and description are required');
    }

    const slug = generateSlug(name);
    const existingForum = await Forum.findOne({ slug });
    if (existingForum) {
      throw new BadRequestError('A forum with this name already exists');
    }

    const forum = new Forum({
      name,
      slug,
      description,
      icon,
      color,
      sortOrder: sortOrder || 0,
      createdBy: userId
    });

    await forum.save();

    logger.info(`Forum created: ${forum.name} by ${userId}`);

    res.status(201).json({
      success: true,
      data: forum
    });
  } catch (error) {
    logger.error('Error creating forum:', error);
    next(error);
  }
};

export const updateForum = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userRoles = req.userRoles || [];

    if (!userRoles.includes('admin') && !userRoles.includes('moderator')) {
      throw new ForbiddenError('Only admins can update forums');
    }

    const forum = await Forum.findById(id);
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }

    const { name, description, icon, color, sortOrder, isActive, moderators } = req.body;

    if (name && name !== forum.name) {
      forum.name = name;
      forum.slug = generateSlug(name);
    }
    if (description !== undefined) forum.description = description;
    if (icon !== undefined) forum.icon = icon;
    if (color !== undefined) forum.color = color;
    if (sortOrder !== undefined) forum.sortOrder = sortOrder;
    if (isActive !== undefined) forum.isActive = isActive;
    if (moderators !== undefined) forum.moderators = moderators;

    await forum.save();

    res.json({
      success: true,
      data: forum
    });
  } catch (error) {
    logger.error('Error updating forum:', error);
    next(error);
  }
};

export const deleteForum = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userRoles = req.userRoles || [];

    if (!userRoles.includes('admin')) {
      throw new ForbiddenError('Only admins can delete forums');
    }

    const forum = await Forum.findById(id);
    if (!forum) {
      throw new NotFoundError('Forum not found');
    }

    forum.isActive = false;
    await forum.save();

    res.json({
      success: true,
      message: 'Forum deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting forum:', error);
    next(error);
  }
};

export const getForumThreads = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const forum = await Forum.findById(id);
    if (!forum || !forum.isActive) {
      throw new NotFoundError('Forum not found');
    }

    const [threads, total] = await Promise.all([
      Thread.find({ forumId: id })
        .sort({ isPinned: -1, lastReplyAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Thread.countDocuments({ forumId: id })
    ]);

    res.json({
      success: true,
      data: {
        threads,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching forum threads:', error);
    next(error);
  }
};

export const createThread = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: forumId } = req.params;
    const userId = req.userId!;
    const { title, content, tags } = req.body;

    if (!title || !content) {
      throw new BadRequestError('Title and content are required');
    }

    const forum = await Forum.findById(forumId);
    if (!forum || !forum.isActive) {
      throw new NotFoundError('Forum not found');
    }

    const slug = `${generateSlug(title)}-${Date.now().toString(36)}`;

    const thread = new Thread({
      forumId,
      title,
      slug,
      content,
      authorId: userId,
      authorName: req.user?.email?.split('@')[0] || 'User',
      tags: tags || []
    });

    await thread.save();

    await Forum.findByIdAndUpdate(forumId, {
      $inc: { threadCount: 1, postCount: 1 },
      lastActivity: new Date()
    });

    logger.info(`Thread created: ${thread.title} by ${userId}`);

    res.status(201).json({
      success: true,
      data: thread
    });
  } catch (error) {
    logger.error('Error creating thread:', error);
    next(error);
  }
};

export const getThread = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;

    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    await Thread.findByIdAndUpdate(threadId, { $inc: { viewCount: 1 } });

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [replies, totalReplies] = await Promise.all([
      Comment.find({ targetId: threadId, targetType: 'thread', parentId: null })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Comment.countDocuments({ targetId: threadId, targetType: 'thread', parentId: null })
    ]);

    res.json({
      success: true,
      data: {
        thread,
        replies,
        pagination: {
          page,
          limit,
          total: totalReplies,
          totalPages: Math.ceil(totalReplies / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching thread:', error);
    next(error);
  }
};

export const updateThread = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const isModerator = userRoles.includes('admin') || userRoles.includes('moderator');
    if (thread.authorId !== userId && !isModerator) {
      throw new ForbiddenError('You can only edit your own threads');
    }

    const { title, content, tags, isPinned, isLocked } = req.body;

    if (title !== undefined) {
      thread.title = title;
      thread.slug = `${generateSlug(title)}-${Date.now().toString(36)}`;
    }
    if (content !== undefined) thread.content = content;
    if (tags !== undefined) thread.tags = tags;

    if (isModerator) {
      if (isPinned !== undefined) thread.isPinned = isPinned;
      if (isLocked !== undefined) thread.isLocked = isLocked;
    }

    await thread.save();

    res.json({
      success: true,
      data: thread
    });
  } catch (error) {
    logger.error('Error updating thread:', error);
    next(error);
  }
};

export const deleteThread = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;
    const userId = req.userId!;
    const userRoles = req.userRoles || [];

    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    const isModerator = userRoles.includes('admin') || userRoles.includes('moderator');
    if (thread.authorId !== userId && !isModerator) {
      throw new ForbiddenError('You can only delete your own threads');
    }

    await Comment.deleteMany({ targetId: threadId, targetType: 'thread' });
    await Thread.findByIdAndDelete(threadId);

    await Forum.findByIdAndUpdate(thread.forumId, {
      $inc: { threadCount: -1, postCount: -(thread.replyCount + 1) }
    });

    res.json({
      success: true,
      message: 'Thread deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting thread:', error);
    next(error);
  }
};

export const replyToThread = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { threadId } = req.params;
    const userId = req.userId!;
    const { content, parentId } = req.body;

    if (!content) {
      throw new BadRequestError('Content is required');
    }

    const thread = await Thread.findById(threadId);
    if (!thread) {
      throw new NotFoundError('Thread not found');
    }

    if (thread.isLocked) {
      throw new ForbiddenError('This thread is locked');
    }

    const reply = new Comment({
      targetId: threadId,
      targetType: 'thread',
      parentId: parentId || null,
      authorId: userId,
      authorName: req.user?.email?.split('@')[0] || 'User',
      content
    });

    await reply.save();

    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    }

    await Thread.findByIdAndUpdate(threadId, {
      $inc: { replyCount: 1 },
      lastReplyAt: new Date(),
      lastReplyBy: userId
    });

    await Forum.findByIdAndUpdate(thread.forumId, {
      $inc: { postCount: 1 },
      lastActivity: new Date()
    });

    res.status(201).json({
      success: true,
      data: reply
    });
  } catch (error) {
    logger.error('Error replying to thread:', error);
    next(error);
  }
};
