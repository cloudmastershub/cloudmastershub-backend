#!/usr/bin/env ts-node

import { program } from 'commander';
import { Redis } from 'ioredis';
import { 
  getEventReplayManager, 
  EventFilters, 
  ReplayOptions 
} from '../shared/utils/src/eventReplay';
import { getEventValidator } from '../shared/utils/src/eventValidation';

// Initialize Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

const replayManager = getEventReplayManager();
const validator = getEventValidator();

program
  .name('event-replay-cli')
  .description('CloudMastersHub Event Replay and Recovery CLI')
  .version('1.0.0');

// Replay events command
program
  .command('replay')
  .description('Replay events based on filters')
  .option('-t, --type <eventType>', 'Event type to replay')
  .option('-s, --source <source>', 'Event source to replay')
  .option('-c, --correlation-id <correlationId>', 'Correlation ID to replay')
  .option('-u, --user-id <userId>', 'User ID to replay events for')
  .option('--course-id <courseId>', 'Course ID to replay events for')
  .option('--lab-id <labId>', 'Lab ID to replay events for')
  .option('--from <fromTime>', 'Start time (ISO string)')
  .option('--to <toTime>', 'End time (ISO string)')
  .option('--limit <limit>', 'Limit number of events', parseInt)
  .option('--batch-size <batchSize>', 'Batch size for replay', parseInt, 50)
  .option('--delay <delay>', 'Delay between batches (ms)', parseInt, 1000)
  .option('--max-retries <maxRetries>', 'Max retries per event', parseInt, 3)
  .option('--dry-run', 'Perform a dry run without actually replaying')
  .action(async (options) => {
    try {
      console.log('🔄 Starting event replay...');
      
      const filters: EventFilters = {};
      if (options.type) filters.eventType = options.type;
      if (options.source) filters.source = options.source;
      if (options.correlationId) filters.correlationId = options.correlationId;
      if (options.userId) filters.userId = options.userId;
      if (options.courseId) filters.courseId = options.courseId;
      if (options.labId) filters.labId = options.labId;
      if (options.from) filters.startTime = new Date(options.from);
      if (options.to) filters.endTime = new Date(options.to);
      if (options.limit) filters.limit = options.limit;

      const replayOptions: ReplayOptions = {
        batchSize: options.batchSize,
        delayBetweenBatches: options.delay,
        maxRetries: options.maxRetries,
        dryRun: options.dryRun
      };

      console.log('📋 Filters:', JSON.stringify(filters, null, 2));
      console.log('⚙️  Options:', JSON.stringify(replayOptions, null, 2));

      const result = await replayManager.replayEvents(filters, replayOptions);

      console.log('✅ Replay completed:');
      console.log(`   Total events: ${result.totalEvents}`);
      console.log(`   Successful replays: ${result.successfulReplays}`);
      console.log(`   Failed replays: ${result.failedReplays}`);
      console.log(`   Skipped events: ${result.skippedEvents}`);
      
      if (result.errors.length > 0) {
        console.log('❌ Errors:');
        result.errors.forEach(error => {
          console.log(`   - ${error.eventType} (${error.eventId}): ${error.error}`);
        });
      }

    } catch (error) {
      console.error('❌ Replay failed:', error);
      process.exit(1);
    }
  });

// Replay correlated events command
program
  .command('replay-correlation <correlationId>')
  .description('Replay all events with a specific correlation ID')
  .option('--dry-run', 'Perform a dry run without actually replaying')
  .option('--max-retries <maxRetries>', 'Max retries per event', parseInt, 3)
  .action(async (correlationId, options) => {
    try {
      console.log(`🔄 Replaying correlated events for: ${correlationId}`);
      
      const result = await replayManager.replayCorrelatedEvents(correlationId, {
        dryRun: options.dryRun,
        maxRetries: options.maxRetries
      });

      console.log('✅ Correlation replay completed:');
      console.log(`   Total events: ${result.totalEvents}`);
      console.log(`   Successful replays: ${result.successfulReplays}`);
      console.log(`   Failed replays: ${result.failedReplays}`);

    } catch (error) {
      console.error('❌ Correlation replay failed:', error);
      process.exit(1);
    }
  });

// Replay user events command
program
  .command('replay-user <userId>')
  .description('Replay all events for a specific user')
  .option('--from <fromTime>', 'Start time (ISO string)')
  .option('--to <toTime>', 'End time (ISO string)')
  .option('--dry-run', 'Perform a dry run without actually replaying')
  .action(async (userId, options) => {
    try {
      console.log(`🔄 Replaying user events for: ${userId}`);
      
      const fromTime = options.from ? new Date(options.from) : undefined;
      const toTime = options.to ? new Date(options.to) : undefined;
      
      const result = await replayManager.replayUserEvents(userId, fromTime, toTime);

      console.log('✅ User replay completed:');
      console.log(`   Total events: ${result.totalEvents}`);
      console.log(`   Successful replays: ${result.successfulReplays}`);
      console.log(`   Failed replays: ${result.failedReplays}`);

    } catch (error) {
      console.error('❌ User replay failed:', error);
      process.exit(1);
    }
  });

