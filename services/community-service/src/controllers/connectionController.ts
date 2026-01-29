import { Response, NextFunction } from 'express';
import { AuthRequest } from '@cloudmastershub/middleware';
import { Connection, Post, Comment } from '../models';
import { NotFoundError, BadRequestError, ConflictError } from '../middleware/errorHandler';
import logger from '../utils/logger';

export const getFollowers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.params.userId || req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [followers, total] = await Promise.all([
      Connection.find({ followingId: userId, status: 'following' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Connection.countDocuments({ followingId: userId, status: 'following' })
    ]);

    res.json({
      success: true,
      data: {
        followers,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching followers:', error);
    next(error);
  }
};

export const getFollowing = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.params.userId || req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const [following, total] = await Promise.all([
      Connection.find({ followerId: userId, status: 'following' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Connection.countDocuments({ followerId: userId, status: 'following' })
    ]);

    res.json({
      success: true,
      data: {
        following,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching following:', error);
    next(error);
  }
};

export const followUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { userId: targetUserId } = req.params;
    const { targetUserName, targetUserAvatar } = req.body;

    if (userId === targetUserId) {
      throw new BadRequestError('You cannot follow yourself');
    }

    const existingConnection = await Connection.findOne({
      followerId: userId,
      followingId: targetUserId
    });

    if (existingConnection) {
      if (existingConnection.status === 'following') {
        throw new ConflictError('You are already following this user');
      }
      if (existingConnection.status === 'blocked') {
        throw new BadRequestError('You have blocked this user');
      }
    }

    const blockedByTarget = await Connection.findOne({
      followerId: targetUserId,
      followingId: userId,
      status: 'blocked'
    });

    if (blockedByTarget) {
      throw new BadRequestError('You cannot follow this user');
    }

    const connection = new Connection({
      followerId: userId,
      followerName: req.user?.email?.split('@')[0] || 'User',
      followingId: targetUserId,
      followingName: targetUserName || 'User',
      followingAvatar: targetUserAvatar,
      status: 'following'
    });

    await connection.save();

    logger.info(`User ${userId} followed ${targetUserId}`);

    res.status(201).json({
      success: true,
      data: connection
    });
  } catch (error) {
    logger.error('Error following user:', error);
    next(error);
  }
};

export const unfollowUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { userId: targetUserId } = req.params;

    const connection = await Connection.findOne({
      followerId: userId,
      followingId: targetUserId,
      status: 'following'
    });

    if (!connection) {
      throw new NotFoundError('You are not following this user');
    }

    await Connection.findByIdAndDelete(connection._id);

    logger.info(`User ${userId} unfollowed ${targetUserId}`);

    res.json({
      success: true,
      message: 'Successfully unfollowed user'
    });
  } catch (error) {
    logger.error('Error unfollowing user:', error);
    next(error);
  }
};

export const blockUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { userId: targetUserId } = req.params;

    if (userId === targetUserId) {
      throw new BadRequestError('You cannot block yourself');
    }

    let connection = await Connection.findOne({
      followerId: userId,
      followingId: targetUserId
    });

    if (connection) {
      connection.status = 'blocked';
      await connection.save();
    } else {
      connection = new Connection({
        followerId: userId,
        followerName: req.user?.email?.split('@')[0] || 'User',
        followingId: targetUserId,
        followingName: 'User',
        status: 'blocked'
      });
      await connection.save();
    }

    await Connection.findOneAndDelete({
      followerId: targetUserId,
      followingId: userId,
      status: 'following'
    });

    logger.info(`User ${userId} blocked ${targetUserId}`);

    res.json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    logger.error('Error blocking user:', error);
    next(error);
  }
};

export const unblockUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { userId: targetUserId } = req.params;

    const connection = await Connection.findOne({
      followerId: userId,
      followingId: targetUserId,
      status: 'blocked'
    });

    if (!connection) {
      throw new NotFoundError('User is not blocked');
    }

    await Connection.findByIdAndDelete(connection._id);

    logger.info(`User ${userId} unblocked ${targetUserId}`);

    res.json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    logger.error('Error unblocking user:', error);
    next(error);
  }
};

export const getActivityFeed = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const skip = (page - 1) * limit;

    const following = await Connection.find({
      followerId: userId,
      status: 'following'
    }).select('followingId');

    const followingIds = following.map(c => c.followingId);
    followingIds.push(userId);

    const [posts, total] = await Promise.all([
      Post.find({
        $or: [
          { authorId: { $in: followingIds }, visibility: { $in: ['public', 'followers'] } },
          { authorId: userId }
        ]
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments({
        $or: [
          { authorId: { $in: followingIds }, visibility: { $in: ['public', 'followers'] } },
          { authorId: userId }
        ]
      })
    ]);

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching activity feed:', error);
    next(error);
  }
};

export const getUserProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId: targetUserId } = req.params;
    const currentUserId = req.userId;

    const [followerCount, followingCount, postCount] = await Promise.all([
      Connection.countDocuments({ followingId: targetUserId, status: 'following' }),
      Connection.countDocuments({ followerId: targetUserId, status: 'following' }),
      Post.countDocuments({ authorId: targetUserId, visibility: 'public' })
    ]);

    let isFollowing = false;
    let isFollowedBy = false;
    let isBlocked = false;

    if (currentUserId && currentUserId !== targetUserId) {
      const [followingConnection, followedByConnection, blockedConnection] = await Promise.all([
        Connection.findOne({
          followerId: currentUserId,
          followingId: targetUserId,
          status: 'following'
        }),
        Connection.findOne({
          followerId: targetUserId,
          followingId: currentUserId,
          status: 'following'
        }),
        Connection.findOne({
          followerId: currentUserId,
          followingId: targetUserId,
          status: 'blocked'
        })
      ]);

      isFollowing = !!followingConnection;
      isFollowedBy = !!followedByConnection;
      isBlocked = !!blockedConnection;
    }

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        stats: {
          followerCount,
          followingCount,
          postCount
        },
        relationship: {
          isFollowing,
          isFollowedBy,
          isBlocked
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    next(error);
  }
};

export const getConnectionStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;

    const [followerCount, followingCount, blockedCount] = await Promise.all([
      Connection.countDocuments({ followingId: userId, status: 'following' }),
      Connection.countDocuments({ followerId: userId, status: 'following' }),
      Connection.countDocuments({ followerId: userId, status: 'blocked' })
    ]);

    res.json({
      success: true,
      data: {
        followerCount,
        followingCount,
        blockedCount
      }
    });
  } catch (error) {
    logger.error('Error fetching connection stats:', error);
    next(error);
  }
};
