import { CloudMastersEvent } from '@cloudmastershub/types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface EventSchema {
  type: string;
  requiredFields: string[];
  optionalFields?: string[];
  dataSchema?: EventDataSchema;
}

export interface EventDataSchema {
  requiredFields: string[];
  optionalFields?: string[];
  fieldTypes: Record<string, 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'>;
}

// Base event validation schema
const baseEventSchema: EventSchema = {
  type: 'base',
  requiredFields: ['id', 'type', 'version', 'timestamp', 'source', 'metadata'],
  optionalFields: ['correlationId', 'causationId'],
};

// User event schemas
const userEventSchemas: Record<string, EventSchema> = {
  'user.registered': {
    type: 'user.registered',
    requiredFields: [...baseEventSchema.requiredFields, 'userId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['email', 'registrationMethod'],
      optionalFields: ['firstName', 'lastName', 'provider'],
      fieldTypes: {
        email: 'string',
        registrationMethod: 'string',
        firstName: 'string',
        lastName: 'string',
        provider: 'string',
      },
    },
  },
  'user.profile.updated': {
    type: 'user.profile.updated',
    requiredFields: [...baseEventSchema.requiredFields, 'userId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: [],
      optionalFields: [
        'firstName',
        'lastName',
        'email',
        'phone',
        'avatar',
        'bio',
        'previousValues',
      ],
      fieldTypes: {
        firstName: 'string',
        lastName: 'string',
        email: 'string',
        phone: 'string',
        avatar: 'string',
        bio: 'string',
        previousValues: 'object',
      },
    },
  },
  'user.subscription.updated': {
    type: 'user.subscription.updated',
    requiredFields: [...baseEventSchema.requiredFields, 'userId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['subscriptionType', 'status'],
      optionalFields: ['previousType', 'previousStatus', 'expiresAt', 'billingCycle'],
      fieldTypes: {
        subscriptionType: 'string',
        status: 'string',
        previousType: 'string',
        previousStatus: 'string',
        expiresAt: 'string',
        billingCycle: 'string',
      },
    },
  },
};

// Course event schemas
const courseEventSchemas: Record<string, EventSchema> = {
  'course.created': {
    type: 'course.created',
    requiredFields: [...baseEventSchema.requiredFields, 'courseId', 'instructorId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['title', 'description', 'category', 'difficulty', 'status'],
      optionalFields: ['duration', 'price'],
      fieldTypes: {
        title: 'string',
        description: 'string',
        category: 'string',
        difficulty: 'string',
        status: 'string',
        duration: 'number',
        price: 'number',
      },
    },
  },
  'course.updated': {
    type: 'course.updated',
    requiredFields: [...baseEventSchema.requiredFields, 'courseId'],
    optionalFields: [...(baseEventSchema.optionalFields || []), 'instructorId'],
    dataSchema: {
      requiredFields: [],
      optionalFields: ['title', 'description', 'category', 'difficulty', 'duration', 'price', 'status', 'previousStatus'],
      fieldTypes: {
        title: 'string',
        description: 'string',
        category: 'string',
        difficulty: 'string',
        duration: 'number',
        price: 'number',
        status: 'string',
        previousStatus: 'string',
      },
    },
  },
  'course.enrolled': {
    type: 'course.enrolled',
    requiredFields: [...baseEventSchema.requiredFields, 'courseId', 'userId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['enrollmentType', 'enrolledAt', 'progress'],
      optionalFields: [],
      fieldTypes: {
        enrollmentType: 'string',
        enrolledAt: 'string',
        progress: 'number',
      },
    },
  },
  'course.completed': {
    type: 'course.completed',
    requiredFields: [...baseEventSchema.requiredFields, 'courseId', 'userId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['progress', 'completedAt'],
      optionalFields: ['finalScore', 'completionTime', 'certificateEligible'],
      fieldTypes: {
        progress: 'number',
        completedAt: 'string',
        finalScore: 'number',
        completionTime: 'number',
        certificateEligible: 'boolean',
      },
    },
  },
};

