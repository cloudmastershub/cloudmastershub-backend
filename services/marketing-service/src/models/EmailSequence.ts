import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin';

/**
 * Email Sequence Status
 */
export enum EmailSequenceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

/**
 * Sequence Trigger Types
 */
export enum SequenceTrigger {
  FUNNEL_OPTIN = 'funnel_optin',           // User opts into a funnel
  CHALLENGE_START = 'challenge_start',      // User starts a challenge
  CHALLENGE_DAY_COMPLETE = 'challenge_day_complete', // User completes a challenge day
  PURCHASE = 'purchase',                    // User makes a purchase
  CART_ABANDON = 'cart_abandon',            // User abandons checkout
  USER_SIGNUP = 'user_signup',              // User creates account
  TAG_ADDED = 'tag_added',                  // Specific tag added to lead
  MANUAL = 'manual',                        // Manually triggered
  WEBHOOK = 'webhook',                      // Triggered by external webhook
}

/**
 * Email Send Time Options
 */
export enum SendTimeOption {
  IMMEDIATE = 'immediate',          // Send as soon as delay passes
  SCHEDULED = 'scheduled',          // Send at specific time of day
  BUSINESS_HOURS = 'business_hours', // Send during business hours only
}

/**
 * Sequence Email - A single email in the sequence
 */
export interface ISequenceEmail {
  id: string;
  order: number;
  name: string;                     // Internal name: "Day 1 - Welcome"
  templateId: string;               // Reference to EmailTemplate

  // Timing
  delayHours: number;               // Hours after trigger/previous email
  delayDays?: number;               // Optional days (converted to hours)
  sendTime: SendTimeOption;
  scheduledHour?: number;           // 0-23, for scheduled send time
  scheduledMinute?: number;         // 0-59

  // Conditions
  conditions: {
    onlyIfOpened?: boolean;         // Only send if previous email was opened
    onlyIfClicked?: boolean;        // Only send if previous email was clicked
    skipIfConverted?: boolean;      // Skip if user already purchased
    skipIfUnsubscribed?: boolean;   // Skip if user unsubscribed
    requireTag?: string;            // Only send if user has this tag
    excludeTag?: string;            // Skip if user has this tag
  };

  // A/B Testing
  abTest?: {
    enabled: boolean;
    variants: {
      id: string;
      templateId: string;
      weight: number;               // Percentage (0-100)
    }[];
  };

  // Tracking
  metrics: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };

  isActive: boolean;
}

/**
 * Email Sequence Interface
 */
export interface IEmailSequence extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;                     // "7-Day Challenge Nurture Sequence"
  description?: string;

  // Trigger configuration
  trigger: SequenceTrigger;
  triggerConfig: {
    funnelId?: string;              // For funnel_optin trigger
    challengeId?: string;           // For challenge triggers
    tagName?: string;               // For tag_added trigger
    webhookSecret?: string;         // For webhook trigger
  };

  // Sequence emails
  emails: ISequenceEmail[];

  // Global settings
  settings: {
    timezone: string;               // Default timezone for scheduled sends
    businessHoursStart?: number;    // 9 = 9am
    businessHoursEnd?: number;      // 17 = 5pm
    skipWeekends?: boolean;
    maxEmailsPerDay?: number;       // Rate limiting
    unsubscribeLinkRequired: boolean;
    fromName: string;
    fromEmail: string;
    replyTo?: string;
  };

  // Exit conditions (stop sequence if any are met)
  exitConditions: {
    onPurchase?: boolean;           // Stop on any purchase
    onSpecificPurchase?: string[];  // Stop on specific product purchase
    onUnsubscribe?: boolean;        // Stop on unsubscribe
    onTagAdded?: string;            // Stop when tag is added
    afterDays?: number;             // Stop after X days
  };

  // Aggregate metrics
  metrics: {
    totalEnrolled: number;
    totalCompleted: number;
    totalExited: number;
    averageOpenRate: number;
    averageClickRate: number;
  };

  status: EmailSequenceStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Sequence Email Metrics Schema
 */
const SequenceEmailMetricsSchema = new Schema({
  sent: { type: Number, default: 0 },
  delivered: { type: Number, default: 0 },
  opened: { type: Number, default: 0 },
  clicked: { type: Number, default: 0 },
  bounced: { type: Number, default: 0 },
  unsubscribed: { type: Number, default: 0 },
}, { _id: false });

/**
 * Sequence Email Schema
 */
