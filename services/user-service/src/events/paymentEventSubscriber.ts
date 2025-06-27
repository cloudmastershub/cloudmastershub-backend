import { createClient } from 'redis';
import { PaymentEvent } from '@cloudmastershub/types';
import logger from '../utils/logger';
import { getUserById, updateUserSubscriptionStatus } from '../services/userService';

class PaymentEventSubscriber {
  private redisClient: any;
  private isConnected: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://redis:6379/0'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis client error in payment event subscriber:', err);
      });

      this.redisClient.on('connect', () => {
        logger.info('Payment event subscriber connected to Redis');
        this.isConnected = true;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Payment event subscriber disconnected from Redis');
        this.isConnected = false;
      });

      await this.redisClient.connect();
      await this.subscribeToPaymentEvents();

    } catch (error) {
      logger.error('Failed to initialize Redis for payment events:', error);
    }
  }

  private async subscribeToPaymentEvents(): Promise<void> {
    try {
      const channels = [
        'payment:subscription.created',
        'payment:subscription.updated', 
        'payment:subscription.cancelled',
        'payment:purchase.completed',
        'payment:payment.succeeded',
        'payment:payment.failed'
      ];

      for (const channel of channels) {
        await this.redisClient.subscribe(channel, (message: string) => {
          this.handlePaymentEvent(channel, message);
        });
      }

      logger.info('Subscribed to payment events:', channels);

    } catch (error) {
      logger.error('Failed to subscribe to payment events:', error);
    }
  }

  private async handlePaymentEvent(channel: string, message: string): Promise<void> {
    try {
      const event: PaymentEvent = JSON.parse(message);
      
      logger.info('Received payment event', {
        channel,
        eventType: event.type,
        userId: event.userId,
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
          
        case 'payment.purchase.completed':
          await this.handlePurchaseCompleted(event);
          break;
          
        case 'payment.payment.succeeded':
          await this.handlePaymentSucceeded(event);
          break;
          
        case 'payment.payment.failed':
          await this.handlePaymentFailed(event);
          break;
          
        default:
          logger.warn('Unknown payment event type:', event.type);
      }

    } catch (error) {
      logger.error('Error processing payment event:', {
        channel,
        message,
        error: error instanceof Error ? error.message : error
      });
    }
  }

  private async handleSubscriptionCreated(event: PaymentEvent): Promise<void> {
    try {
      const { userId, subscriptionId, metadata } = event;
      
      logger.info('Processing subscription created event', { userId, subscriptionId });

      // Update user's subscription status
      const updateData = {
        subscriptionId,
        subscriptionStatus: 'active',
        subscriptionPlan: metadata.planId || metadata.plan,
        subscriptionStartDate: new Date(event.timestamp),
        subscriptionEndDate: metadata.expiresAt ? new Date(metadata.expiresAt) : undefined,
        lastPaymentDate: new Date(event.timestamp)
      };

      await updateUserSubscriptionStatus(userId, updateData);

      logger.info('User subscription status updated for subscription created', { 
        userId, 
        subscriptionId,
        plan: updateData.subscriptionPlan
      });

    } catch (error) {
      logger.error('Error handling subscription created event:', error);
    }
  }

  private async handleSubscriptionUpdated(event: PaymentEvent): Promise<void> {
    try {
      const { userId, subscriptionId, metadata } = event;
      
      logger.info('Processing subscription updated event', { userId, subscriptionId });

      const updateData: any = {
        subscriptionStatus: metadata.status || 'active',
        updatedAt: new Date(event.timestamp)
      };

      // Update plan if changed
      if (metadata.planId || metadata.plan) {
        updateData.subscriptionPlan = metadata.planId || metadata.plan;
      }

      // Update expiration date if provided
      if (metadata.expiresAt) {
        updateData.subscriptionEndDate = new Date(metadata.expiresAt);
      }

      await updateUserSubscriptionStatus(userId, updateData);

      logger.info('User subscription status updated for subscription updated', { 
        userId, 
        subscriptionId,
        status: updateData.subscriptionStatus
      });

    } catch (error) {
      logger.error('Error handling subscription updated event:', error);
    }
  }

  private async handleSubscriptionCancelled(event: PaymentEvent): Promise<void> {
    try {
      const { userId, subscriptionId, metadata } = event;
      
      logger.info('Processing subscription cancelled event', { userId, subscriptionId });

      const updateData = {
        subscriptionStatus: 'cancelled',
        subscriptionEndDate: metadata.cancelledAt ? new Date(metadata.cancelledAt) : new Date(event.timestamp),
        cancelledAt: new Date(event.timestamp),
        updatedAt: new Date(event.timestamp)
      };

      await updateUserSubscriptionStatus(userId, updateData);

      logger.info('User subscription status updated for subscription cancelled', { 
        userId, 
        subscriptionId
      });

    } catch (error) {
      logger.error('Error handling subscription cancelled event:', error);
    }
  }

  private async handlePurchaseCompleted(event: PaymentEvent): Promise<void> {
    try {
      const { userId, metadata } = event;
      
      logger.info('Processing purchase completed event', { 
        userId, 
        purchaseType: metadata.purchaseType,
        purchaseId: metadata.purchaseId
      });

      // For individual purchases, we might want to track purchase history
      // This could be extended to update user's access permissions
      const updateData = {
        lastPurchaseDate: new Date(event.timestamp),
        totalPurchases: metadata.totalPurchases || 1,
        updatedAt: new Date(event.timestamp)
      };

      await updateUserSubscriptionStatus(userId, updateData);

      logger.info('User purchase history updated', { 
        userId,
        purchaseType: metadata.purchaseType,
        purchaseId: metadata.purchaseId
      });

    } catch (error) {
      logger.error('Error handling purchase completed event:', error);
    }
  }

  private async handlePaymentSucceeded(event: PaymentEvent): Promise<void> {
    try {
      const { userId, subscriptionId, metadata } = event;
      
      logger.info('Processing payment succeeded event', { userId, subscriptionId });

      const updateData: any = {
        lastPaymentDate: new Date(event.timestamp),
        paymentStatus: 'current',
        updatedAt: new Date(event.timestamp)
      };

      // If subscription was past due, reactivate it
      if (metadata.previousStatus === 'past_due') {
        updateData.subscriptionStatus = 'active';
      }

      await updateUserSubscriptionStatus(userId, updateData);

      logger.info('User payment status updated for successful payment', { 
        userId, 
        subscriptionId
      });

    } catch (error) {
      logger.error('Error handling payment succeeded event:', error);
    }
  }

  private async handlePaymentFailed(event: PaymentEvent): Promise<void> {
    try {
      const { userId, subscriptionId, metadata } = event;
      
      logger.warn('Processing payment failed event', { userId, subscriptionId });

      const updateData: any = {
        paymentStatus: 'past_due',
        lastPaymentAttempt: new Date(event.timestamp),
        failedPaymentCount: (metadata.failedPaymentCount || 0) + 1,
        updatedAt: new Date(event.timestamp)
      };

      // If too many failed attempts, mark subscription as past due
      if (updateData.failedPaymentCount >= 3) {
        updateData.subscriptionStatus = 'past_due';
      }

      await updateUserSubscriptionStatus(userId, updateData);

      logger.warn('User payment status updated for failed payment', { 
        userId, 
        subscriptionId,
        failedCount: updateData.failedPaymentCount
      });

    } catch (error) {
      logger.error('Error handling payment failed event:', error);
    }
  }

  public async disconnect(): Promise<void> {
    try {
      if (this.redisClient && this.isConnected) {
        await this.redisClient.disconnect();
        logger.info('Payment event subscriber disconnected from Redis');
      }
    } catch (error) {
      logger.error('Error disconnecting payment event subscriber:', error);
    }
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let paymentEventSubscriber: PaymentEventSubscriber | null = null;

export const initializePaymentEventSubscriber = (): PaymentEventSubscriber => {
  if (!paymentEventSubscriber) {
    paymentEventSubscriber = new PaymentEventSubscriber();
  }
  return paymentEventSubscriber;
};

export const getPaymentEventSubscriber = (): PaymentEventSubscriber | null => {
  return paymentEventSubscriber;
};

export default PaymentEventSubscriber;