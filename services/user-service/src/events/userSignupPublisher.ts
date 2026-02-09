import { createClient } from 'redis';
import logger from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379/0';
const CHANNEL = 'user.signed_up';

/**
 * Publishes user signup events to Redis for consumption by the marketing service.
 * Uses a dedicated Redis client (separate from the subscriber used by PaymentEventSubscriber).
 */
class UserSignupPublisher {
  private client: ReturnType<typeof createClient> | null = null;
  private isConnected = false;

  async initialize(): Promise<void> {
    this.client = createClient({ url: REDIS_URL });

    this.client.on('error', (err) => {
      logger.error('UserSignupPublisher Redis error', { error: err.message });
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
    });

    await this.client.connect();
    logger.info('UserSignupPublisher initialized');
  }

  async publish(userId: string, email: string, firstName: string, lastName: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      logger.warn('UserSignupPublisher not connected, skipping event', { userId, email });
      return;
    }

    const payload = JSON.stringify({
      tenantId: 'cloudmastershub',
      user_id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      timestamp: new Date().toISOString(),
    });

    const receivers = await this.client.publish(CHANNEL, payload);
    logger.info('Published user.signed_up event', { userId, email, receivers });
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('UserSignupPublisher shutdown complete');
    }
  }
}

export const userSignupPublisher = new UserSignupPublisher();
