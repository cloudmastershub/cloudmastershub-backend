import { createClient } from 'redis';
import { PaymentEvent } from '@cloudmastershub/types';
import logger from '../utils/logger';

class CoursePaymentEventSubscriber {
  private redisClient: any;
  private isConnected: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://redis:6379/1'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis client error in course payment event subscriber:', err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Course service payment event subscriber connected to Redis');
        this.isConnected = true;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Course service payment event subscriber disconnected from Redis');
        this.isConnected = false;
      });

      await this.redisClient.connect();
      await this.subscribeToPaymentEvents();

    } catch (error) {
      logger.error('Failed to initialize Redis for course payment events:', error);
    }
  }

  private async subscribeToPaymentEvents(): Promise<void> {
    try {
      const channels = [
        'payment:subscription.created',
        'payment:subscription.updated',
        'payment:subscription.cancelled',
        'payment:purchase.completed',
        'payment:access.granted',
        'payment:access.revoked'
      ];

      for (const channel of channels) {
        await this.redisClient.subscribe(channel, (message: string) => {
          this.handlePaymentEvent(channel, message);
        });
      }

      logger.info('Course service subscribed to payment events:', channels);

    } catch (error) {
      logger.error('Failed to subscribe to payment events in course service:', error);
    }
  }

  private async handlePaymentEvent(channel: string, message: string): Promise<void> {
    try {
      const event: PaymentEvent = JSON.parse(message);
      
      logger.info('Course service received payment event', {
        channel,
        eventType: event.type,
        userId: event.userId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        timestamp: event.timestamp
      });

      switch (event.type) {
        case 'subscription.created':
          await this.handleSubscriptionCreated(event);
          break;
          
        case 'subscription.updated':
          await this.handleSubscriptionUpdated(event);
          break;
          
        case 'subscription.cancelled':
          await this.handleSubscriptionCancelled(event);
          break;
          
        case 'purchase.completed':
          await this.handlePurchaseCompleted(event);
          break;
          
        case 'access.granted':
          await this.handleAccessGranted(event);
          break;
          
        case 'access.revoked':
          await this.handleAccessRevoked(event);
          break;
          
        default:
          logger.warn('Unknown payment event type in course service:', event.type);
      }

    } catch (error) {
      logger.error('Error processing payment event in course service:', {
        channel,
        message,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async handleSubscriptionCreated(event: PaymentEvent): Promise<void> {
    try {
      const { userId, metadata } = event;
      
      logger.info('Processing subscription created event in course service', { 
        userId, 
        plan: metadata.planId || metadata.plan 
      });

      // Grant access to all courses based on subscription plan
      const plan = metadata.planId || metadata.plan;
      if (plan === 'premium' || plan === 'enterprise') {
        await this.grantPlatformAccess(userId, plan);
      }

    } catch (error) {
      logger.error('Error handling subscription created event in course service:', error);
    }
  }

  private async handleSubscriptionUpdated(event: PaymentEvent): Promise<void> {
    try {
      const { userId, metadata } = event;
      
      logger.info('Processing subscription updated event in course service', { 
        userId, 
        status: metadata.status,
        plan: metadata.planId || metadata.plan 
      });

      const status = metadata.status;
      const plan = metadata.planId || metadata.plan;

      if (status === 'active' && (plan === 'premium' || plan === 'enterprise')) {
        await this.grantPlatformAccess(userId, plan);
      } else if (status === 'cancelled' || status === 'past_due') {
        await this.revokePlatformAccess(userId);
      }

    } catch (error) {
      logger.error('Error handling subscription updated event in course service:', error);
    }
  }

  private async handleSubscriptionCancelled(event: PaymentEvent): Promise<void> {
    try {
      const { userId } = event;
      
      logger.info('Processing subscription cancelled event in course service', { userId });

      // Revoke access to premium courses
      await this.revokePlatformAccess(userId);

    } catch (error) {
      logger.error('Error handling subscription cancelled event in course service:', error);
    }
  }

  private async handlePurchaseCompleted(event: PaymentEvent): Promise<void> {
    try {
      const { userId, resourceType, resourceId, metadata } = event;
      
      if (resourceType === 'course') {
        logger.info('Processing course purchase completed event', { 
          userId, 
          courseId: resourceId,
          purchaseId: metadata.purchaseId
        });

        await this.grantCourseAccess(userId, resourceId!, 'purchase');
      } else if (resourceType === 'learning_path') {
        logger.info('Processing learning path purchase completed event', { 
          userId, 
          pathId: resourceId,
          purchaseId: metadata.purchaseId
        });

        await this.grantLearningPathAccess(userId, resourceId!, 'purchase');
      }

    } catch (error) {
      logger.error('Error handling purchase completed event in course service:', error);
    }
  }

  private async handleAccessGranted(event: PaymentEvent): Promise<void> {
    try {
      const { userId, resourceType, resourceId, metadata } = event;
      
      logger.info('Processing access granted event in course service', { 
        userId, 
        resourceType, 
        resourceId,
        source: metadata.source
      });

      if (resourceType === 'course') {
        await this.grantCourseAccess(userId, resourceId!, metadata.source || 'admin_grant');
      } else if (resourceType === 'learning_path') {
        await this.grantLearningPathAccess(userId, resourceId!, metadata.source || 'admin_grant');
      }

    } catch (error) {
      logger.error('Error handling access granted event in course service:', error);
    }
  }

  private async handleAccessRevoked(event: PaymentEvent): Promise<void> {
    try {
      const { userId, resourceType, resourceId } = event;
      
      logger.info('Processing access revoked event in course service', { 
        userId, 
        resourceType, 
        resourceId 
      });

      if (resourceType === 'course') {
        await this.revokeCourseAccess(userId, resourceId!);
      } else if (resourceType === 'learning_path') {
        await this.revokeLearningPathAccess(userId, resourceId!);
      } else if (resourceType === 'platform') {
        await this.revokePlatformAccess(userId);
      }

    } catch (error) {
      logger.error('Error handling access revoked event in course service:', error);
    }
  }

  private async grantPlatformAccess(userId: string, plan: string): Promise<void> {
    try {
      // Mock implementation - in production, this would update database
      logger.info('Granting platform access to user', { userId, plan });

      // This would typically:
      // 1. Update user's enrollment status for all premium courses
      // 2. Grant access to premium learning paths
      // 3. Update user's access permissions in the database
      // 4. Invalidate any cached user permissions

      // For now, we'll just log the action
      logger.info('Platform access granted successfully', { userId, plan });

    } catch (error) {
      logger.error('Error granting platform access:', error);
      throw error;
    }
  }

  private async revokePlatformAccess(userId: string): Promise<void> {
    try {
      // Mock implementation - in production, this would update database
      logger.info('Revoking platform access from user', { userId });

      // This would typically:
      // 1. Remove user's enrollment from premium courses
      // 2. Revoke access to premium learning paths
      // 3. Update user's access permissions in the database
      // 4. Invalidate any cached user permissions

      // For now, we'll just log the action
      logger.info('Platform access revoked successfully', { userId });

    } catch (error) {
      logger.error('Error revoking platform access:', error);
      throw error;
    }
  }

  private async grantCourseAccess(userId: string, courseId: string, source: string): Promise<void> {
    try {
      logger.info('Granting course access to user', { userId, courseId, source });

      // Mock implementation - in production, this would:
      // 1. Add user enrollment record
      // 2. Update course access permissions
      // 3. Send welcome email or notification
      // 4. Update analytics

      logger.info('Course access granted successfully', { userId, courseId, source });

    } catch (error) {
      logger.error('Error granting course access:', error);
      throw error;
    }
  }

  private async revokeCourseAccess(userId: string, courseId: string): Promise<void> {
    try {
      logger.info('Revoking course access from user', { userId, courseId });

      // Mock implementation - in production, this would:
      // 1. Remove user enrollment record
      // 2. Update course access permissions
      // 3. Save user progress before removal
      // 4. Send notification

      logger.info('Course access revoked successfully', { userId, courseId });

    } catch (error) {
      logger.error('Error revoking course access:', error);
      throw error;
    }
  }

  private async grantLearningPathAccess(userId: string, pathId: string, source: string): Promise<void> {
    try {
      logger.info('Granting learning path access to user', { userId, pathId, source });

      // Mock implementation - in production, this would:
      // 1. Add user enrollment to learning path
      // 2. Grant access to all courses in the path
      // 3. Set up progress tracking
      // 4. Send welcome email

      logger.info('Learning path access granted successfully', { userId, pathId, source });

    } catch (error) {
      logger.error('Error granting learning path access:', error);
      throw error;
    }
  }

  private async revokeLearningPathAccess(userId: string, pathId: string): Promise<void> {
    try {
      logger.info('Revoking learning path access from user', { userId, pathId });

      // Mock implementation - in production, this would:
      // 1. Remove user enrollment from learning path
      // 2. Revoke access to path-specific courses
      // 3. Save progress data
      // 4. Send notification

      logger.info('Learning path access revoked successfully', { userId, pathId });

    } catch (error) {
      logger.error('Error revoking learning path access:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.redisClient && this.isConnected) {
        await this.redisClient.disconnect();
        logger.info('Course service payment event subscriber disconnected from Redis');
      }
    } catch (error) {
      logger.error('Error disconnecting course payment event subscriber:', error);
    }
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let coursePaymentEventSubscriber: CoursePaymentEventSubscriber | null = null;

export const initializeCoursePaymentEventSubscriber = (): CoursePaymentEventSubscriber => {
  if (!coursePaymentEventSubscriber) {
    coursePaymentEventSubscriber = new CoursePaymentEventSubscriber();
  }
  return coursePaymentEventSubscriber;
};

export const getCoursePaymentEventSubscriber = (): CoursePaymentEventSubscriber | null => {
  return coursePaymentEventSubscriber;
};

export default CoursePaymentEventSubscriber;