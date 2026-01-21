import mongoose, { Schema, Document } from 'mongoose';

/**
 * Workflow Status
 */
export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

/**
 * Workflow Trigger Types
 */
export enum WorkflowTriggerType {
  LEAD_CREATED = 'lead_created',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
  SCORE_CHANGED = 'score_changed',
  EMAIL_OPENED = 'email_opened',
  EMAIL_CLICKED = 'email_clicked',
  PAGE_VISITED = 'page_visited',
  FORM_SUBMITTED = 'form_submitted',
  PURCHASE_MADE = 'purchase_made',
  FUNNEL_STEP_COMPLETED = 'funnel_step_completed',
  CHALLENGE_DAY_COMPLETED = 'challenge_day_completed',
  CUSTOM_EVENT = 'custom_event',
  SCHEDULED = 'scheduled',
  WEBHOOK = 'webhook',
  MANUAL = 'manual',
}

/**
 * Workflow Node Types
 */
export enum WorkflowNodeType {
  // Trigger (entry point)
  TRIGGER = 'trigger',

  // Actions
  SEND_EMAIL = 'send_email',
  ADD_TAG = 'add_tag',
  REMOVE_TAG = 'remove_tag',
  UPDATE_SCORE = 'update_score',
  UPDATE_FIELD = 'update_field',
  ENROLL_SEQUENCE = 'enroll_sequence',
  REMOVE_SEQUENCE = 'remove_sequence',
  ENROLL_WORKFLOW = 'enroll_workflow',
  SEND_WEBHOOK = 'send_webhook',
  SEND_NOTIFICATION = 'send_notification',
  CREATE_TASK = 'create_task',

  // Control Flow
  WAIT = 'wait',
  WAIT_UNTIL = 'wait_until',
  CONDITION = 'condition',
  SPLIT = 'split',
  GOAL = 'goal',
  EXIT = 'exit',
}

/**
 * Condition Operators
 */
export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_OR_EQUAL = 'greater_or_equal',
  LESS_OR_EQUAL = 'less_or_equal',
  IS_SET = 'is_set',
  IS_NOT_SET = 'is_not_set',
  IN_LIST = 'in_list',
  NOT_IN_LIST = 'not_in_list',
}

/**
 * Workflow Trigger Configuration
 */
export interface IWorkflowTrigger {
  type: WorkflowTriggerType;
  config: {
    // For tag_added/tag_removed
    tagName?: string;
    // For score_changed
    scoreThreshold?: number;
    scoreDirection?: 'above' | 'below' | 'crosses';
    // For email_opened/clicked
    emailTemplateId?: string;
    campaignId?: string;
    // For page_visited
    pageUrl?: string;
    pageUrlPattern?: string;
    // For form_submitted
    formId?: string;
    // For purchase_made
    productId?: string;
    minAmount?: number;
    // For funnel/challenge/form
    funnelId?: string;
    stepId?: string;
    challengeId?: string;
    dayNumber?: number;
    // For custom_event
    eventName?: string;
    // For scheduled
    schedule?: string; // cron expression
    // For webhook
    webhookSecret?: string;
  };
}

/**
 * Workflow Node Position (for visual builder)
 */
export interface INodePosition {
  x: number;
  y: number;
}

/**
 * Workflow Node Configuration
 */
export interface IWorkflowNodeConfig {
  // send_email
  templateId?: string;
  subject?: string;

  // add_tag / remove_tag
  tags?: string[];

  // update_score
  scoreChange?: number;
  scoreAction?: 'add' | 'subtract' | 'set';

  // update_field
  fieldName?: string;
  fieldValue?: string | number | boolean;

  // enroll_sequence / remove_sequence
  sequenceId?: string;

  // enroll_workflow
  workflowId?: string;

  // send_webhook
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookBody?: Record<string, any>;

  // send_notification
  notificationType?: 'email' | 'slack' | 'internal';
  notificationRecipient?: string;
  notificationMessage?: string;

  // create_task
  taskTitle?: string;
  taskDescription?: string;
  taskAssignee?: string;
  taskDueInDays?: number;

  // wait
  waitDuration?: number;
  waitUnit?: 'minutes' | 'hours' | 'days';

  // wait_until
  waitUntilTime?: string; // HH:MM format
  waitUntilDay?: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

  // condition
  conditionField?: string;
  conditionOperator?: ConditionOperator;
  conditionValue?: any;

  // split (A/B testing)
  splitVariants?: {
    id: string;
    name: string;
    weight: number; // percentage 0-100
  }[];

  // goal
  goalType?: 'tag_added' | 'purchase_made' | 'page_visited' | 'custom_event';
  goalConfig?: Record<string, any>;
}

