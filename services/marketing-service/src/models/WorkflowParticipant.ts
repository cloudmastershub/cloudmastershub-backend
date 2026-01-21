import mongoose, { Schema, Document } from 'mongoose';

/**
 * Workflow Participant Status
 */
export enum WorkflowParticipantStatus {
  ACTIVE = 'active',       // Currently in workflow
  WAITING = 'waiting',     // Waiting at a wait node
  COMPLETED = 'completed', // Finished all nodes
  EXITED = 'exited',       // Exited early (removed, goal achieved, etc.)
  FAILED = 'failed',       // Error during execution
}

/**
 * Workflow Log Entry
 */
export interface IWorkflowLogEntry {
  nodeId: string;
  nodeType: string;
  nodeName: string;
  action: 'entered' | 'executed' | 'skipped' | 'waiting' | 'completed' | 'failed';
  result?: string;
  error?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Workflow Participant Interface
 */
export interface IWorkflowParticipant extends Document {
  _id: mongoose.Types.ObjectId;
  workflowId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;

  status: WorkflowParticipantStatus;
  currentNodeId?: string;

  // Tracking
  enteredAt: Date;
  completedAt?: Date;
  exitedAt?: Date;
  exitReason?: string;

  // For wait nodes
  waitingUntil?: Date;

  // For split/condition tracking
  branchPath?: string[]; // Track which branches were taken
  splitVariantId?: string; // Which A/B variant was assigned

  // Goal tracking
  goalAchieved: boolean;
  goalAchievedAt?: Date;

  // Execution log
  log: IWorkflowLogEntry[];

  // Metadata
  triggerData?: Record<string, any>; // Data from the trigger event
  enrollmentCount: number; // How many times enrolled in this workflow

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Workflow Log Entry Schema
 */
const WorkflowLogEntrySchema = new Schema<IWorkflowLogEntry>({
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  nodeName: { type: String, required: true },
  action: {
    type: String,
    required: true,
    enum: ['entered', 'executed', 'skipped', 'waiting', 'completed', 'failed'],
  },
  result: { type: String },
  error: { type: String },
  timestamp: { type: Date, required: true, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

/**
 * Workflow Participant Schema
 */
const WorkflowParticipantSchema = new Schema<IWorkflowParticipant>({
  workflowId: {
    type: Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
    index: true,
  },
  leadId: {
    type: Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    index: true,
  },

  status: {
    type: String,
    required: true,
    enum: Object.values(WorkflowParticipantStatus),
    default: WorkflowParticipantStatus.ACTIVE,
    index: true,
  },
  currentNodeId: { type: String },

  enteredAt: { type: Date, required: true, default: Date.now },
  completedAt: { type: Date },
  exitedAt: { type: Date },
  exitReason: { type: String },

  waitingUntil: { type: Date, index: true },

  branchPath: [{ type: String }],
  splitVariantId: { type: String },

  goalAchieved: { type: Boolean, default: false },
  goalAchievedAt: { type: Date },

  log: {
    type: [WorkflowLogEntrySchema],
    default: [],
  },

  triggerData: { type: Schema.Types.Mixed },
  enrollmentCount: { type: Number, default: 1 },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.workflowId = ret.workflowId.toString();
      ret.leadId = ret.leadId.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Compound indexes
WorkflowParticipantSchema.index({ workflowId: 1, leadId: 1 });
WorkflowParticipantSchema.index({ workflowId: 1, status: 1 });
WorkflowParticipantSchema.index({ leadId: 1, status: 1 });
WorkflowParticipantSchema.index({ status: 1, waitingUntil: 1 }); // For processing waiting participants

// Instance methods
WorkflowParticipantSchema.methods.addLog = function(entry: Omit<IWorkflowLogEntry, 'timestamp'>) {
  this.log.push({
    ...entry,
    timestamp: new Date(),
  });
  return this;
};

WorkflowParticipantSchema.methods.moveToNode = function(nodeId: string) {
  this.currentNodeId = nodeId;
  this.status = WorkflowParticipantStatus.ACTIVE;
  this.waitingUntil = undefined;
  return this;
};

WorkflowParticipantSchema.methods.setWaiting = function(until: Date) {
  this.status = WorkflowParticipantStatus.WAITING;
  this.waitingUntil = until;
  return this;
};

WorkflowParticipantSchema.methods.complete = function() {
  this.status = WorkflowParticipantStatus.COMPLETED;
  this.completedAt = new Date();
  this.currentNodeId = undefined;
  return this;
};

WorkflowParticipantSchema.methods.exit = function(reason: string) {
  this.status = WorkflowParticipantStatus.EXITED;
  this.exitedAt = new Date();
  this.exitReason = reason;
  this.currentNodeId = undefined;
  return this;
};

WorkflowParticipantSchema.methods.fail = function(error: string) {
  this.status = WorkflowParticipantStatus.FAILED;
  this.exitedAt = new Date();
  this.exitReason = `Error: ${error}`;
  return this;
};

WorkflowParticipantSchema.methods.achieveGoal = function() {
  this.goalAchieved = true;
  this.goalAchievedAt = new Date();
  return this;
};

// Static methods
WorkflowParticipantSchema.statics.findActiveByWorkflow = function(workflowId: string) {
  return this.find({
    workflowId,
    status: { $in: [WorkflowParticipantStatus.ACTIVE, WorkflowParticipantStatus.WAITING] },
  });
};

WorkflowParticipantSchema.statics.findByLead = function(leadId: string) {
  return this.find({ leadId }).sort({ enteredAt: -1 });
};

WorkflowParticipantSchema.statics.findWaitingToProcess = function() {
  return this.find({
    status: WorkflowParticipantStatus.WAITING,
    waitingUntil: { $lte: new Date() },
  });
};

WorkflowParticipantSchema.statics.isLeadInWorkflow = async function(
  workflowId: string,
  leadId: string
): Promise<boolean> {
  const count = await this.countDocuments({
    workflowId,
    leadId,
    status: { $in: [WorkflowParticipantStatus.ACTIVE, WorkflowParticipantStatus.WAITING] },
  });
  return count > 0;
};

WorkflowParticipantSchema.statics.getWorkflowStats = async function(workflowId: string) {
  const stats = await this.aggregate([
    { $match: { workflowId: new mongoose.Types.ObjectId(workflowId) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    active: 0,
    waiting: 0,
    completed: 0,
    exited: 0,
    failed: 0,
    goalAchieved: 0,
  };

  for (const stat of stats) {
    if (stat._id in result) {
      result[stat._id as keyof typeof result] = stat.count;
    }
  }

  // Count goal achieved separately
  const goalCount = await this.countDocuments({
    workflowId,
    goalAchieved: true,
  });
  result.goalAchieved = goalCount;

  return result;
};

const WorkflowParticipantModel = mongoose.model<IWorkflowParticipant>(
  'WorkflowParticipant',
  WorkflowParticipantSchema
);

export { WorkflowParticipantModel as WorkflowParticipant };
export default WorkflowParticipantModel;
