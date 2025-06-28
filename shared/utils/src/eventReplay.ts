import { Redis } from 'ioredis';
import { CloudMastersEvent } from '@cloudmastershub/types';
import { getEventBus } from './eventBus';
import logger from './logger';

export interface EventStore {
  save(event: CloudMastersEvent): Promise<void>;
  getEvents(filters: EventFilters): Promise<StoredEvent[]>;
  getEventsByTimeRange(startTime: Date, endTime: Date): Promise<StoredEvent[]>;
  getEventsByType(eventType: string, limit?: number): Promise<StoredEvent[]>;
  getEventsById(eventIds: string[]): Promise<StoredEvent[]>;
}

export interface StoredEvent {
  event: CloudMastersEvent;
  storedAt: Date;
  replayCount: number;
  lastReplayAt?: Date;
}

export interface EventFilters {
  eventType?: string;
  source?: string;
  correlationId?: string;
  userId?: string;
  courseId?: string;
  labId?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
}

export interface ReplayOptions {
  fromTime?: Date;
  toTime?: Date;
  eventTypes?: string[];
  correlationIds?: string[];
  batchSize?: number;
  delayBetweenBatches?: number;
  maxRetries?: number;
  dryRun?: boolean;
}

export interface ReplayResult {
  totalEvents: number;
  successfulReplays: number;
  failedReplays: number;
  skippedEvents: number;
  errors: ReplayError[];
}

export interface ReplayError {
  eventId: string;
  eventType: string;
  error: string;
  timestamp: Date;
}

export interface RecoveryCheckpoint {
  id: string;
  name: string;
  timestamp: Date;
  lastProcessedEventId: string;
  eventCount: number;
  metadata: Record<string, any>;
}

export class RedisEventStore implements EventStore {
  private redis: Redis;
  private keyPrefix: string;

  constructor(redis: Redis, keyPrefix = 'cloudmasters:events') {
    this.redis = redis;
    this.keyPrefix = keyPrefix;
  }

  async save(event: CloudMastersEvent): Promise<void> {
    const storedEvent: StoredEvent = {
      event,
      storedAt: new Date(),
      replayCount: 0,
    };

    const eventKey = `${this.keyPrefix}:${event.id}`;
    const timeKey = `${this.keyPrefix}:by_time`;
    const typeKey = `${this.keyPrefix}:by_type:${event.type}`;
    const sourceKey = `${this.keyPrefix}:by_source:${event.source}`;

    const pipeline = this.redis.pipeline();

    // Store the event
    pipeline.hset(eventKey, {
      event: JSON.stringify(event),
      storedAt: storedEvent.storedAt.toISOString(),
      replayCount: 0,
    });

    // Add to time-based sorted set
    pipeline.zadd(timeKey, event.timestamp.getTime(), event.id);

    // Add to type-based sorted set
    pipeline.zadd(typeKey, event.timestamp.getTime(), event.id);

    // Add to source-based sorted set
    pipeline.zadd(sourceKey, event.timestamp.getTime(), event.id);

    // Add correlation ID index if present
    if (event.correlationId) {
      const corrKey = `${this.keyPrefix}:by_correlation:${event.correlationId}`;
      pipeline.zadd(corrKey, event.timestamp.getTime(), event.id);
    }

    // Add user/course/lab indexes if present
    const eventData = event as any;
    if (eventData.userId) {
      const userKey = `${this.keyPrefix}:by_user:${eventData.userId}`;
      pipeline.zadd(userKey, event.timestamp.getTime(), event.id);
    }
    if (eventData.courseId) {
      const courseKey = `${this.keyPrefix}:by_course:${eventData.courseId}`;
      pipeline.zadd(courseKey, event.timestamp.getTime(), event.id);
    }
    if (eventData.labId) {
      const labKey = `${this.keyPrefix}:by_lab:${eventData.labId}`;
      pipeline.zadd(labKey, event.timestamp.getTime(), event.id);
    }

    await pipeline.exec();
  }