/**
 * Workflow Node
 */
export interface IWorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: INodePosition;
  config: IWorkflowNodeConfig;
}

/**
 * Workflow Edge (connection between nodes)
 */
export interface IWorkflowEdge {
  id: string;
  source: string; // source node ID
  target: string; // target node ID
  sourceHandle?: string; // for condition nodes: 'yes' | 'no'
  label?: string;
}

/**
 * Workflow Settings
 */
export interface IWorkflowSettings {
  timezone: string;
  allowReentry: boolean;
  reentryDelay?: number; // days before lead can re-enter
  maxEnrollments?: number; // max times a lead can be enrolled
  exitOnGoal: boolean;
  businessHoursOnly: boolean;
  businessHoursStart?: number; // 0-23
  businessHoursEnd?: number; // 0-23
  skipWeekends?: boolean;
}

/**
 * Workflow Metrics
 */
export interface IWorkflowMetrics {
  totalEntered: number;
  currentlyActive: number;
  completed: number;
  exited: number;
  goalAchieved: number;
  avgTimeToComplete?: number; // in hours
}

/**
 * Workflow Interface
 */
export interface IWorkflow extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  status: WorkflowStatus;

  trigger: IWorkflowTrigger;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];

  settings: IWorkflowSettings;
  metrics: IWorkflowMetrics;

  // For organizing
  folder?: string;
  tags?: string[];

  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
}

/**
 * Node Position Schema
 */
const NodePositionSchema = new Schema<INodePosition>({
  x: { type: Number, required: true, default: 0 },
  y: { type: Number, required: true, default: 0 },
}, { _id: false });

/**
 * Node Config Schema
 */
const NodeConfigSchema = new Schema<IWorkflowNodeConfig>({
  // send_email
  templateId: { type: String },
  subject: { type: String },

  // tags
  tags: [{ type: String }],

  // score
  scoreChange: { type: Number },
  scoreAction: { type: String, enum: ['add', 'subtract', 'set'] },

  // field
  fieldName: { type: String },
  fieldValue: { type: Schema.Types.Mixed },

  // sequence/workflow
  sequenceId: { type: String },
  workflowId: { type: String },

  // webhook
  webhookUrl: { type: String },
  webhookMethod: { type: String, enum: ['GET', 'POST', 'PUT'] },
  webhookHeaders: { type: Map, of: String },
  webhookBody: { type: Schema.Types.Mixed },

  // notification
  notificationType: { type: String, enum: ['email', 'slack', 'internal'] },
  notificationRecipient: { type: String },
  notificationMessage: { type: String },

  // task
  taskTitle: { type: String },
  taskDescription: { type: String },
  taskAssignee: { type: String },
  taskDueInDays: { type: Number },

  // wait
  waitDuration: { type: Number },
  waitUnit: { type: String, enum: ['minutes', 'hours', 'days'] },

  // wait_until
  waitUntilTime: { type: String },
  waitUntilDay: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] },

  // condition
  conditionField: { type: String },
  conditionOperator: { type: String, enum: Object.values(ConditionOperator) },
  conditionValue: { type: Schema.Types.Mixed },

  // split
  splitVariants: [{
    id: { type: String, required: true },
    name: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 100 },
  }],

  // goal
  goalType: { type: String, enum: ['tag_added', 'purchase_made', 'page_visited', 'custom_event'] },
  goalConfig: { type: Schema.Types.Mixed },
}, { _id: false });

/**
 * Workflow Node Schema
 */
const WorkflowNodeSchema = new Schema<IWorkflowNode>({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: Object.values(WorkflowNodeType),
  },
  name: { type: String, required: true },
  position: { type: NodePositionSchema, required: true },
  config: { type: NodeConfigSchema, default: {} },
}, { _id: false });

/**
 * Workflow Edge Schema
 */
const WorkflowEdgeSchema = new Schema<IWorkflowEdge>({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String },
  label: { type: String },
}, { _id: false });

/**
 * Workflow Trigger Schema
 */
const WorkflowTriggerSchema = new Schema<IWorkflowTrigger>({
  type: {
    type: String,
    required: true,
    enum: Object.values(WorkflowTriggerType),
  },
  config: {
    tagName: { type: String },
    scoreThreshold: { type: Number },
    scoreDirection: { type: String, enum: ['above', 'below', 'crosses'] },
    emailTemplateId: { type: String },
    campaignId: { type: String },
    pageUrl: { type: String },
    pageUrlPattern: { type: String },
    formId: { type: String },
    funnelId: { type: String },
    stepId: { type: String },
    productId: { type: String },
    minAmount: { type: Number },
    challengeId: { type: String },
    dayNumber: { type: Number },
    eventName: { type: String },
    schedule: { type: String },
    webhookSecret: { type: String },
  },
}, { _id: false });