// Lab event schemas
const labEventSchemas: Record<string, EventSchema> = {
  'lab.created': {
    type: 'lab.created',
    requiredFields: [...baseEventSchema.requiredFields, 'labId', 'instructorId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['title', 'type', 'difficulty', 'duration', 'status'],
      optionalFields: [],
      fieldTypes: {
        title: 'string',
        type: 'string',
        difficulty: 'string',
        duration: 'number',
        status: 'string',
      },
    },
  },
  'lab.session.started': {
    type: 'lab.session.started',
    requiredFields: [...baseEventSchema.requiredFields, 'labId', 'userId', 'sessionId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['cloudProvider', 'region', 'startedAt', 'status'],
      optionalFields: ['environmentId', 'resources'],
      fieldTypes: {
        cloudProvider: 'string',
        region: 'string',
        startedAt: 'string',
        status: 'string',
        environmentId: 'string',
        resources: 'array',
      },
    },
  },
  'lab.session.completed': {
    type: 'lab.session.completed',
    requiredFields: [...baseEventSchema.requiredFields, 'labId', 'userId', 'sessionId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['sessionDuration', 'completedAt', 'status'],
      optionalFields: ['solutionScore', 'cost'],
      fieldTypes: {
        sessionDuration: 'number',
        completedAt: 'string',
        status: 'string',
        solutionScore: 'number',
        cost: 'number',
      },
    },
  },
};

// Payment event schemas
const paymentEventSchemas: Record<string, EventSchema> = {
  'payment.processed': {
    type: 'payment.processed',
    requiredFields: [...baseEventSchema.requiredFields, 'userId', 'paymentId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['amount', 'currency', 'status', 'paymentMethod', 'processedAt'],
      optionalFields: ['subscriptionId', 'courseId', 'description'],
      fieldTypes: {
        amount: 'number',
        currency: 'string',
        status: 'string',
        paymentMethod: 'string',
        processedAt: 'string',
        subscriptionId: 'string',
        courseId: 'string',
        description: 'string',
      },
    },
  },
  'subscription.created': {
    type: 'subscription.created',
    requiredFields: [...baseEventSchema.requiredFields, 'userId', 'subscriptionId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['planId', 'status', 'startDate', 'billingCycle'],
      optionalFields: ['endDate', 'trialEndDate', 'amount'],
      fieldTypes: {
        planId: 'string',
        status: 'string',
        startDate: 'string',
        billingCycle: 'string',
        endDate: 'string',
        trialEndDate: 'string',
        amount: 'number',
      },
    },
  },
};

// Learning Path event schemas
const learningPathEventSchemas: Record<string, EventSchema> = {
  'path.created': {
    type: 'path.created',
    requiredFields: [...baseEventSchema.requiredFields, 'pathId', 'instructorId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['title', 'description', 'totalSteps', 'status'],
      optionalFields: [],
      fieldTypes: {
        title: 'string',
        description: 'string',
        totalSteps: 'number',
        status: 'string',
      },
    },
  },
  'path.completed': {
    type: 'path.completed',
    requiredFields: [...baseEventSchema.requiredFields, 'pathId', 'userId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['progress', 'completedSteps', 'totalSteps', 'completedAt'],
      optionalFields: ['completionTime', 'certificateEligible'],
      fieldTypes: {
        progress: 'number',
        completedSteps: 'number',
        totalSteps: 'number',
        completedAt: 'string',
        completionTime: 'number',
        certificateEligible: 'boolean',
      },
    },
  },
};

// Admin event schemas
const adminEventSchemas: Record<string, EventSchema> = {
  'admin.user.action': {
    type: 'admin.user.action',
    requiredFields: [...baseEventSchema.requiredFields, 'adminId', 'targetUserId'],
    optionalFields: baseEventSchema.optionalFields,
    dataSchema: {
      requiredFields: ['action', 'performedAt'],
      optionalFields: ['reason', 'previousValue', 'newValue'],
      fieldTypes: {
        action: 'string',
        performedAt: 'string',
        reason: 'string',
        previousValue: 'string',
        newValue: 'string',
      },
    },
  },
};

