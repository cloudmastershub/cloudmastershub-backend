import { createClient, RedisClientType } from 'redis';
import {
  CloudMastersEvent,
  EventEnvelope,
  EventHandler,
  EventPublisher,
  EventSubscriber,
  EventPriority,
  EventConfig,
  EventMetrics,
} from '@cloudmastershub/types';
import logger from './logger';
import { getEventValidator, ValidationResult } from './eventValidation';
import { RedisEventStore } from './eventReplay';

export class EventBus implements EventPublisher, EventSubscriber {
  private publishClient: RedisClientType;
  private subscribeClient: RedisClientType;
  private config: EventConfig;
  private handlers: Map<string, EventHandler[]> = new Map();
  private metrics: Map<string, EventMetrics> = new Map();
  private isConnected: boolean = false;
  private eventValidator = getEventValidator();
  private eventStore?: RedisEventStore;

  constructor(config: EventConfig) {
    this.config = config;
    this.publishClient = createClient({ url: config.redisUrl }) as RedisClientType;
    this.subscribeClient = createClient({ url: config.redisUrl }) as RedisClientType;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Setup error handlers with reconnection
      this.publishClient.on('error', (err) => {
        logger.error('Event bus publish client error:', err);
        this.handleConnectionError('publish', err);
      });

      this.subscribeClient.on('error', (err) => {
        logger.error('Event bus subscribe client error:', err);
        this.handleConnectionError('subscribe', err);
      });

      // Handle disconnection
      this.publishClient.on('disconnect', () => {
        logger.warn('Event bus publish client disconnected');
        this.isConnected = false;
        this.scheduleReconnection();
      });

      this.subscribeClient.on('disconnect', () => {
        logger.warn('Event bus subscribe client disconnected');
        this.isConnected = false;
        this.scheduleReconnection();
      });

      // Connect clients
      await Promise.all([this.publishClient.connect(), this.subscribeClient.connect()]);

      this.isConnected = true;
      logger.info('Event bus connected to Redis', {
        serviceName: this.config.serviceName,
        environment: this.config.environment,
      });

      // Setup metrics collection if enabled
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      // Initialize event store if enabled
      if (this.config.enableEventStore) {
        this.eventStore = new RedisEventStore(this.publishClient, 'cloudmasters:events');
      }
    } catch (error) {
      logger.error('Failed to initialize event bus:', error);
      throw error;
    }
  }

  async publish(
    event: CloudMastersEvent,
    options?: {
      priority?: EventPriority;
      delay?: number;
      retries?: number;
      expiration?: Date;
    }
  ): Promise<void> {
    if (!this.isConnected) {
      // Log warning but don't throw error - graceful degradation
      logger.warn('Event bus not connected, skipping event publication', {
        eventType: event.type,
        eventId: event.id,
        source: event.source
      });
      return;
    }

    try {
      // Validate event schema
      if (this.config.enableValidation !== false) {
        const validationResult = this.eventValidator.validate(event);
        if (!validationResult.isValid) {
          throw new Error(`Event validation failed: ${validationResult.errors.join(', ')}`);
        }
      }

      // Create event envelope
      const envelope: EventEnvelope = {
        event,
        priority: options?.priority || EventPriority.MEDIUM,
        retryCount: 0,
        maxRetries: options?.retries || this.config.maxRetries,
        delayMs: options?.delay || 0,
        expiresAt: options?.expiration,
        headers: {
          'x-service': this.config.serviceName,
          'x-environment': this.config.environment,
          'x-published-at': new Date().toISOString(),
        },
      };

      // Determine channel based on event type
      const channel = this.getChannelForEvent(event);

      // Publish event
      const message = JSON.stringify(envelope);

      if (options?.delay && options.delay > 0) {
        // Delayed publishing (could use Redis keyspace notifications or Bull queue)
        setTimeout(async () => {
          await this.publishClient.publish(channel, message);
        }, options.delay);
      } else {
        await this.publishClient.publish(channel, message);
      }

      // Store event if event store is enabled
      if (this.config.enableEventStore && this.eventStore) {
        await this.eventStore.save(event);
      }

      // Update metrics
      this.updateMetrics(event.type, 'published');

      logger.debug('Event published', {
        eventId: event.id,
        eventType: event.type,
        channel,
        priority: envelope.priority,
        delay: options?.delay || 0,
      });
    } catch (error) {
      logger.error('Failed to publish event:', {
        eventId: event.id,
        eventType: event.type,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async subscribe(eventType: string | string[], handler: EventHandler): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Event bus is not connected');
    }

    try {
      const eventTypes = Array.isArray(eventType) ? eventType : [eventType];

      for (const type of eventTypes) {
        // Add handler to registry
        if (!this.handlers.has(type)) {
          this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);

        // Subscribe to Redis channel
        const channel = this.getChannelForEventType(type);
        await this.subscribeClient.subscribe(channel, (message) => {
          this.handleIncomingMessage(message, type, handler);
        });

        logger.info('Subscribed to event type', {
          eventType: type,
          channel,
          handlerName: handler.constructor.name,
        });
      }
    } catch (error) {
      logger.error('Failed to subscribe to event:', {
        eventType: Array.isArray(eventType) ? eventType.join(', ') : eventType,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  async unsubscribe(eventType: string, handler: EventHandler): Promise<void> {
    try {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
          if (handlers.length === 0) {
            this.handlers.delete(eventType);
            const channel = this.getChannelForEventType(eventType);
            await this.subscribeClient.unsubscribe(channel);
          }
        }
      }

      logger.info('Unsubscribed from event type', {
        eventType,
        handlerName: handler.constructor.name,
      });
    } catch (error) {
      logger.error('Failed to unsubscribe from event:', {
        eventType,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  private async handleIncomingMessage(
    message: string,
    eventType: string,
    handler: EventHandler
  ): Promise<void> {
    let envelope: EventEnvelope;

    try {
      envelope = JSON.parse(message);
      const event = envelope.event;

      // Check if event is expired
      if (envelope.expiresAt && new Date() > envelope.expiresAt) {
        logger.warn('Event expired, skipping processing', {
          eventId: event.id,
          eventType: event.type,
          expiresAt: envelope.expiresAt,
        });
        return;
      }

      // Update metrics
      this.updateMetrics(event.type, 'received');

      const startTime = Date.now();

      // Process event with timeout
      await Promise.race([
        handler.handle(event, envelope),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Handler timeout')), this.config.defaultTimeout)
        ),
      ]);

      const processingTime = Date.now() - startTime;
      this.updateMetrics(event.type, 'processed', processingTime);

      logger.debug('Event processed successfully', {
        eventId: event.id,
        eventType: event.type,
        processingTime,
        retryCount: envelope.retryCount,
      });
    } catch (error) {
      logger.error('Failed to process event:', {
        eventType,
        error: error instanceof Error ? error.message : error,
        message: message.substring(0, 500), // Truncate for logging
      });

      try {
        if (envelope!) {
          await this.handleEventError(error as Error, envelope.event, envelope, handler);
        }
      } catch (errorHandlingError) {
        logger.error('Failed to handle event error:', errorHandlingError);
      }

      this.updateMetrics(eventType, 'failed');
    }
  }

  private async handleEventError(
    error: Error,
    event: CloudMastersEvent,
    envelope: EventEnvelope,
    handler: EventHandler
  ): Promise<void> {
    // Call handler's error callback if available
    if (handler.onError) {
      try {
        await handler.onError(error, event, envelope);
      } catch (onErrorError) {
        logger.error('Handler onError callback failed:', onErrorError);
      }
    }

    // Retry logic
    if (envelope.retryCount < envelope.maxRetries) {
      envelope.retryCount++;
      envelope.delayMs = Math.min(envelope.delayMs * 2 || 1000, 30000); // Exponential backoff

      logger.info('Retrying event processing', {
        eventId: event.id,
        eventType: event.type,
        retryCount: envelope.retryCount,
        maxRetries: envelope.maxRetries,
        delayMs: envelope.delayMs,
      });

      // Republish with delay
      setTimeout(async () => {
        const channel = this.getChannelForEvent(event);
        const message = JSON.stringify(envelope);
        await this.publishClient.publish(channel, message);
      }, envelope.delayMs);

      this.updateMetrics(event.type, 'retried');
    } else if (this.config.enableDeadLetterQueue) {
      // Send to dead letter queue
      await this.sendToDeadLetterQueue(event, envelope, error);
    }
  }

  private async sendToDeadLetterQueue(
    event: CloudMastersEvent,
    envelope: EventEnvelope,
    error: Error
  ): Promise<void> {
    try {
      const dlqChannel = `dlq:${this.getChannelForEvent(event)}`;
      const dlqMessage = JSON.stringify({
        originalEvent: event,
        originalEnvelope: envelope,
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
        failedAt: new Date().toISOString(),
      });

      await this.publishClient.publish(dlqChannel, dlqMessage);

      logger.warn('Event sent to dead letter queue', {
        eventId: event.id,
        eventType: event.type,
        dlqChannel,
        error: error.message,
      });
    } catch (dlqError) {
      logger.error('Failed to send event to dead letter queue:', dlqError);
    }
  }

  private getChannelForEvent(event: CloudMastersEvent): string {
    const eventType = event.type;

    if (eventType.startsWith('payment.')) return this.config.channels.payment;
    if (eventType.startsWith('user.')) return this.config.channels.user;
    if (eventType.startsWith('course.')) return this.config.channels.course;
    if (eventType.startsWith('path.')) return this.config.channels.course;
    if (eventType.startsWith('lab.')) return this.config.channels.lab;
    if (eventType.startsWith('admin.')) return this.config.channels.admin;
    if (eventType.startsWith('system.')) return this.config.channels.system;

    return 'events:general';
  }

  private getChannelForEventType(eventType: string): string {
    if (eventType.startsWith('payment.')) return this.config.channels.payment;
    if (eventType.startsWith('user.')) return this.config.channels.user;
    if (eventType.startsWith('course.') || eventType.startsWith('path.'))
      return this.config.channels.course;
    if (eventType.startsWith('lab.')) return this.config.channels.lab;
    if (eventType.startsWith('admin.')) return this.config.channels.admin;
    if (eventType.startsWith('system.')) return this.config.channels.system;

    return 'events:general';
  }

  /**
   * Get event store instance (for replay functionality)
   */
  getEventStore(): RedisEventStore | undefined {
    return this.eventStore;
  }

  /**
   * Validate an event manually
   */
  validateEvent(event: CloudMastersEvent): ValidationResult {
    return this.eventValidator.validate(event);
  }

  private updateMetrics(
    eventType: string,
    operation: 'published' | 'received' | 'processed' | 'failed' | 'retried',
    processingTime?: number
  ): void {
    if (!this.config.enableMetrics) return;

    let metrics = this.metrics.get(eventType);
    if (!metrics) {
      metrics = {
        eventCount: 0,
        processingTime: 0,
        errorCount: 0,
        retryCount: 0,
        lastProcessed: new Date(),
        averageProcessingTime: 0,
        successRate: 0,
      };
      this.metrics.set(eventType, metrics);
    }

    switch (operation) {
      case 'published':
      case 'received':
        metrics.eventCount++;
        break;
      case 'processed':
        if (processingTime) {
          metrics.processingTime += processingTime;
          metrics.averageProcessingTime = metrics.processingTime / metrics.eventCount;
        }
        metrics.lastProcessed = new Date();
        break;
      case 'failed':
        metrics.errorCount++;
        break;
      case 'retried':
        metrics.retryCount++;
        break;
    }

    // Calculate success rate
    const totalProcessed = metrics.eventCount - metrics.retryCount;
    if (totalProcessed > 0) {
      metrics.successRate = ((totalProcessed - metrics.errorCount) / totalProcessed) * 100;
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      if (this.metrics.size > 0) {
        logger.info('Event bus metrics', {
          serviceName: this.config.serviceName,
          metrics: Object.fromEntries(this.metrics),
        });
      }
    }, 60000); // Log metrics every minute
  }

  async getMetrics(): Promise<Map<string, EventMetrics>> {
    return new Map(this.metrics);
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all([this.publishClient.disconnect(), this.subscribeClient.disconnect()]);
      this.isConnected = false;
      logger.info('Event bus disconnected');
    } catch (error) {
      logger.error('Error disconnecting event bus:', error);
    }
  }

  private handleConnectionError(clientType: 'publish' | 'subscribe', error: any): void {
    logger.error(`Event bus ${clientType} client error:`, error);
    this.isConnected = false;
    this.scheduleReconnection();
  }

  private reconnectionTimeout: NodeJS.Timeout | null = null;
  private reconnectionAttempts = 0;
  private maxReconnectionAttempts = 10;

  private scheduleReconnection(): void {
    if (this.reconnectionTimeout) {
      return; // Already scheduled
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectionAttempts), 30000); // Max 30s
    this.reconnectionTimeout = setTimeout(() => {
      this.attemptReconnection();
    }, delay);

    logger.info(`Scheduling reconnection attempt ${this.reconnectionAttempts + 1} in ${delay}ms`);
  }

  private async attemptReconnection(): Promise<void> {
    this.reconnectionTimeout = null;
    this.reconnectionAttempts++;

    if (this.reconnectionAttempts > this.maxReconnectionAttempts) {
      logger.error('Max reconnection attempts reached, giving up');
      return;
    }

    try {
      logger.info(`Attempting to reconnect event bus (attempt ${this.reconnectionAttempts})`);
      
      // Try to reconnect both clients
      await Promise.all([
        this.publishClient.connect(),
        this.subscribeClient.connect()
      ]);

      this.isConnected = true;
      this.reconnectionAttempts = 0; // Reset on success
      
      logger.info('Event bus reconnected successfully');
    } catch (error) {
      logger.error('Reconnection attempt failed:', error);
      this.scheduleReconnection(); // Try again
    }
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}

// Factory function to create event bus instance
export const createEventBus = (config: Partial<EventConfig>): EventBus => {
  const defaultConfig: EventConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
    serviceName: process.env.SERVICE_NAME || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    maxRetries: 3,
    defaultTimeout: 30000,
    enableEventStore: true,
    enableMetrics: true,
    enableDeadLetterQueue: true,
    enableValidation: true,
    channels: {
      payment: 'events:payment',
      user: 'events:user',
      course: 'events:course',
      lab: 'events:lab',
      admin: 'events:admin',
      system: 'events:system',
    },
  };

  return new EventBus({ ...defaultConfig, ...config });
};

// Singleton instance
let eventBusInstance: EventBus | null = null;

export const getEventBus = (): EventBus => {
  if (!eventBusInstance) {
    eventBusInstance = createEventBus({});
  }
  return eventBusInstance;
};
