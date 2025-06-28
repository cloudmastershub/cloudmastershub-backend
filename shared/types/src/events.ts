// Base event interface
export interface BaseEvent {
  id: string;
  type: string;
  version: string;
  timestamp: Date;
  source: string;
  correlationId?: string;
  causationId?: string;
  metadata: Record<string, any>;
}

// Event status for tracking
export enum EventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

// Event priority levels
export enum EventPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Payment Events (Enhanced)
export interface PaymentEvent extends BaseEvent {
  type:
    | 'payment.subscription.created'
    | 'payment.subscription.updated'
    | 'payment.subscription.cancelled'
    | 'payment.purchase.completed'
    | 'payment.payment.succeeded'
    | 'payment.payment.failed'
    | 'payment.access.granted'
    | 'payment.access.revoked'
    | 'payment.refund.processed'
    | 'payment.invoice.created'
    | 'payment.invoice.paid'
    | 'payment.trial.started'
    | 'payment.trial.ended'
    | 'payment.dunning.started'
    | 'payment.plan.changed';
  userId: string;
  subscriptionId?: string;
  purchaseId?: string;
  paymentId?: string;
  invoiceId?: string;
  resourceType?: 'platform' | 'course' | 'learning_path' | 'lab';
  resourceId?: string;
  data: {
    planId?: string;
    previousPlanId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    previousStatus?: string;
    expiresAt?: Date;
    trialEndsAt?: Date;
    reason?: string;
    paymentMethodId?: string;
    [key: string]: any;
  };
}

// User Events
export interface UserEvent extends BaseEvent {
  type:
    | 'user.created'
    | 'user.updated'
    | 'user.deleted'
    | 'user.profile.updated'
    | 'user.email.changed'
    | 'user.password.changed'
    | 'user.role.changed'
    | 'user.login'
    | 'user.logout'
    | 'user.suspended'
    | 'user.activated';
  userId: string;
  data: {
    email?: string;
    previousEmail?: string;
    firstName?: string;
    lastName?: string;
    roles?: string[];
    previousRoles?: string[];
    status?: string;
    previousStatus?: string;
    loginMethod?: string;
    ipAddress?: string;
    userAgent?: string;
    reason?: string;
    [key: string]: any;
  };
}

// Course Events
export interface CourseEvent extends BaseEvent {
  type:
    | 'course.created'
    | 'course.updated'
    | 'course.deleted'
    | 'course.published'
    | 'course.unpublished'
    | 'course.enrolled'
    | 'course.unenrolled'
    | 'course.progress.updated'
    | 'course.completed'
    | 'course.certificate.issued'
    | 'course.reviewed'
    | 'course.rating.added';
  courseId: string;
  userId?: string;
  instructorId?: string;
  data: {
    title?: string;
    description?: string;
    category?: string;
    difficulty?: string;
    duration?: number;
    price?: number;
    status?: string;
    previousStatus?: string;
    progress?: number;
    rating?: number;
    review?: string;
    certificateId?: string;
    enrollmentType?: 'subscription' | 'purchase' | 'free';
    [key: string]: any;
  };
}

// Learning Path Events
export interface LearningPathEvent extends BaseEvent {
  type:
    | 'path.created'
    | 'path.updated'
    | 'path.deleted'
    | 'path.published'
    | 'path.enrolled'
    | 'path.unenrolled'
    | 'path.progress.updated'
    | 'path.completed'
    | 'path.certificate.issued'
    | 'path.step.completed';
  pathId: string;
  userId?: string;
  instructorId?: string;
  stepId?: string;
  data: {
    title?: string;
    description?: string;
    totalSteps?: number;
    completedSteps?: number;
    progress?: number;
    status?: string;
    previousStatus?: string;
    stepType?: 'course' | 'assessment' | 'project';
    certificateId?: string;
    enrollmentType?: 'subscription' | 'purchase' | 'free';
    [key: string]: any;
  };
}