// Combined schema registry
const eventSchemas: Record<string, EventSchema> = {
  ...userEventSchemas,
  ...courseEventSchemas,
  ...labEventSchemas,
  ...paymentEventSchemas,
  ...learningPathEventSchemas,
  ...adminEventSchemas,
};

export class EventValidator {
  private schemas: Record<string, EventSchema>;

  constructor() {
    this.schemas = eventSchemas;
  }

  /**
   * Validate an event against its schema
   */
  validate(event: CloudMastersEvent): ValidationResult {
    const errors: string[] = [];

    // Check if schema exists for event type
    const schema = this.schemas[event.type];
    if (!schema) {
      errors.push(`No schema found for event type: ${event.type}`);
      return { isValid: false, errors };
    }

    // Validate base event structure
    this.validateBaseEvent(event, schema, errors);

    // Validate event data if schema exists
    if (schema.dataSchema && event.data) {
      this.validateEventData(event.data, schema.dataSchema, errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate base event fields
   */
  private validateBaseEvent(event: CloudMastersEvent, schema: EventSchema, errors: string[]): void {
    // Check required fields
    for (const field of schema.requiredFields) {
      if (
        !(field in event) ||
        event[field as keyof CloudMastersEvent] === undefined ||
        event[field as keyof CloudMastersEvent] === null
      ) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate field types
    if (event.id && typeof event.id !== 'string') {
      errors.push('Field "id" must be a string');
    }
    if (event.type && typeof event.type !== 'string') {
      errors.push('Field "type" must be a string');
    }
    if (event.version && typeof event.version !== 'string') {
      errors.push('Field "version" must be a string');
    }
    if (
      event.timestamp &&
      !(event.timestamp instanceof Date) &&
      typeof event.timestamp !== 'string'
    ) {
      errors.push('Field "timestamp" must be a Date or ISO string');
    }
    if (event.source && typeof event.source !== 'string') {
      errors.push('Field "source" must be a string');
    }
    if (event.metadata && typeof event.metadata !== 'object') {
      errors.push('Field "metadata" must be an object');
    }
  }

  /**
   * Validate event data against schema
   */
  private validateEventData(data: any, schema: EventDataSchema, errors: string[]): void {
    // Check required fields in data
    for (const field of schema.requiredFields) {
      if (!(field in data) || data[field] === undefined || data[field] === null) {
        errors.push(`Missing required data field: ${field}`);
      }
    }

    // Validate field types
    for (const [field, expectedType] of Object.entries(schema.fieldTypes)) {
      if (field in data && data[field] !== undefined && data[field] !== null) {
        const actualType = this.getFieldType(data[field]);
        if (actualType !== expectedType) {
          errors.push(`Data field "${field}" should be ${expectedType}, got ${actualType}`);
        }
      }
    }
  }

  /**
   * Get the type of a field value
   */
  private getFieldType(value: any): string {
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
  }

  /**
   * Add a new event schema
   */
  addSchema(eventType: string, schema: EventSchema): void {
    this.schemas[eventType] = schema;
  }

  /**
   * Get all registered schemas
   */
  getSchemas(): Record<string, EventSchema> {
    return { ...this.schemas };
  }

  /**
   * Get schema for a specific event type
   */
  getSchema(eventType: string): EventSchema | undefined {
    return this.schemas[eventType];
  }
}

// Singleton instance
let eventValidator: EventValidator | null = null;

export const getEventValidator = (): EventValidator => {
  if (!eventValidator) {
    eventValidator = new EventValidator();
  }
  return eventValidator;
};

// Utility function for quick validation
export const validateEvent = (event: CloudMastersEvent): ValidationResult => {
  return getEventValidator().validate(event);
};