// Create checkpoint command
program
  .command('checkpoint <name> <lastEventId>')
  .description('Create a recovery checkpoint')
  .option('-m, --metadata <metadata>', 'Additional metadata (JSON string)')
  .action(async (name, lastEventId, options) => {
    try {
      console.log(`📍 Creating checkpoint: ${name}`);
      
      let metadata = {};
      if (options.metadata) {
        try {
          metadata = JSON.parse(options.metadata);
        } catch (error) {
          console.error('❌ Invalid metadata JSON:', error);
          process.exit(1);
        }
      }

      const checkpoint = await replayManager.createCheckpoint(name, lastEventId, metadata);

      console.log('✅ Checkpoint created:');
      console.log(`   ID: ${checkpoint.id}`);
      console.log(`   Name: ${checkpoint.name}`);
      console.log(`   Timestamp: ${checkpoint.timestamp.toISOString()}`);
      console.log(`   Last Event ID: ${checkpoint.lastProcessedEventId}`);

    } catch (error) {
      console.error('❌ Checkpoint creation failed:', error);
      process.exit(1);
    }
  });

// Validate events command
program
  .command('validate-schemas')
  .description('Show available event schemas and validation rules')
  .action(async () => {
    try {
      console.log('📋 Available Event Schemas:');
      
      const schemas = validator.getSchemas();
      
      Object.entries(schemas).forEach(([eventType, schema]) => {
        console.log(`\n🔍 ${eventType}:`);
        console.log(`   Required: ${schema.requiredFields.join(', ')}`);
        if (schema.optionalFields) {
          console.log(`   Optional: ${schema.optionalFields.join(', ')}`);
        }
        if (schema.dataSchema) {
          console.log(`   Data Required: ${schema.dataSchema.requiredFields.join(', ')}`);
          if (schema.dataSchema.optionalFields) {
            console.log(`   Data Optional: ${schema.dataSchema.optionalFields.join(', ')}`);
          }
        }
      });

    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      process.exit(1);
    }
  });

// List events command
program
  .command('list')
  .description('List stored events')
  .option('-t, --type <eventType>', 'Filter by event type')
  .option('-s, --source <source>', 'Filter by event source')
  .option('--from <fromTime>', 'Start time (ISO string)')
  .option('--to <toTime>', 'End time (ISO string)')
  .option('--limit <limit>', 'Limit number of events', parseInt, 20)
  .action(async (options) => {
    try {
      console.log('📋 Listing stored events...');
      
      const filters: EventFilters = {
        limit: options.limit
      };
      if (options.type) filters.eventType = options.type;
      if (options.source) filters.source = options.source;
      if (options.from) filters.startTime = new Date(options.from);
      if (options.to) filters.endTime = new Date(options.to);

      const eventStore = replayManager['eventStore'];
      if (!eventStore) {
        console.error('❌ Event store not available');
        process.exit(1);
      }

      const events = await eventStore.getEvents(filters);

      console.log(`📊 Found ${events.length} events:`);
      events.forEach(storedEvent => {
        const event = storedEvent.event;
        console.log(`\n🔗 ${event.id}`);
        console.log(`   Type: ${event.type}`);
        console.log(`   Source: ${event.source}`);
        console.log(`   Timestamp: ${event.timestamp.toISOString()}`);
        console.log(`   Replay Count: ${storedEvent.replayCount}`);
        if (event.correlationId) {
          console.log(`   Correlation: ${event.correlationId}`);
        }
      });

    } catch (error) {
      console.error('❌ List events failed:', error);
      process.exit(1);
    }
  });

// Health check command
program
  .command('health')
  .description('Check event system health')
  .action(async () => {
    try {
      console.log('🔍 Checking event system health...');
      
      // Check Redis connection
      const pong = await redis.ping();
      console.log(`✅ Redis: ${pong === 'PONG' ? 'Connected' : 'Failed'}`);
      
      // Check event schemas
      const schemas = validator.getSchemas();
      console.log(`✅ Event Schemas: ${Object.keys(schemas).length} loaded`);
      
      // Check event store
      const eventStore = replayManager['eventStore'];
      console.log(`✅ Event Store: ${eventStore ? 'Available' : 'Not Available'}`);
      
      console.log('\n🎯 System Status: Healthy');

    } catch (error) {
      console.error('❌ Health check failed:', error);
      process.exit(1);
    }
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await redis.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await redis.disconnect();
  process.exit(0);
});

// Parse command line arguments
program.parse();