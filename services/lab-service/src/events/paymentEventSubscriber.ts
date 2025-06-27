import { createClient } from 'redis';
import { PaymentEvent } from '@cloudmastershub/types';
import logger from '../utils/logger';

class LabPaymentEventSubscriber {
  private redisClient: any;
  private isConnected: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://redis:6379/2'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis client error in lab payment event subscriber:', err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Lab service payment event subscriber connected to Redis');
        this.isConnected = true;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Lab service payment event subscriber disconnected from Redis');
        this.isConnected = false;
      });

      await this.redisClient.connect();
      await this.subscribeToPaymentEvents();

    } catch (error) {
      logger.error('Failed to initialize Redis for lab payment events:', error);
    }
  }

  private async subscribeToPaymentEvents(): Promise<void> {
    try {
      const channels = [
        'payment:subscription.created',
        'payment:subscription.updated',
        'payment:subscription.cancelled',
        'payment:access.granted',
        'payment:access.revoked'
      ];

      for (const channel of channels) {
        await this.redisClient.subscribe(channel, (message: string) => {
          this.handlePaymentEvent(channel, message);
        });
      }

      logger.info('Lab service subscribed to payment events:', channels);

    } catch (error) {
      logger.error('Failed to subscribe to payment events in lab service:', error);
    }
  }

  private async handlePaymentEvent(channel: string, message: string): Promise<void> {
    try {
      const event: PaymentEvent = JSON.parse(message);
      
      logger.info('Lab service received payment event', {
        channel,
        eventType: event.type,
        userId: event.userId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        timestamp: event.timestamp
      });

      switch (event.type) {
        case 'payment.subscription.created':
          await this.handleSubscriptionCreated(event);
          break;
          
        case 'payment.subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;
          
        case 'payment.subscription.cancelled':
          await this.handleSubscriptionCancelled(event);
          break;
          
        case 'payment.access.granted':
          await this.handleAccessGranted(event);
          break;
          
        case 'payment.access.revoked':
          await this.handleAccessRevoked(event);
          break;
          
        default:
          logger.warn('Unknown payment event type in lab service:', event.type);
      }

    } catch (error) {
      logger.error('Error processing payment event in lab service:', {
        channel,
        message,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async handleSubscriptionCreated(event: PaymentEvent): Promise<void> {
    try {
      const { userId, metadata } = event;
      
      logger.info('Processing subscription created event in lab service', { 
        userId, 
        plan: metadata.planId || metadata.plan 
      });

      // Grant lab access based on subscription plan
      const plan = metadata.planId || metadata.plan;
      if (plan === 'premium' || plan === 'enterprise') {
        await this.updateUserLabQuota(userId, plan);
      }

    } catch (error) {
      logger.error('Error handling subscription created event in lab service:', error);
    }
  }

  private async handleSubscriptionUpdated(event: PaymentEvent): Promise<void> {
    try {
      const { userId, metadata } = event;
      
      logger.info('Processing subscription updated event in lab service', { 
        userId, 
        status: metadata.status,
        plan: metadata.planId || metadata.plan 
      });

      const status = metadata.status;
      const plan = metadata.planId || metadata.plan;

      if (status === 'active' && (plan === 'premium' || plan === 'enterprise')) {
        await this.updateUserLabQuota(userId, plan);
      } else if (status === 'cancelled' || status === 'past_due') {
        await this.revokeLabAccess(userId);
      }

    } catch (error) {
      logger.error('Error handling subscription updated event in lab service:', error);
    }
  }

  private async handleSubscriptionCancelled(event: PaymentEvent): Promise<void> {
    try {
      const { userId } = event;
      
      logger.info('Processing subscription cancelled event in lab service', { userId });

      // Revoke lab access and stop any running sessions
      await this.revokeLabAccess(userId);
      await this.stopUserLabSessions(userId);

    } catch (error) {
      logger.error('Error handling subscription cancelled event in lab service:', error);
    }
  }

  private async handleAccessGranted(event: PaymentEvent): Promise<void> {
    try {
      const { userId, resourceType, resourceId, metadata } = event;
      
      if (resourceType === 'lab' || resourceType === 'platform') {
        logger.info('Processing lab access granted event', { 
          userId, 
          resourceType, 
          resourceId,
          source: metadata.source
        });

        if (resourceType === 'lab' && resourceId) {
          await this.grantSpecificLabAccess(userId, resourceId, metadata.source || 'admin_grant');
        } else if (resourceType === 'platform') {
          await this.updateUserLabQuota(userId, metadata.plan || 'premium');
        }
      }

    } catch (error) {
      logger.error('Error handling access granted event in lab service:', error);
    }
  }

  private async handleAccessRevoked(event: PaymentEvent): Promise<void> {
    try {
      const { userId, resourceType, resourceId } = event;
      
      if (resourceType === 'lab' || resourceType === 'platform') {
        logger.info('Processing lab access revoked event', { 
          userId, 
          resourceType, 
          resourceId 
        });

        if (resourceType === 'lab' && resourceId) {
          await this.revokeSpecificLabAccess(userId, resourceId);
        } else if (resourceType === 'platform') {
          await this.revokeLabAccess(userId);
        }
      }

    } catch (error) {
      logger.error('Error handling access revoked event in lab service:', error);
    }
  }

  private async updateUserLabQuota(userId: string, plan: string): Promise<void> {
    try {
      // Define lab quotas based on subscription plan
      const labQuotas: Record<string, { maxLabs: number; maxDuration: number; concurrentLabs: number }> = {
        'free': { maxLabs: 2, maxDuration: 1800, concurrentLabs: 1 }, // 30 min, 1 concurrent
        'premium': { maxLabs: 20, maxDuration: 7200, concurrentLabs: 3 }, // 2 hours, 3 concurrent
        'enterprise': { maxLabs: -1, maxDuration: 14400, concurrentLabs: 10 } // 4 hours, 10 concurrent
      };

      const quota = labQuotas[plan] || labQuotas['free'];
      
      logger.info('Updating user lab quota', { 
        userId, 
        plan, 
        quota 
      });

      // Mock implementation - in production, this would update database
      // This would typically:
      // 1. Update user's lab quota in database
      // 2. Reset usage counters if upgrading
      // 3. Update Redis cache with new quotas
      // 4. Send notification about new lab access

      logger.info('User lab quota updated successfully', { 
        userId, 
        plan,
        maxLabs: quota.maxLabs,
        maxDuration: quota.maxDuration,
        concurrentLabs: quota.concurrentLabs
      });

    } catch (error) {
      logger.error('Error updating user lab quota:', error);
      throw error;
    }
  }

  private async revokeLabAccess(userId: string): Promise<void> {
    try {
      logger.info('Revoking lab access from user', { userId });

      // Mock implementation - in production, this would:
      // 1. Set user lab quota to free tier
      // 2. Stop any running premium lab sessions
      // 3. Update database permissions
      // 4. Clear Redis cache
      // 5. Send notification

      // Reset to free tier quota
      await this.updateUserLabQuota(userId, 'free');

      logger.info('Lab access revoked successfully', { userId });

    } catch (error) {
      logger.error('Error revoking lab access:', error);
      throw error;
    }
  }

  private async stopUserLabSessions(userId: string): Promise<void> {
    try {
      logger.info('Stopping all lab sessions for user', { userId });

      // Mock implementation - in production, this would:
      // 1. Find all active lab sessions for user
      // 2. Gracefully stop each session
      // 3. Save session data/progress
      // 4. Clean up cloud resources
      // 5. Update session status in database
      // 6. Send notifications

      logger.info('All lab sessions stopped for user', { userId });

    } catch (error) {
      logger.error('Error stopping user lab sessions:', error);
      throw error;
    }
  }

  private async grantSpecificLabAccess(userId: string, labId: string, source: string): Promise<void> {
    try {
      logger.info('Granting specific lab access to user', { userId, labId, source });

      // Mock implementation - in production, this would:
      // 1. Add lab-specific access permission
      // 2. Update user's available labs list
      // 3. Send welcome notification for the lab
      // 4. Log access grant for auditing

      logger.info('Specific lab access granted successfully', { userId, labId, source });

    } catch (error) {
      logger.error('Error granting specific lab access:', error);
      throw error;
    }
  }

  private async revokeSpecificLabAccess(userId: string, labId: string): Promise<void> {
    try {
      logger.info('Revoking specific lab access from user', { userId, labId });

      // Mock implementation - in production, this would:
      // 1. Remove lab-specific access permission
      // 2. Stop any running sessions for this lab
      // 3. Update user's available labs list
      // 4. Save any in-progress work
      // 5. Send notification

      logger.info('Specific lab access revoked successfully', { userId, labId });

    } catch (error) {
      logger.error('Error revoking specific lab access:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.redisClient && this.isConnected) {
        await this.redisClient.disconnect();
        logger.info('Lab service payment event subscriber disconnected from Redis');
      }
    } catch (error) {
      logger.error('Error disconnecting lab payment event subscriber:', error);
    }
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let labPaymentEventSubscriber: LabPaymentEventSubscriber | null = null;

export const initializeLabPaymentEventSubscriber = (): LabPaymentEventSubscriber => {
  if (!labPaymentEventSubscriber) {
    labPaymentEventSubscriber = new LabPaymentEventSubscriber();
  }
  return labPaymentEventSubscriber;
};

export const getLabPaymentEventSubscriber = (): LabPaymentEventSubscriber | null => {
  return labPaymentEventSubscriber;
};

export default LabPaymentEventSubscriber;