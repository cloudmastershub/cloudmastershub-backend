import mongoose, { Schema, Document } from 'mongoose';

/**
 * Campaign Status
 */
export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

/**
 * Campaign Type
 */
export enum CampaignType {
  BROADCAST = 'broadcast',      // One-time send to all/segment
  NEWSLETTER = 'newsletter',    // Regular newsletter
  ANNOUNCEMENT = 'announcement', // Important announcement
  PROMOTION = 'promotion',      // Sales/promotional email
  RE_ENGAGEMENT = 're_engagement', // Win-back campaign
}

/**
 * Segment Filter Condition
 */
export interface ISegmentCondition {
  field: string;                // Lead field to filter on
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' |
            'greater_than' | 'less_than' | 'in' | 'not_in' |
            'exists' | 'not_exists' | 'before' | 'after';
  value: any;
}

/**
 * A/B Test Variant
 */
export interface ICampaignVariant {
  id: string;
  name: string;
  templateId: string;
  subject?: string;  // Override subject
  weight: number;    // Percentage of audience (0-100)
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    openRate: number;
    clickRate: number;
  };
}

/**
 * Email Campaign Interface
 */
export interface IEmailCampaign extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: CampaignType;
  status: CampaignStatus;

  // Email content
  templateId: string;
  subject: string;
  preheader?: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;

  // A/B Testing
  abTest?: {
    enabled: boolean;
    winnerCriteria: 'open_rate' | 'click_rate';
    testDuration: number;  // Hours before picking winner
    testPercentage: number; // Percentage of audience for test
    variants: ICampaignVariant[];
    winnerId?: string;
    winnerSelectedAt?: Date;
  };

  // Audience targeting
  audience: {
    type: 'all' | 'segment' | 'list' | 'tag';
    segmentConditions?: ISegmentCondition[];
    listId?: string;
    tags?: string[];
    excludeTags?: string[];
    excludeUnsubscribed: boolean;
    excludeBounced: boolean;
    estimatedCount?: number;
  };

  // Scheduling
  scheduling: {
    sendAt?: Date;           // Null = send immediately
    timezone: string;
    sendInRecipientTimezone: boolean;
    optimalSendTime: boolean; // AI-determined best time
  };

  // Metrics
  metrics: {
    totalRecipients: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    complained: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    unsubscribeRate: number;
  };

  // Progress tracking
  progress: {
    startedAt?: Date;
    completedAt?: Date;
    processedCount: number;
    errorCount: number;
    lastProcessedAt?: Date;
  };

  // Template context (merged with lead data)
  templateContext?: Record<string, any>;

  // Tags for organization
  tags?: string[];

  // Metadata
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  updateRates(): void;
}

/**
 * Segment Condition Schema
 */
const SegmentConditionSchema = new Schema<ISegmentCondition>({
  field: { type: String, required: true },
  operator: {
    type: String,
    required: true,
    enum: ['equals', 'not_equals', 'contains', 'not_contains',
           'greater_than', 'less_than', 'in', 'not_in',
           'exists', 'not_exists', 'before', 'after'],
  },
  value: { type: Schema.Types.Mixed },
}, { _id: false });

/**
 * Campaign Variant Schema
 */
const CampaignVariantSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  templateId: { type: String, required: true },
  subject: { type: String },
  weight: { type: Number, required: true, min: 0, max: 100 },
  metrics: {
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
  },
}, { _id: false });

/**
 * Email Campaign Schema
 */