// Lab Events
export interface LabEvent extends BaseEvent {
  type:
    | 'lab.created'
    | 'lab.updated'
    | 'lab.deleted'
    | 'lab.published'
    | 'lab.session.started'
    | 'lab.session.stopped'
    | 'lab.session.completed'
    | 'lab.session.failed'
    | 'lab.solution.submitted'
    | 'lab.solution.graded'
    | 'lab.environment.provisioned'
    | 'lab.environment.destroyed';
  labId: string;
  userId?: string;
  sessionId?: string;
  instructorId?: string;
  data: {
    title?: string;
    type?: 'aws' | 'azure' | 'gcp';
    difficulty?: string;
    duration?: number;
    status?: string;
    previousStatus?: string;
    sessionDuration?: number;
    solutionScore?: number;
    environmentId?: string;
    cloudProvider?: string;
    region?: string;
    resources?: string[];
    cost?: number;
    errorMessage?: string;
    [key: string]: any;
  };
}

// Admin Events
export interface AdminEvent extends BaseEvent {
  type:
    | 'admin.user.managed'
    | 'admin.content.moderated'
    | 'admin.settings.updated'
    | 'admin.instructor.approved'
    | 'admin.instructor.rejected'
    | 'admin.system.maintenance'
    | 'admin.feature.toggled'
    | 'admin.analytics.generated'
    | 'admin.audit.logged';
  adminId: string;
  targetUserId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  data: {
    action?: string;
    reason?: string;
    previousValue?: any;
    newValue?: any;
    settingKey?: string;
    featureName?: string;
    maintenanceType?: string;
    duration?: number;
    auditType?: string;
    [key: string]: any;
  };
}

// System Events
export interface SystemEvent extends BaseEvent {
  type:
    | 'system.service.started'
    | 'system.service.stopped'
    | 'system.health.check'
    | 'system.error'
    | 'system.warning'
    | 'system.backup.started'
    | 'system.backup.completed'
    | 'system.deployment.started'
    | 'system.deployment.completed';
  serviceId: string;
  data: {
    version?: string;
    status?: string;
    healthScore?: number;
    errorType?: string;
    errorMessage?: string;
    stackTrace?: string;
    backupSize?: number;
    deploymentId?: string;
    environment?: string;
    [key: string]: any;
  };
}

// Union type for all events
export type CloudMastersEvent =
  | PaymentEvent
  | UserEvent
  | CourseEvent
  | LearningPathEvent
  | LabEvent
  | AdminEvent
  | SystemEvent;

// Event envelope for transport
export interface EventEnvelope {
  event: CloudMastersEvent;
  priority: EventPriority;
  retryCount: number;
  maxRetries: number;
  delayMs: number;
  expiresAt?: Date;
  deadLetterQueue?: string;
  headers: Record<string, string>;
}

// Event handler interface
export interface EventHandler<T extends CloudMastersEvent = CloudMastersEvent> {
  eventType: string | string[];
  handle(event: T, envelope: EventEnvelope): Promise<void>;
  onError?(error: Error, event: T, envelope: EventEnvelope): Promise<void>;
}

// Event publisher interface
export interface EventPublisher {
  publish(
    event: CloudMastersEvent,
    options?: {
      priority?: EventPriority;
      delay?: number;
      retries?: number;
      expiration?: Date;
    }
  ): Promise<void>;
}

// Event subscriber interface
export interface EventSubscriber {
  subscribe(eventType: string | string[], handler: EventHandler): Promise<void>;
  unsubscribe(eventType: string, handler: EventHandler): Promise<void>;
}

// Event store interface
export interface EventStore {
  save(event: CloudMastersEvent, envelope: EventEnvelope): Promise<void>;
  get(eventId: string): Promise<{ event: CloudMastersEvent; envelope: EventEnvelope } | null>;
  getByCorrelationId(
    correlationId: string
  ): Promise<Array<{ event: CloudMastersEvent; envelope: EventEnvelope }>>;
  getEventStream(aggregateId: string, fromVersion?: number): Promise<CloudMastersEvent[]>;
}

// Event metrics interface
export interface EventMetrics {
  eventCount: number;
  processingTime: number;
  errorCount: number;
  retryCount: number;
  lastProcessed: Date;
  averageProcessingTime: number;
  successRate: number;
}

// Event configuration
export interface EventConfig {
  redisUrl: string;
  serviceName: string;
  environment: string;
  maxRetries: number;
  defaultTimeout: number;
  enableEventStore: boolean;
  enableMetrics: boolean;
  enableDeadLetterQueue: boolean;
  enableValidation: boolean;
  channels: {
    payment: string;
    user: string;
    course: string;
    lab: string;
    admin: string;
    system: string;
  };
}