const SequenceEmailSchema = new Schema<ISequenceEmail>({
  id: { type: String, required: true },
  order: { type: Number, required: true, min: 0 },
  name: { type: String, required: true, trim: true },
  templateId: { type: String, required: true },
  delayHours: { type: Number, required: true, min: 0, default: 0 },
  delayDays: { type: Number, min: 0 },
  sendTime: {
    type: String,
    required: true,
    enum: Object.values(SendTimeOption),
    default: SendTimeOption.IMMEDIATE,
  },
  scheduledHour: { type: Number, min: 0, max: 23 },
  scheduledMinute: { type: Number, min: 0, max: 59, default: 0 },
  conditions: {
    onlyIfOpened: { type: Boolean, default: false },
    onlyIfClicked: { type: Boolean, default: false },
    skipIfConverted: { type: Boolean, default: true },
    skipIfUnsubscribed: { type: Boolean, default: true },
    requireTag: { type: String },
    excludeTag: { type: String },
  },
  abTest: {
    enabled: { type: Boolean, default: false },
    variants: [{
      id: { type: String, required: true },
      templateId: { type: String, required: true },
      weight: { type: Number, required: true, min: 0, max: 100 },
    }],
  },
  metrics: {
    type: SequenceEmailMetricsSchema,
    default: () => ({}),
  },
  isActive: { type: Boolean, default: true },
}, { _id: false });

/**
 * Email Sequence Schema
 */
const EmailSequenceSchema = new Schema<IEmailSequence>({
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
  trigger: {
    type: String,
    required: true,
    enum: Object.values(SequenceTrigger),
  },
  triggerConfig: {
    funnelId: { type: String },
    challengeId: { type: String },
    tagName: { type: String },
    webhookSecret: { type: String },
  },
  emails: {
    type: [SequenceEmailSchema],
    default: [],
  },
  settings: {
    timezone: { type: String, default: 'America/New_York' },
    businessHoursStart: { type: Number, min: 0, max: 23, default: 9 },
    businessHoursEnd: { type: Number, min: 0, max: 23, default: 17 },
    skipWeekends: { type: Boolean, default: false },
    maxEmailsPerDay: { type: Number, min: 1 },
    unsubscribeLinkRequired: { type: Boolean, default: true },
    fromName: { type: String, required: true, default: 'CloudMasters Hub' },
    fromEmail: { type: String, required: true },
    replyTo: { type: String },
  },
  exitConditions: {
    onPurchase: { type: Boolean, default: true },
    onSpecificPurchase: [{ type: String }],
    onUnsubscribe: { type: Boolean, default: true },
    onTagAdded: { type: String },
    afterDays: { type: Number, min: 1 },
  },
  metrics: {
    totalEnrolled: { type: Number, default: 0 },
    totalCompleted: { type: Number, default: 0 },
    totalExited: { type: Number, default: 0 },
    averageOpenRate: { type: Number, default: 0 },
    averageClickRate: { type: Number, default: 0 },
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(EmailSequenceStatus),
    default: EmailSequenceStatus.DRAFT,
  },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      // Hide webhook secret in JSON output
      if (ret.triggerConfig?.webhookSecret) {
        ret.triggerConfig.webhookSecret = '***';
      }
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
EmailSequenceSchema.plugin(tenantPlugin);

// Indexes
EmailSequenceSchema.index({ status: 1 });
EmailSequenceSchema.index({ trigger: 1 });
EmailSequenceSchema.index({ createdBy: 1 });
EmailSequenceSchema.index({ createdAt: -1 });
EmailSequenceSchema.index({ 'triggerConfig.funnelId': 1 });
EmailSequenceSchema.index({ 'triggerConfig.challengeId': 1 });
EmailSequenceSchema.index({ name: 'text', description: 'text' });

// Instance methods
EmailSequenceSchema.methods.activate = function() {
  this.status = EmailSequenceStatus.ACTIVE;
  return this.save();
};

EmailSequenceSchema.methods.pause = function() {
  this.status = EmailSequenceStatus.PAUSED;
  return this.save();
};

EmailSequenceSchema.methods.archive = function() {
  this.status = EmailSequenceStatus.ARCHIVED;
  return this.save();
};

EmailSequenceSchema.methods.getEmailByOrder = function(order: number): ISequenceEmail | undefined {
  return this.emails.find((email: ISequenceEmail) => email.order === order);
};

EmailSequenceSchema.methods.getNextEmail = function(currentOrder: number): ISequenceEmail | undefined {
  return this.emails
    .filter((email: ISequenceEmail) => email.order > currentOrder && email.isActive)
    .sort((a: ISequenceEmail, b: ISequenceEmail) => a.order - b.order)[0];
};

// Static methods
EmailSequenceSchema.statics.findActiveByTrigger = function(trigger: SequenceTrigger) {
  return this.find({
    trigger,
    status: EmailSequenceStatus.ACTIVE,
  });
};

EmailSequenceSchema.statics.findByFunnel = function(funnelId: string) {
  return this.find({ 'triggerConfig.funnelId': funnelId });
};

EmailSequenceSchema.statics.findByChallenge = function(challengeId: string) {
  return this.find({ 'triggerConfig.challengeId': challengeId });
};

const EmailSequenceModel = mongoose.model<IEmailSequence>('EmailSequence', EmailSequenceSchema);

export { EmailSequenceModel as EmailSequence };
export default EmailSequenceModel;
