import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Email Job Status
 */
export enum EmailJobStatus {
  PENDING = 'pending',       // Waiting to be sent
  SCHEDULED = 'scheduled',   // Scheduled for future delivery
  PROCESSING = 'processing', // Currently being sent
  SENT = 'sent',            // Successfully sent
  DELIVERED = 'delivered',  // Confirmed delivered
  OPENED = 'opened',        // Email was opened
  CLICKED = 'clicked',      // Link was clicked
  FAILED = 'failed',        // Send failed
  BOUNCED = 'bounced',      // Email bounced
  SKIPPED = 'skipped',      // Skipped due to conditions
  CANCELLED = 'cancelled',  // Manually cancelled
}

/**
 * Email Job Type
 */
export enum EmailJobType {
  SEQUENCE = 'sequence',        // Part of an email sequence
  CAMPAIGN = 'campaign',        // One-time campaign broadcast
  TRANSACTIONAL = 'transactional', // Transaction/confirmation email
  TRIGGER = 'trigger',          // Triggered by event
}

/**
 * Email Queue Job Interface
 */
export interface IEmailQueueJob extends Document {
  _id: mongoose.Types.ObjectId;

  // Job identification
  type: EmailJobType;

  // Recipient
  leadId: mongoose.Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;

  // Email content reference
  templateId: string;
  subject?: string;  // Override template subject if needed

  // Context for template rendering
  templateContext: Record<string, any>;

  // Source reference
  sequenceId?: mongoose.Types.ObjectId;
  sequenceEmailOrder?: number;
  campaignId?: mongoose.Types.ObjectId;
  funnelId?: mongoose.Types.ObjectId;
  challengeId?: mongoose.Types.ObjectId;

  // Scheduling
  scheduledFor: Date;
  timezone?: string;

  // Processing
  status: EmailJobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextAttemptAt?: Date;

  // Results
  messageId?: string;       // Mailgun message ID
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  bouncedAt?: Date;
  bounceType?: 'soft' | 'hard';
  bounceReason?: string;

  // Error tracking
  errorMessage?: string;
  errorCode?: string;

  // Skip reason (if skipped)
  skipReason?: string;

  // Metadata
  tags?: string[];
  metadata?: Record<string, any>;

  // Bull.js job reference
  bullJobId?: string;

  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  markSent(messageId: string): Promise<IEmailQueueJob>;
  markDelivered(): Promise<IEmailQueueJob>;
  markOpened(): Promise<IEmailQueueJob>;
  markClicked(): Promise<IEmailQueueJob>;
  markBounced(type: 'soft' | 'hard', reason: string): Promise<IEmailQueueJob>;
  markFailed(errorMessage: string, errorCode?: string): Promise<IEmailQueueJob>;
  markSkipped(reason: string): Promise<IEmailQueueJob>;
}

/**
 * Email Queue Job Document Type (for better compatibility with findById etc)
 */
export type EmailQueueJobDocument = mongoose.Document<unknown, {}, IEmailQueueJob> & IEmailQueueJob & Required<{ _id: mongoose.Types.ObjectId }>;

/**
 * Email Queue Job Model Interface (static methods)
 */
export interface IEmailQueueJobModel extends Model<IEmailQueueJob> {
  findPendingJobs(limit?: number): Promise<EmailQueueJobDocument[]>;
  findByMessageId(messageId: string): Promise<EmailQueueJobDocument | null>;
  getSequenceJobsForLead(
    sequenceId: mongoose.Types.ObjectId,
    leadId: mongoose.Types.ObjectId
  ): Promise<EmailQueueJobDocument[]>;
  cancelPendingForLead(
    leadId: mongoose.Types.ObjectId,
    sequenceId?: mongoose.Types.ObjectId
  ): Promise<{ modifiedCount: number }>;
  getStats(startDate?: Date, endDate?: Date): Promise<Record<string, number>>;
}

/**
 * Email Queue Job Schema
 */
const EmailQueueJobSchema = new Schema<IEmailQueueJob>({
  type: {
    type: String,
    required: true,
    enum: Object.values(EmailJobType),
    index: true,
  },

  // Recipient
  leadId: {
    type: Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    index: true,
  },
  firstName: { type: String, trim: true },
  lastName: { type: String, trim: true },

  // Email content
  templateId: {
    type: String,
    required: true,
  },
  subject: { type: String },
  templateContext: {
    type: Schema.Types.Mixed,
    default: {},
  },

  // Source references
  sequenceId: {
    type: Schema.Types.ObjectId,
    ref: 'EmailSequence',
    index: true,
  },
  sequenceEmailOrder: { type: Number },
  campaignId: {
    type: Schema.Types.ObjectId,
    ref: 'EmailCampaign',
    index: true,
  },
  funnelId: {
    type: Schema.Types.ObjectId,
    ref: 'Funnel',
    index: true,
  },
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge',
    index: true,
  },

  // Scheduling
  scheduledFor: {
    type: Date,
    required: true,
    index: true,
  },
  timezone: { type: String, default: 'UTC' },

  // Processing
  status: {
    type: String,
    required: true,
    enum: Object.values(EmailJobStatus),
    default: EmailJobStatus.PENDING,
    index: true,
  },
  attempts: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 3 },
  lastAttemptAt: { type: Date },
  nextAttemptAt: { type: Date },

  // Results
  messageId: { type: String, index: true },
  sentAt: { type: Date },
  deliveredAt: { type: Date },
  openedAt: { type: Date },
  clickedAt: { type: Date },
  bouncedAt: { type: Date },
  bounceType: {
    type: String,
    enum: ['soft', 'hard'],
  },
  bounceReason: { type: String },

  // Errors
  errorMessage: { type: String },
  errorCode: { type: String },

  // Skip reason
  skipReason: { type: String },

  // Metadata
  tags: [{ type: String }],
  metadata: { type: Schema.Types.Mixed },

  // Bull.js reference
  bullJobId: { type: String, index: true },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Compound indexes for efficient queries