/**
 * Workflow Settings Schema
 */
const WorkflowSettingsSchema = new Schema<IWorkflowSettings>({
  timezone: { type: String, default: 'America/New_York' },
  allowReentry: { type: Boolean, default: false },
  reentryDelay: { type: Number, min: 0 },
  maxEnrollments: { type: Number, min: 1 },
  exitOnGoal: { type: Boolean, default: true },
  businessHoursOnly: { type: Boolean, default: false },
  businessHoursStart: { type: Number, min: 0, max: 23, default: 9 },
  businessHoursEnd: { type: Number, min: 0, max: 23, default: 17 },
  skipWeekends: { type: Boolean, default: false },
}, { _id: false });

/**
 * Workflow Metrics Schema
 */
const WorkflowMetricsSchema = new Schema<IWorkflowMetrics>({
  totalEntered: { type: Number, default: 0 },
  currentlyActive: { type: Number, default: 0 },
  completed: { type: Number, default: 0 },
  exited: { type: Number, default: 0 },
  goalAchieved: { type: Number, default: 0 },
  avgTimeToComplete: { type: Number },
}, { _id: false });

/**
 * Workflow Schema
 */
const WorkflowSchema = new Schema<IWorkflow>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    maxlength: 1000,
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(WorkflowStatus),
    default: WorkflowStatus.DRAFT,
    index: true,
  },

  trigger: {
    type: WorkflowTriggerSchema,
    required: true,
  },
  nodes: {
    type: [WorkflowNodeSchema],
    default: [],
  },
  edges: {
    type: [WorkflowEdgeSchema],
    default: [],
  },

  settings: {
    type: WorkflowSettingsSchema,
    default: () => ({}),
  },
  metrics: {
    type: WorkflowMetricsSchema,
    default: () => ({}),
  },

  folder: { type: String },
  tags: [{ type: String, trim: true }],

  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  activatedAt: { type: Date },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      // Hide webhook secret
      if (ret.trigger?.config?.webhookSecret) {
        ret.trigger.config.webhookSecret = '***';
      }
      return ret;
    },
  },
});

// Indexes
WorkflowSchema.index({ createdAt: -1 });
WorkflowSchema.index({ 'trigger.type': 1, status: 1 });
WorkflowSchema.index({ 'trigger.config.tagName': 1 });
WorkflowSchema.index({ 'trigger.config.funnelId': 1 });
WorkflowSchema.index({ 'trigger.config.challengeId': 1 });
WorkflowSchema.index({ name: 'text', description: 'text' });
WorkflowSchema.index({ folder: 1 });
WorkflowSchema.index({ tags: 1 });

// Instance methods
WorkflowSchema.methods.activate = function() {
  this.status = WorkflowStatus.ACTIVE;
  this.activatedAt = new Date();
  return this.save();
};

WorkflowSchema.methods.pause = function() {
  this.status = WorkflowStatus.PAUSED;
  return this.save();
};

WorkflowSchema.methods.archive = function() {
  this.status = WorkflowStatus.ARCHIVED;
  return this.save();
};

WorkflowSchema.methods.getNodeById = function(nodeId: string): IWorkflowNode | undefined {
  return this.nodes.find((node: IWorkflowNode) => node.id === nodeId);
};

WorkflowSchema.methods.getOutgoingEdges = function(nodeId: string): IWorkflowEdge[] {
  return this.edges.filter((edge: IWorkflowEdge) => edge.source === nodeId);
};

WorkflowSchema.methods.getNextNodes = function(nodeId: string): IWorkflowNode[] {
  const edges = this.getOutgoingEdges(nodeId);
  return edges.map((edge: IWorkflowEdge) => this.getNodeById(edge.target)).filter(Boolean);
};

// Static methods
WorkflowSchema.statics.findActiveByTrigger = function(triggerType: WorkflowTriggerType) {
  return this.find({
    'trigger.type': triggerType,
    status: WorkflowStatus.ACTIVE,
  });
};

WorkflowSchema.statics.findByTag = function(tagName: string) {
  return this.find({
    'trigger.type': { $in: [WorkflowTriggerType.TAG_ADDED, WorkflowTriggerType.TAG_REMOVED] },
    'trigger.config.tagName': tagName,
    status: WorkflowStatus.ACTIVE,
  });
};

WorkflowSchema.statics.findByFunnel = function(funnelId: string) {
  return this.find({
    'trigger.config.funnelId': funnelId,
    status: WorkflowStatus.ACTIVE,
  });
};

const WorkflowModel = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);

export { WorkflowModel as Workflow };
export default WorkflowModel;
