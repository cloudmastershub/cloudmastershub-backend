# Event Replay and Recovery System

This document describes the event replay and recovery mechanisms implemented in CloudMastersHub.

## Overview

The event replay and recovery system provides:

1. **Event Validation**: Schema-based validation for all events
2. **Event Storage**: Persistent storage of events in Redis with multiple indexes
3. **Event Replay**: Ability to replay events based on various filters
4. **Recovery Mechanisms**: Checkpoints and recovery from failures
5. **CLI Tools**: Command-line interface for operations

## Features

### Event Validation

All events are validated against predefined schemas before publishing:

```typescript
import { getEventValidator } from '@cloudmastershub/utils';

const validator = getEventValidator();
const result = validator.validate(event);

if (!result.isValid) {
  console.error('Validation errors:', result.errors);
}
```

**Supported Event Types:**
- User events: `user.registered`, `user.profile.updated`, `user.subscription.updated`
- Course events: `course.created`, `course.enrolled`, `course.completed`
- Lab events: `lab.created`, `lab.session.started`, `lab.session.completed`
- Payment events: `payment.processed`, `subscription.created`
- Learning Path events: `path.created`, `path.completed`
- Admin events: `admin.user.action`

### Event Storage

Events are automatically stored with multiple indexes for efficient querying:

- **By Time**: Time-based sorting for chronological access
- **By Type**: Grouped by event type for type-specific operations
- **By Source**: Grouped by service that published the event
- **By Correlation ID**: Events sharing the same workflow
- **By Entity ID**: Events for specific users, courses, labs

### Event Replay

Replay events based on flexible filters:

```typescript
import { getEventReplayManager } from '@cloudmastershub/utils';

const replayManager = getEventReplayManager();

// Replay by event type
const result = await replayManager.replayEvents({
  eventType: 'user.registered',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
  limit: 100
});

// Replay by correlation ID (entire workflow)
const workflowResult = await replayManager.replayCorrelatedEvents('correlation-123');

// Replay user events
const userResult = await replayManager.replayUserEvents('user-123');
```

### Recovery Checkpoints

Create and use checkpoints for disaster recovery:

```typescript
// Create checkpoint
const checkpoint = await replayManager.createCheckpoint(
  'before-migration',
  'last-processed-event-id',
  { migration: 'v2.1.0', timestamp: new Date() }
);

// Recover from checkpoint
const result = await replayManager.recoverFromCheckpoint(checkpoint.id);
```

## CLI Usage

The event replay CLI provides command-line access to all functionality:

### Installation

```bash
# Install dependencies (if not already installed)
npm install commander ioredis

# Make CLI executable
chmod +x scripts/event-replay-cli.ts
```

### Commands

#### 1. Replay Events

```bash
# Replay all user registration events from last month
./scripts/event-replay-cli.ts replay \
  --type user.registered \
  --from 2024-01-01T00:00:00Z \
  --to 2024-01-31T23:59:59Z \
  --batch-size 25 \
  --delay 500

# Dry run to see what would be replayed
./scripts/event-replay-cli.ts replay \
  --type course.enrolled \
  --user-id user-123 \
  --dry-run

# Replay events by correlation ID
./scripts/event-replay-cli.ts replay \
  --correlation-id workflow-abc-123 \
  --max-retries 5
```

#### 2. Replay Correlated Events

```bash
# Replay entire workflow
./scripts/event-replay-cli.ts replay-correlation correlation-123

# Dry run correlation replay
./scripts/event-replay-cli.ts replay-correlation correlation-123 --dry-run
```

#### 3. Replay User Events

```bash
# Replay all events for a user
./scripts/event-replay-cli.ts replay-user user-123

# Replay user events in date range
./scripts/event-replay-cli.ts replay-user user-123 \
  --from 2024-01-01T00:00:00Z \
  --to 2024-01-31T23:59:59Z
```

#### 4. Create Checkpoints

```bash
# Create a checkpoint
./scripts/event-replay-cli.ts checkpoint \
  "pre-migration-v2" \
  "event-456789" \
  --metadata '{"version": "2.0.0", "reason": "pre-migration"}'
```

#### 5. List Events

```bash
# List recent events
./scripts/event-replay-cli.ts list --limit 10

# List events by type
./scripts/event-replay-cli.ts list --type user.registered --limit 20

# List events in date range
./scripts/event-replay-cli.ts list \
  --from 2024-01-01T00:00:00Z \
  --to 2024-01-31T23:59:59Z \
  --limit 50
```

#### 6. Validate Schemas

```bash
# Show all available event schemas
./scripts/event-replay-cli.ts validate-schemas
```

#### 7. Health Check

```bash
# Check system health
./scripts/event-replay-cli.ts health
```

## Integration Examples

### Service Integration

Enable event validation and storage in your service:

```typescript
// In service initialization
import { getEventBus } from '@cloudmastershub/utils';

const eventBus = getEventBus();

// Event validation is enabled by default
// Storage is enabled by default
// Events are automatically validated and stored when published
```

