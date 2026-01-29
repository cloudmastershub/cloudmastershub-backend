import { createClient } from 'redis';
import logger from '../utils/logger';

interface UserEvent {
  type: string;
  timestamp: string;
  data: {
    userId?: string;
    email?: string;
    [key: string]: any;
  };
}

class UserEventSubscriber {
  private static instance: UserEventSubscriber;
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): UserEventSubscriber {
    if (!UserEventSubscriber.instance) {
      UserEventSubscriber.instance = new UserEventSubscriber();
    }
    return UserEventSubscriber.instance;
  }

  public async subscribe(): Promise<void> {
    if (this.isConnected) return;

    try {
      const redisUrl = process.env.REDIS_URL || 'redis://redis.cloudmastershub-dev.svc.cluster.local:6379';

      this.client = createClient({ url: redisUrl });

      this.client.on('error', (err) => {
        logger.error('Redis subscriber error:', err);
        this.isConnected = false;
      });

      await this.client.connect();
      this.isConnected = true;

      await this.client.subscribe('user-events', (message) => {
        this.handleUserEvent(message);
      });

      logger.info('Subscribed to user-events channel');
    } catch (error) {
      logger.error('Failed to subscribe to user events:', error);
      this.isConnected = false;
    }
  }

  private async handleUserEvent(message: string): Promise<void> {
    try {
      const event: UserEvent = JSON.parse(message);
      logger.debug(`Received user event: ${event.type}`, { data: event.data });

      switch (event.type) {
        case 'user.deleted':
          await this.handleUserDeleted(event.data.userId);
          break;
        case 'user.profile.updated':
          await this.handleUserProfileUpdated(event.data);
          break;
        default:
          logger.debug(`Unhandled user event type: ${event.type}`);
      }
    } catch (error) {
      logger.error('Error handling user event:', error);
    }
  }

  private async handleUserDeleted(userId?: string): Promise<void> {
    if (!userId) return;

    logger.info(`Handling user deletion for userId: ${userId}`);
    // In a real implementation, you would:
    // - Anonymize or delete user's posts
    // - Remove user from groups
    // - Clean up connections
    // - etc.
  }

  private async handleUserProfileUpdated(data: any): Promise<void> {
    const { userId, firstName, lastName, avatar } = data;
    if (!userId) return;

    logger.info(`Handling profile update for userId: ${userId}`);
    // In a real implementation, you would:
    // - Update author name/avatar on posts
    // - Update member info in groups
    // - Update connection records
    // - etc.
  }

  public async unsubscribe(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.unsubscribe('user-events');
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Unsubscribed from user-events channel');
    }
  }
}

export const userEventSubscriber = UserEventSubscriber.getInstance();

export const initializeUserEventSubscriber = async (): Promise<void> => {
  try {
    await userEventSubscriber.subscribe();
  } catch (error) {
    logger.error('Failed to initialize user event subscriber:', error);
  }
};
