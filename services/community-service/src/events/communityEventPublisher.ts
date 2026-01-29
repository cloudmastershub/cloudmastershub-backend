import { createClient } from 'redis';
import logger from '../utils/logger';

export type CommunityEventType =
  | 'community.forum.created'
  | 'community.thread.created'
  | 'community.thread.replied'
  | 'community.post.created'
  | 'community.post.liked'
  | 'community.post.commented'
  | 'community.group.created'
  | 'community.group.joined'
  | 'community.group.left'
  | 'community.question.created'
  | 'community.question.answered'
  | 'community.answer.accepted'
  | 'community.connection.followed'
  | 'community.connection.unfollowed'
  | 'community.event.created'
  | 'community.event.registered'
  | 'community.event.cancelled';

export interface CommunityEvent {
  type: CommunityEventType;
  timestamp: Date;
  data: {
    userId?: string;
    targetUserId?: string;
    forumId?: string;
    threadId?: string;
    postId?: string;
    groupId?: string;
    questionId?: string;
    answerId?: string;
    eventId?: string;
    [key: string]: any;
  };
}

class CommunityEventPublisher {
  private static instance: CommunityEventPublisher;
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): CommunityEventPublisher {
    if (!CommunityEventPublisher.instance) {
      CommunityEventPublisher.instance = new CommunityEventPublisher();
    }
    return CommunityEventPublisher.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://redis.cloudmastershub-dev.svc.cluster.local:6379';

      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  public async publish(event: CommunityEvent): Promise<void> {
    if (!this.client || !this.isConnected) {
      logger.warn('Redis not connected, skipping event publish');
      return;
    }

    try {
      const channel = 'community-events';
      const message = JSON.stringify({
        ...event,
        timestamp: event.timestamp.toISOString()
      });

      await this.client.publish(channel, message);
      logger.debug(`Published event: ${event.type}`, { data: event.data });
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis client disconnected');
    }
  }
}

export const eventPublisher = CommunityEventPublisher.getInstance();

// Helper functions for common events
export const publishForumCreated = async (forumId: string, userId: string, name: string) => {
  await eventPublisher.publish({
    type: 'community.forum.created',
    timestamp: new Date(),
    data: { forumId, userId, name }
  });
};

export const publishThreadCreated = async (threadId: string, forumId: string, userId: string, title: string) => {
  await eventPublisher.publish({
    type: 'community.thread.created',
    timestamp: new Date(),
    data: { threadId, forumId, userId, title }
  });
};

export const publishThreadReplied = async (threadId: string, replyId: string, userId: string) => {
  await eventPublisher.publish({
    type: 'community.thread.replied',
    timestamp: new Date(),
    data: { threadId, replyId, userId }
  });
};

export const publishPostCreated = async (postId: string, userId: string, postType: string) => {
  await eventPublisher.publish({
    type: 'community.post.created',
    timestamp: new Date(),
    data: { postId, userId, postType }
  });
};

export const publishPostLiked = async (postId: string, userId: string, authorId: string) => {
  await eventPublisher.publish({
    type: 'community.post.liked',
    timestamp: new Date(),
    data: { postId, userId, targetUserId: authorId }
  });
};

export const publishGroupCreated = async (groupId: string, userId: string, name: string) => {
  await eventPublisher.publish({
    type: 'community.group.created',
    timestamp: new Date(),
    data: { groupId, userId, name }
  });
};

export const publishGroupJoined = async (groupId: string, userId: string) => {
  await eventPublisher.publish({
    type: 'community.group.joined',
    timestamp: new Date(),
    data: { groupId, userId }
  });
};

export const publishQuestionCreated = async (questionId: string, userId: string, title: string) => {
  await eventPublisher.publish({
    type: 'community.question.created',
    timestamp: new Date(),
    data: { questionId, userId, title }
  });
};

export const publishQuestionAnswered = async (questionId: string, answerId: string, userId: string) => {
  await eventPublisher.publish({
    type: 'community.question.answered',
    timestamp: new Date(),
    data: { questionId, answerId, userId }
  });
};

export const publishAnswerAccepted = async (questionId: string, answerId: string, authorId: string) => {
  await eventPublisher.publish({
    type: 'community.answer.accepted',
    timestamp: new Date(),
    data: { questionId, answerId, targetUserId: authorId }
  });
};

export const publishUserFollowed = async (followerId: string, followingId: string) => {
  await eventPublisher.publish({
    type: 'community.connection.followed',
    timestamp: new Date(),
    data: { userId: followerId, targetUserId: followingId }
  });
};

export const publishEventCreated = async (eventId: string, userId: string, title: string) => {
  await eventPublisher.publish({
    type: 'community.event.created',
    timestamp: new Date(),
    data: { eventId, userId, title }
  });
};

export const publishEventRegistered = async (eventId: string, userId: string) => {
  await eventPublisher.publish({
    type: 'community.event.registered',
    timestamp: new Date(),
    data: { eventId, userId }
  });
};
