import mongoose, { Schema, Document, Model } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin';

/**
 * Lead Source Types
 */
export enum LeadSource {
  FUNNEL = 'funnel',
  LANDING_PAGE = 'landing_page',
  POPUP = 'popup',
  REFERRAL = 'referral',
  ORGANIC = 'organic',
  PAID_AD = 'paid_ad',
  SOCIAL = 'social',
  EMAIL = 'email',
  WEBINAR = 'webinar',
  CHALLENGE = 'challenge',
  DIRECT = 'direct',
  API = 'api',
}

/**
 * Lead Status
 */
export enum LeadStatus {
  NEW = 'new',
  ENGAGED = 'engaged',
  QUALIFIED = 'qualified',
  CONVERTED = 'converted',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced',
  INACTIVE = 'inactive',
}

/**
 * Lead Score Level
 */
export enum LeadScoreLevel {
  COLD = 'cold',         // 0-25
  WARM = 'warm',         // 26-50
  HOT = 'hot',           // 51-75
  VERY_HOT = 'very_hot', // 76-100
}

/**
 * Lead Activity
 */
export interface ILeadActivity {
  type: 'page_view' | 'email_open' | 'email_click' | 'form_submit' | 'video_watch' |
        'download' | 'purchase' | 'webinar_attend' | 'challenge_start' | 'challenge_complete';
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Lead Interface
 */
export interface ILead extends Document {
  _id: mongoose.Types.ObjectId;

  // Contact information
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  jobTitle?: string;

  // Source tracking
  source: {
    type: LeadSource;
    funnelId?: string;
    landingPageId?: string;
    challengeId?: string;
    referralCode?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  };

  // Scoring
  score: number;                  // 0-100
  scoreLevel: LeadScoreLevel;
  scoreHistory: {
    score: number;
    reason: string;
    timestamp: Date;
  }[];

  // Status tracking
  status: LeadStatus;
  statusHistory: {
    status: LeadStatus;
    timestamp: Date;
    reason?: string;
  }[];

  // Tags for segmentation
  tags: string[];

  // Activity tracking
  activities: ILeadActivity[];
  lastActivityAt?: Date;

  // Email engagement
  email_engagement: {
    emailsReceived: number;
    emailsOpened: number;
    emailsClicked: number;
    lastEmailReceivedAt?: Date;
    lastEmailOpenedAt?: Date;
    lastEmailClickedAt?: Date;
    openRate: number;
    clickRate: number;
  };

  // Conversion tracking
  conversion: {
    userId?: string;              // CloudMastersHub user ID if converted
    convertedAt?: Date;
    purchaseIds?: string[];
    totalSpent?: number;
    subscriptionPlan?: string;
  };

  // Email preferences
  emailConsent: boolean;
  emailConsentAt?: Date;
  unsubscribedAt?: Date;
  unsubscribeReason?: string;

  // Custom fields
  customFields?: Record<string, string | number | boolean>;

  // Sequences enrolled
  sequences: {
    sequenceId: string;
    enrolledAt: Date;
    currentEmailOrder: number;
    completedAt?: Date;
    exitedAt?: Date;
    exitReason?: string;
  }[];

  // Metadata
  ipAddress?: string;
  userAgent?: string;
  timezone?: string;
  country?: string;
  city?: string;

  capturedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  addScore(points: number, reason: string): void;
  updateScoreLevel(): void;
  updateStatus(newStatus: LeadStatus, reason?: string): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  recordActivity(type: ILeadActivity['type'], metadata?: Record<string, any>): void;
  recordEmailOpen(): void;
  recordEmailClick(metadata?: Record<string, any>): void;
  markConverted(userId: string, purchaseId?: string, amount?: number): void;
  unsubscribe(reason?: string): void;
}

/**
 * Lead Model Interface (static methods)
 */
export interface ILeadModel extends Model<ILead> {
  findByEmail(email: string): Promise<ILead | null>;
  findByTag(tag: string): Promise<ILead[]>;
  findByScoreLevel(level: LeadScoreLevel): Promise<ILead[]>;
  findByFunnel(funnelId: string): Promise<ILead[]>;
  findSubscribed(): Promise<ILead[]>;
  getStats(): Promise<{
    total: number;
    newLeads: number;
    engaged: number;
    qualified: number;
    converted: number;
    unsubscribed: number;
    avgScore: number;
    totalRevenue: number;
  }>;
}

/**
 * Lead Activity Schema
 */
const LeadActivitySchema = new Schema<ILeadActivity>({
  type: {
    type: String,
    required: true,
    enum: ['page_view', 'email_open', 'email_click', 'form_submit', 'video_watch',
           'download', 'purchase', 'webinar_attend', 'challenge_start', 'challenge_complete'],
  },
  timestamp: { type: Date, required: true, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
}, { _id: false });

/**
 * Lead Schema
 */
const LeadSchema = new Schema<ILead>({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  phone: {
    type: String,
    trim: true,
  },
  company: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  jobTitle: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  source: {
    type: {
      type: String,
      required: true,
      enum: Object.values(LeadSource),
      default: LeadSource.DIRECT,
    },
    funnelId: { type: String, index: true },
    landingPageId: { type: String },
    challengeId: { type: String, index: true },
    referralCode: { type: String, index: true },
    utmSource: { type: String },
    utmMedium: { type: String },
    utmCampaign: { type: String },
    utmContent: { type: String },
    utmTerm: { type: String },
  },
  score: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true,
  },
  scoreLevel: {
    type: String,
    enum: Object.values(LeadScoreLevel),
    default: LeadScoreLevel.COLD,
    index: true,
  },
  scoreHistory: [{
    score: { type: Number, required: true },
    reason: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  }],
  status: {
    type: String,
    required: true,
    enum: Object.values(LeadStatus),
    default: LeadStatus.NEW,
    index: true,
  },
  statusHistory: [{
    status: { type: String, required: true, enum: Object.values(LeadStatus) },
    timestamp: { type: Date, default: Date.now },
    reason: { type: String },
  }],
  tags: {
    type: [String],
    default: [],
    index: true,
  },
  activities: {
    type: [LeadActivitySchema],
    default: [],
  },
  lastActivityAt: {
    type: Date,
    index: true,
  },
  email_engagement: {
    emailsReceived: { type: Number, default: 0 },
    emailsOpened: { type: Number, default: 0 },
    emailsClicked: { type: Number, default: 0 },
    lastEmailReceivedAt: { type: Date },
    lastEmailOpenedAt: { type: Date },
    lastEmailClickedAt: { type: Date },
    openRate: { type: Number, default: 0 },
    clickRate: { type: Number, default: 0 },
  },
  conversion: {
    userId: { type: String, index: true, sparse: true },
    convertedAt: { type: Date },
    purchaseIds: [{ type: String }],
    totalSpent: { type: Number, default: 0 },
    subscriptionPlan: { type: String },
  },
  emailConsent: {
    type: Boolean,
    default: true,
  },
  emailConsentAt: { type: Date },
  unsubscribedAt: { type: Date },
  unsubscribeReason: { type: String },
  customFields: {
    type: Schema.Types.Mixed,
  },
  sequences: [{
    sequenceId: { type: String, required: true },
    enrolledAt: { type: Date, required: true },
    currentEmailOrder: { type: Number, default: 0 },
    completedAt: { type: Date },
    exitedAt: { type: Date },
    exitReason: { type: String },
  }],
  ipAddress: { type: String },
  userAgent: { type: String },
  timezone: { type: String },
  country: { type: String },
  city: { type: String },
  capturedAt: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
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
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Tenant plugin (adds tenantId field + auto-scoped queries)
LeadSchema.plugin(tenantPlugin);

// Indexes
LeadSchema.index({ email: 1, tenantId: 1 }, { unique: true });
LeadSchema.index({ capturedAt: -1 });
LeadSchema.index({ 'source.utmCampaign': 1 });
LeadSchema.index({ 'conversion.convertedAt': 1 });
LeadSchema.index({ firstName: 'text', lastName: 'text', email: 'text', company: 'text' });

// Instance methods
LeadSchema.methods.addScore = function(points: number, reason: string): void {
  this.score = Math.min(100, Math.max(0, this.score + points));
  this.scoreHistory.push({
    score: this.score,
    reason,
    timestamp: new Date(),
  });
  this.updateScoreLevel();
};

LeadSchema.methods.updateScoreLevel = function(): void {
  if (this.score >= 76) {
    this.scoreLevel = LeadScoreLevel.VERY_HOT;
  } else if (this.score >= 51) {
    this.scoreLevel = LeadScoreLevel.HOT;
  } else if (this.score >= 26) {
    this.scoreLevel = LeadScoreLevel.WARM;
  } else {
    this.scoreLevel = LeadScoreLevel.COLD;
  }
};

LeadSchema.methods.updateStatus = function(newStatus: LeadStatus, reason?: string): void {
  if (this.status !== newStatus) {
    this.status = newStatus;
    this.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      reason,
    });
  }
};

LeadSchema.methods.addTag = function(tag: string): void {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
};

LeadSchema.methods.removeTag = function(tag: string): void {
  this.tags = this.tags.filter((t: string) => t !== tag);
};

LeadSchema.methods.recordActivity = function(type: ILeadActivity['type'], metadata?: Record<string, any>): void {
  this.activities.push({
    type,
    timestamp: new Date(),
    metadata,
  });
  this.lastActivityAt = new Date();

  // Auto-update status based on activity
  if (this.status === LeadStatus.NEW && type !== 'page_view') {
    this.updateStatus(LeadStatus.ENGAGED, `Activity: ${type}`);
  }

  // Auto-score based on activity
  const scoreMap: Record<string, number> = {
    page_view: 1,
    email_open: 3,
    email_click: 5,
    form_submit: 10,
    video_watch: 5,
    download: 8,
    webinar_attend: 15,
    challenge_start: 10,
    challenge_complete: 20,
    purchase: 50,
  };

  if (scoreMap[type]) {
    this.addScore(scoreMap[type], `Activity: ${type}`);
  }
};

LeadSchema.methods.recordEmailOpen = function(): void {
  this.email_engagement.emailsOpened += 1;
  this.email_engagement.lastEmailOpenedAt = new Date();
  this.email_engagement.openRate = this.email_engagement.emailsReceived > 0
    ? (this.email_engagement.emailsOpened / this.email_engagement.emailsReceived) * 100
    : 0;
  this.recordActivity('email_open');
};

LeadSchema.methods.recordEmailClick = function(metadata?: Record<string, any>): void {
  this.email_engagement.emailsClicked += 1;
  this.email_engagement.lastEmailClickedAt = new Date();
  this.email_engagement.clickRate = this.email_engagement.emailsReceived > 0
    ? (this.email_engagement.emailsClicked / this.email_engagement.emailsReceived) * 100
    : 0;
  this.recordActivity('email_click', metadata);
};

LeadSchema.methods.markConverted = function(userId: string, purchaseId?: string, amount?: number): void {
  this.updateStatus(LeadStatus.CONVERTED, 'Converted to customer');
  this.conversion.userId = userId;
  this.conversion.convertedAt = new Date();
  if (purchaseId) {
    this.conversion.purchaseIds = this.conversion.purchaseIds || [];
    this.conversion.purchaseIds.push(purchaseId);
  }
  if (amount) {
    this.conversion.totalSpent = (this.conversion.totalSpent || 0) + amount;
  }
  this.addScore(50, 'Converted to customer');
  this.recordActivity('purchase', { purchaseId, amount });
};

LeadSchema.methods.unsubscribe = function(reason?: string): void {
  this.updateStatus(LeadStatus.UNSUBSCRIBED, reason || 'User unsubscribed');
  this.emailConsent = false;
  this.unsubscribedAt = new Date();
  this.unsubscribeReason = reason;
};

// Static methods
LeadSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

LeadSchema.statics.findByTag = function(tag: string) {
  return this.find({ tags: tag });
};

LeadSchema.statics.findByScoreLevel = function(level: LeadScoreLevel) {
  return this.find({ scoreLevel: level });
};

LeadSchema.statics.findByFunnel = function(funnelId: string) {
  return this.find({ 'source.funnelId': funnelId });
};

LeadSchema.statics.findSubscribed = function() {
  return this.find({
    emailConsent: true,
    status: { $nin: [LeadStatus.UNSUBSCRIBED, LeadStatus.BOUNCED] },
  });
};

LeadSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        newLeads: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.NEW] }, 1, 0] } },
        engaged: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.ENGAGED] }, 1, 0] } },
        qualified: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.QUALIFIED] }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] } },
        unsubscribed: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.UNSUBSCRIBED] }, 1, 0] } },
        avgScore: { $avg: '$score' },
        totalRevenue: { $sum: '$conversion.totalSpent' },
      },
    },
  ]);

  return stats[0] || {
    total: 0,
    newLeads: 0,
    engaged: 0,
    qualified: 0,
    converted: 0,
    unsubscribed: 0,
    avgScore: 0,
    totalRevenue: 0,
  };
};

const LeadModel = mongoose.model<ILead, ILeadModel>('Lead', LeadSchema);

export { LeadModel as Lead };
export default LeadModel;