  async getEvents(filters: EventFilters): Promise<StoredEvent[]> {
    let eventIds: string[] = [];

    if (filters.correlationId) {
      const corrKey = `${this.keyPrefix}:by_correlation:${filters.correlationId}`;
      eventIds = await this.redis.zrange(corrKey, 0, -1);
    } else if (filters.eventType) {
      const typeKey = `${this.keyPrefix}:by_type:${filters.eventType}`;
      const start = filters.startTime ? filters.startTime.getTime() : 0;
      const end = filters.endTime ? filters.endTime.getTime() : Date.now();
      eventIds = await this.redis.zrangebyscore(typeKey, start, end);
    } else if (filters.source) {
      const sourceKey = `${this.keyPrefix}:by_source:${filters.source}`;
      const start = filters.startTime ? filters.startTime.getTime() : 0;
      const end = filters.endTime ? filters.endTime.getTime() : Date.now();
      eventIds = await this.redis.zrangebyscore(sourceKey, start, end);
    } else if (filters.userId) {
      const userKey = `${this.keyPrefix}:by_user:${filters.userId}`;
      eventIds = await this.redis.zrange(userKey, 0, -1);
    } else if (filters.courseId) {
      const courseKey = `${this.keyPrefix}:by_course:${filters.courseId}`;
      eventIds = await this.redis.zrange(courseKey, 0, -1);
    } else if (filters.labId) {
      const labKey = `${this.keyPrefix}:by_lab:${filters.labId}`;
      eventIds = await this.redis.zrange(labKey, 0, -1);
    } else {
      // Get by time range
      const timeKey = `${this.keyPrefix}:by_time`;
      const start = filters.startTime ? filters.startTime.getTime() : 0;
      const end = filters.endTime ? filters.endTime.getTime() : Date.now();
      eventIds = await this.redis.zrangebyscore(timeKey, start, end);
    }

    // Apply pagination
    if (filters.offset || filters.limit) {
      const offset = filters.offset || 0;
      const limit = filters.limit || 100;
      eventIds = eventIds.slice(offset, offset + limit);
    }

    return this.getEventsById(eventIds);
  }

  async getEventsByTimeRange(startTime: Date, endTime: Date): Promise<StoredEvent[]> {
    return this.getEvents({ startTime, endTime });
  }

  async getEventsByType(eventType: string, limit = 100): Promise<StoredEvent[]> {
    return this.getEvents({ eventType, limit });
  }

  async getEventsById(eventIds: string[]): Promise<StoredEvent[]> {
    if (eventIds.length === 0) return [];

    const pipeline = this.redis.pipeline();
    eventIds.forEach((id) => {
      const eventKey = `${this.keyPrefix}:${id}`;
      pipeline.hgetall(eventKey);
    });

    const results = await pipeline.exec();
    const storedEvents: StoredEvent[] = [];

    results?.forEach((result, index) => {
      if (result && result[1]) {
        const eventData = result[1] as Record<string, string>;
        if (eventData.event) {
          try {
            const event = JSON.parse(eventData.event) as CloudMastersEvent;
            event.timestamp = new Date(event.timestamp);

            storedEvents.push({
              event,
              storedAt: new Date(eventData.storedAt),
              replayCount: parseInt(eventData.replayCount || '0'),
              lastReplayAt: eventData.lastReplayAt ? new Date(eventData.lastReplayAt) : undefined,
            });
          } catch (error) {
            logger.error(`Failed to parse stored event ${eventIds[index]}:`, error);
          }
        }
      }
    });

    return storedEvents;
  }

  async updateReplayCount(eventId: string): Promise<void> {
    const eventKey = `${this.keyPrefix}:${eventId}`;
    await this.redis.hincrby(eventKey, 'replayCount', 1);
    await this.redis.hset(eventKey, 'lastReplayAt', new Date().toISOString());
  }
}