const EmailCampaignSchema = new Schema<IEmailCampaign>({
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
  type: {
    type: String,
    required: true,
    enum: Object.values(CampaignType),
    default: CampaignType.BROADCAST,
    index: true,
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(CampaignStatus),
    default: CampaignStatus.DRAFT,
    index: true,
  },

  // Email content
  templateId: { type: String, required: true },
  subject: { type: String, required: true, maxlength: 200 },
  preheader: { type: String, maxlength: 200 },
  fromName: { type: String, required: true, default: 'CloudMasters Hub' },
  fromEmail: { type: String, required: true },
  replyTo: { type: String },

  // A/B Testing
  abTest: {
    enabled: { type: Boolean, default: false },
    winnerCriteria: {
      type: String,
      enum: ['open_rate', 'click_rate'],
      default: 'open_rate',
    },
    testDuration: { type: Number, min: 1, max: 72, default: 4 }, // Hours
    testPercentage: { type: Number, min: 10, max: 50, default: 20 },
    variants: [CampaignVariantSchema],
    winnerId: { type: String },
    winnerSelectedAt: { type: Date },
  },

  // Audience
  audience: {
    type: {
      type: String,
      required: true,
      enum: ['all', 'segment', 'list', 'tag'],
      default: 'all',
    },
    segmentConditions: [SegmentConditionSchema],
    listId: { type: String },
    tags: [{ type: String }],
    excludeTags: [{ type: String }],
    excludeUnsubscribed: { type: Boolean, default: true },
    excludeBounced: { type: Boolean, default: true },
    estimatedCount: { type: Number },
  },

  // Scheduling
  scheduling: {
    sendAt: { type: Date, index: true },
    timezone: { type: String, default: 'America/New_York' },
    sendInRecipientTimezone: { type: Boolean, default: false },
    optimalSendTime: { type: Boolean, default: false },
  },

  // Metrics
  metrics: {
    totalRecipients: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    unsubscribed: { type: Number, default: 0 },
    complained: { type: Number, default: 0 },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    unsubscribeRate: { type: Number, default: 0 },
  },

  // Progress
  progress: {
    startedAt: { type: Date },
    completedAt: { type: Date },
    processedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    lastProcessedAt: { type: Date },
  },

  // Template context
  templateContext: { type: Schema.Types.Mixed },

  // Tags
  tags: [{ type: String, trim: true }],

  // Metadata
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
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

// Indexes
EmailCampaignSchema.index({ createdAt: -1 });
EmailCampaignSchema.index({ 'scheduling.sendAt': 1, status: 1 });
EmailCampaignSchema.index({ name: 'text', description: 'text' });

// Instance methods
EmailCampaignSchema.methods.schedule = function(sendAt: Date) {
  this.status = CampaignStatus.SCHEDULED;
  this.scheduling.sendAt = sendAt;
  return this.save();
};

EmailCampaignSchema.methods.start = function() {
  this.status = CampaignStatus.SENDING;
  this.progress.startedAt = new Date();
  return this.save();
};

EmailCampaignSchema.methods.complete = function() {
  this.status = CampaignStatus.SENT;
  this.progress.completedAt = new Date();
  this.updateRates();
  return this.save();
};

EmailCampaignSchema.methods.pause = function() {
  this.status = CampaignStatus.PAUSED;
  return this.save();
};

EmailCampaignSchema.methods.cancel = function() {
  this.status = CampaignStatus.CANCELLED;
  return this.save();
};

EmailCampaignSchema.methods.updateRates = function() {
  const m = this.metrics;
  m.openRate = m.delivered > 0 ? (m.opened / m.delivered) * 100 : 0;
  m.clickRate = m.delivered > 0 ? (m.clicked / m.delivered) * 100 : 0;
  m.bounceRate = m.sent > 0 ? (m.bounced / m.sent) * 100 : 0;
  m.unsubscribeRate = m.delivered > 0 ? (m.unsubscribed / m.delivered) * 100 : 0;
};

EmailCampaignSchema.methods.incrementMetric = async function(
  metric: 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'complained'
) {
  const update: Record<string, number> = { [`metrics.${metric}`]: 1 };

  if (metric === 'sent') {
    update['progress.processedCount'] = 1;
    await this.updateOne({
      $inc: update,
      $set: { 'progress.lastProcessedAt': new Date() },
    });
  } else {
    await this.updateOne({ $inc: update });
  }
};

// Static methods
EmailCampaignSchema.statics.findScheduled = function() {
  return this.find({
    status: CampaignStatus.SCHEDULED,
    'scheduling.sendAt': { $lte: new Date() },
  });
};

EmailCampaignSchema.statics.findInProgress = function() {
  return this.find({
    status: CampaignStatus.SENDING,
  });
};

EmailCampaignSchema.statics.getStats = async function(startDate?: Date, endDate?: Date) {
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
        totalSent: { $sum: '$metrics.sent' },
        totalOpened: { $sum: '$metrics.opened' },
        totalClicked: { $sum: '$metrics.clicked' },
      },
    },
  ]);

  return stats;
};

const EmailCampaignModel = mongoose.model<IEmailCampaign>('EmailCampaign', EmailCampaignSchema);

export { EmailCampaignModel as EmailCampaign };
export default EmailCampaignModel;