EmailQueueJobSchema.index({ status: 1, scheduledFor: 1 });
EmailQueueJobSchema.index({ sequenceId: 1, leadId: 1 });
EmailQueueJobSchema.index({ status: 1, type: 1 });
EmailQueueJobSchema.index({ createdAt: -1 });

// Instance methods
EmailQueueJobSchema.methods.markSent = function(messageId: string) {
  this.status = EmailJobStatus.SENT;
  this.messageId = messageId;
  this.sentAt = new Date();
  return this.save();
};

EmailQueueJobSchema.methods.markDelivered = function() {
  this.status = EmailJobStatus.DELIVERED;
  this.deliveredAt = new Date();
  return this.save();
};

EmailQueueJobSchema.methods.markOpened = function() {
  if (this.status !== EmailJobStatus.CLICKED) {
    this.status = EmailJobStatus.OPENED;
  }
  this.openedAt = this.openedAt || new Date();
  return this.save();
};

EmailQueueJobSchema.methods.markClicked = function() {
  this.status = EmailJobStatus.CLICKED;
  this.clickedAt = this.clickedAt || new Date();
  if (!this.openedAt) {
    this.openedAt = new Date();
  }
  return this.save();
};

EmailQueueJobSchema.methods.markBounced = function(type: 'soft' | 'hard', reason: string) {
  this.status = EmailJobStatus.BOUNCED;
  this.bouncedAt = new Date();
  this.bounceType = type;
  this.bounceReason = reason;
  return this.save();
};

EmailQueueJobSchema.methods.markFailed = function(errorMessage: string, errorCode?: string) {
  this.attempts += 1;
  this.lastAttemptAt = new Date();

  if (this.attempts >= this.maxAttempts) {
    this.status = EmailJobStatus.FAILED;
  } else {
    // Exponential backoff: 5min, 30min, 2hrs
    const delays = [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000];
    const delay = delays[Math.min(this.attempts - 1, delays.length - 1)];
    this.nextAttemptAt = new Date(Date.now() + delay);
    this.status = EmailJobStatus.PENDING;
  }

  this.errorMessage = errorMessage;
  this.errorCode = errorCode;
  return this.save();
};

EmailQueueJobSchema.methods.markSkipped = function(reason: string) {
  this.status = EmailJobStatus.SKIPPED;
  this.skipReason = reason;
  return this.save();
};

// Static methods
EmailQueueJobSchema.statics.findPendingJobs = function(limit: number = 100) {
  return this.find({
    status: { $in: [EmailJobStatus.PENDING, EmailJobStatus.SCHEDULED] },
    scheduledFor: { $lte: new Date() },
    $or: [
      { nextAttemptAt: null },
      { nextAttemptAt: { $lte: new Date() } },
    ],
  })
    .sort({ scheduledFor: 1 })
    .limit(limit);
};

EmailQueueJobSchema.statics.findByMessageId = function(messageId: string) {
  return this.findOne({ messageId });
};

EmailQueueJobSchema.statics.getSequenceJobsForLead = function(
  sequenceId: mongoose.Types.ObjectId,
  leadId: mongoose.Types.ObjectId
) {
  return this.find({ sequenceId, leadId }).sort({ sequenceEmailOrder: 1 });
};

EmailQueueJobSchema.statics.cancelPendingForLead = async function(
  leadId: mongoose.Types.ObjectId,
  sequenceId?: mongoose.Types.ObjectId
) {
  const query: any = {
    leadId,
    status: { $in: [EmailJobStatus.PENDING, EmailJobStatus.SCHEDULED] },
  };
  if (sequenceId) {
    query.sequenceId = sequenceId;
  }

  return this.updateMany(query, {
    status: EmailJobStatus.CANCELLED,
    skipReason: 'Cancelled due to lead action',
  });
};

EmailQueueJobSchema.statics.getStats = async function(startDate?: Date, endDate?: Date) {
  const match: any = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = startDate;
    if (endDate) match.createdAt.$lte = endDate;
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result: Record<string, number> = {
    total: 0,
    pending: 0,
    sent: 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    failed: 0,
    skipped: 0,
  };

  stats.forEach((s: { _id: string; count: number }) => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return result;
};

const EmailQueueJobModel = mongoose.model<IEmailQueueJob, IEmailQueueJobModel>('EmailQueueJob', EmailQueueJobSchema);

export { EmailQueueJobModel as EmailQueueJob };
export default EmailQueueJobModel;