### Custom Event Publishers

Add validation to custom event publishers:

```typescript
import { getEventValidator } from '@cloudmastershub/utils';

export class CustomEventPublisher {
  private validator = getEventValidator();
  private eventBus = getEventBus();

  async publishCustomEvent(data: any): Promise<void> {
    const event = {
      id: uuidv4(),
      type: 'custom.event',
      version: '1.0',
      timestamp: new Date(),
      source: 'custom-service',
      metadata: { serviceName: 'custom-service' },
      data
    };

    // Validate before publishing
    const validation = this.validator.validate(event);
    if (!validation.isValid) {
      throw new Error(`Event validation failed: ${validation.errors.join(', ')}`);
    }

    await this.eventBus.publish(event);
  }
}
```

### Error Handling and Recovery

Handle event processing errors with automatic retry and dead letter queue:

```typescript
export class EventHandler {
  async handle(event: CloudMastersEvent): Promise<void> {
    try {
      // Process event
      await this.processEvent(event);
    } catch (error) {
      // Error handling is automatic:
      // 1. Event will be retried up to maxRetries times
      // 2. Failed events go to dead letter queue
      // 3. Events can be replayed later
      throw error;
    }
  }

  async onError(error: Error, event: CloudMastersEvent): Promise<void> {
    // Custom error handling
    logger.error('Event processing failed', {
      eventId: event.id,
      eventType: event.type,
      error: error.message
    });

    // Optionally create an error event
    await this.eventBus.publish({
      id: uuidv4(),
      type: 'system.error',
      version: '1.0',
      timestamp: new Date(),
      source: 'error-handler',
      correlationId: event.correlationId,
      metadata: { originalEventId: event.id },
      data: { error: error.message, originalEvent: event.type }
    });
  }
}
```

## Recovery Scenarios

### 1. Service Restart Recovery

When a service restarts, replay missed events:

```bash
# Replay events since last known good state
./scripts/event-replay-cli.ts replay \
  --from 2024-01-15T10:30:00Z \
  --source user-service \
  --limit 1000
```

### 2. Failed Workflow Recovery

Recover a specific failed workflow:

```bash
# Replay all events for a correlation ID
./scripts/event-replay-cli.ts replay-correlation workflow-payment-123
```

### 3. User Data Recovery

Recover user state by replaying their events:

```bash
# Replay all user events to rebuild state
./scripts/event-replay-cli.ts replay-user user-123
```

### 4. Bulk Data Recovery

Recover large amounts of data with batching:

```bash
# Large replay with careful batching
./scripts/event-replay-cli.ts replay \
  --type course.enrolled \
  --from 2024-01-01T00:00:00Z \
  --batch-size 10 \
  --delay 2000 \
  --max-retries 5
```

## Configuration

### Environment Variables

```bash
# Redis configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Event system configuration
ENABLE_EVENT_VALIDATION=true
ENABLE_EVENT_STORE=true
ENABLE_DEAD_LETTER_QUEUE=true
MAX_EVENT_RETRIES=3
```

### Event Bus Configuration

```typescript
const eventBus = createEventBus({
  enableValidation: true,      // Enable schema validation
  enableEventStore: true,      // Enable event storage
  enableDeadLetterQueue: true, // Enable DLQ for failed events
  maxRetries: 3,              // Max retry attempts
  defaultTimeout: 30000       // Handler timeout in ms
});
```

## Best Practices

### 1. Event Design

- Use descriptive event types: `user.profile.updated` not `user.updated`
- Include correlation IDs for workflows
- Add causation IDs to track event chains
- Keep event data immutable

### 2. Replay Strategy

- Test replays with `--dry-run` first
- Use small batch sizes for large replays
- Add delays between batches to reduce load
- Monitor system resources during replay

### 3. Error Handling

- Implement idempotent event handlers
- Use correlation IDs to track workflows
- Set appropriate retry limits
- Monitor dead letter queues

### 4. Performance

- Use appropriate indexes for queries
- Set TTL on stored events based on retention policy
- Batch operations when possible
- Monitor Redis memory usage

## Monitoring

### Metrics to Monitor

- Event validation failure rate
- Event storage success rate
- Replay success/failure rates
- Dead letter queue depth
- Processing time per event type

### Alerting

Set up alerts for:
- High validation failure rate (> 5%)
- Dead letter queue depth growing
- Event storage failures
- Long processing times (> 10s average)

## Troubleshooting

### Common Issues

1. **Events not storing**: Check Redis connectivity and permissions
2. **Validation failures**: Review event schemas and data structure
3. **Replay failures**: Check event handler idempotency
4. **Performance issues**: Monitor batch sizes and delays

### Debug Commands

```bash
# Check system health
./scripts/event-replay-cli.ts health

# List recent events
./scripts/event-replay-cli.ts list --limit 5

# Validate schemas
./scripts/event-replay-cli.ts validate-schemas

# Test replay with dry run
./scripts/event-replay-cli.ts replay --type user.registered --dry-run --limit 1
```