export class EventReplayManager {
  private eventStore: EventStore;
  private eventBus: any;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
    this.eventBus = getEventBus();
  }

  /**
   * Replay events based on filters and options
   */
  async replayEvents(filters: EventFilters, options: ReplayOptions = {}): Promise<ReplayResult> {
    const { batchSize = 50, delayBetweenBatches = 1000, maxRetries = 3, dryRun = false } = options;

    logger.info('Starting event replay', { filters, options });

    const events = await this.eventStore.getEvents(filters);
    const result: ReplayResult = {
      totalEvents: events.length,
      successfulReplays: 0,
      failedReplays: 0,
      skippedEvents: 0,
      errors: [],
    };

    // Filter events by type if specified
    let filteredEvents = events;
    if (options.eventTypes && options.eventTypes.length > 0) {
      filteredEvents = events.filter((storedEvent) =>
        options.eventTypes!.includes(storedEvent.event.type)
      );
    }

    // Filter by correlation IDs if specified
    if (options.correlationIds && options.correlationIds.length > 0) {
      filteredEvents = filteredEvents.filter(
        (storedEvent) =>
          storedEvent.event.correlationId &&
          options.correlationIds!.includes(storedEvent.event.correlationId)
      );
    }

    // Filter by time range
    if (options.fromTime || options.toTime) {
      filteredEvents = filteredEvents.filter((storedEvent) => {
        const eventTime = storedEvent.event.timestamp;
        if (options.fromTime && eventTime < options.fromTime) return false;
        if (options.toTime && eventTime > options.toTime) return false;
        return true;
      });
    }

    result.totalEvents = filteredEvents.length;

    if (dryRun) {
      logger.info(`Dry run: Would replay ${filteredEvents.length} events`);
      return result;
    }

    // Process events in batches
    for (let i = 0; i < filteredEvents.length; i += batchSize) {
      const batch = filteredEvents.slice(i, i + batchSize);

      for (const storedEvent of batch) {
        let retries = 0;
        let success = false;

        while (retries < maxRetries && !success) {
          try {
            // Create a new event with replay metadata
            const replayEvent = {
              ...storedEvent.event,
              metadata: {
                ...storedEvent.event.metadata,
                isReplay: true,
                originalTimestamp: storedEvent.event.timestamp.toISOString(),
                replayTimestamp: new Date().toISOString(),
                replayCount: storedEvent.replayCount + 1,
              },
            };

            await this.eventBus.publish(replayEvent);

            // Update replay count in store
            if (this.eventStore instanceof RedisEventStore) {
              await this.eventStore.updateReplayCount(storedEvent.event.id);
            }

            result.successfulReplays++;
            success = true;

            logger.debug(`Successfully replayed event ${storedEvent.event.id}`, {
              eventType: storedEvent.event.type,
              attempt: retries + 1,
            });
          } catch (error) {
            retries++;

            if (retries >= maxRetries) {
              result.failedReplays++;
              result.errors.push({
                eventId: storedEvent.event.id,
                eventType: storedEvent.event.type,
                error: error instanceof Error ? error.message : String(error),
                timestamp: new Date(),
              });

              logger.error(
                `Failed to replay event ${storedEvent.event.id} after ${maxRetries} attempts:`,
                error
              );
            } else {
              logger.warn(
                `Retry ${retries}/${maxRetries} for event ${storedEvent.event.id}:`,
                error
              );
              await this.delay(1000 * retries); // Exponential backoff
            }
          }
        }
      }

      // Delay between batches
      if (i + batchSize < filteredEvents.length && delayBetweenBatches > 0) {
        await this.delay(delayBetweenBatches);
      }
    }

    logger.info('Event replay completed', result);
    return result;
  }

  /**
   * Replay events for a specific correlation ID (useful for recovering failed workflows)
   */
  async replayCorrelatedEvents(
    correlationId: string,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    return this.replayEvents({ correlationId }, options);
  }

  /**
   * Replay events for a specific user
   */
  async replayUserEvents(userId: string, fromTime?: Date, toTime?: Date): Promise<ReplayResult> {
    return this.replayEvents({ userId, startTime: fromTime, endTime: toTime });
  }

  /**
   * Create a recovery checkpoint
   */
  async createCheckpoint(
    name: string,
    lastProcessedEventId: string,
    metadata: Record<string, any> = {}
  ): Promise<RecoveryCheckpoint> {
    const checkpoint: RecoveryCheckpoint = {
      id: `checkpoint-${Date.now()}`,
      name,
      timestamp: new Date(),
      lastProcessedEventId,
      eventCount: 0, // TODO: Calculate actual count
      metadata,
    };

    // Store checkpoint in Redis (if using RedisEventStore)
    if (this.eventStore instanceof RedisEventStore) {
      const checkpointKey = `cloudmasters:checkpoints:${checkpoint.id}`;
      await (this.eventStore as any).redis.hset(checkpointKey, {
        id: checkpoint.id,
        name: checkpoint.name,
        timestamp: checkpoint.timestamp.toISOString(),
        lastProcessedEventId: checkpoint.lastProcessedEventId,
        eventCount: checkpoint.eventCount,
        metadata: JSON.stringify(checkpoint.metadata),
      });
    }

    logger.info(`Created recovery checkpoint: ${name}`, checkpoint);
    return checkpoint;
  }

  /**
   * Recover from a checkpoint
   */
  async recoverFromCheckpoint(
    checkpointId: string,
    options: ReplayOptions = {}
  ): Promise<ReplayResult> {
    // TODO: Implement checkpoint recovery logic
    logger.info(`Recovering from checkpoint: ${checkpointId}`);

    // For now, replay all events after checkpoint timestamp
    const fromTime = new Date(); // TODO: Get from checkpoint
    return this.replayEvents({ startTime: fromTime }, options);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Factory function to create event replay manager
export const createEventReplayManager = (redis: Redis): EventReplayManager => {
  const eventStore = new RedisEventStore(redis);
  return new EventReplayManager(eventStore);
};

// Singleton instance
let eventReplayManager: EventReplayManager | null = null;

export const getEventReplayManager = (): EventReplayManager => {
  if (!eventReplayManager) {
    // Use the same Redis instance as the event bus
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: 3,
    });

    eventReplayManager = createEventReplayManager(redis);
  }
  return eventReplayManager;
};
