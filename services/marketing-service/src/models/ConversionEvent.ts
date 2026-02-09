import mongoose, { Schema, Document } from 'mongoose';

/**
 * Conversion Event Types
 */
export enum ConversionEventType {
  // Funnel events
  PAGE_VIEW = 'page_view',
  FUNNEL_START = 'funnel_start',
  STEP_VIEW = 'step_view',
  STEP_COMPLETE = 'step_complete',
  FUNNEL_COMPLETE = 'funnel_complete',
  FUNNEL_EXIT = 'funnel_exit',

  // Lead events
  OPTIN = 'optin',
  FORM_SUBMIT = 'form_submit',
  LEAD_CAPTURE = 'lead_capture',

  // Engagement events
  EMAIL_OPEN = 'email_open',
  EMAIL_CLICK = 'email_click',
  EMAIL_DELIVERED = 'email_delivered',
  EMAIL_BOUNCED = 'email_bounced',
  EMAIL_UNSUBSCRIBED = 'email_unsubscribed',
  EMAIL_COMPLAINED = 'email_complained',
  VIDEO_START = 'video_start',
  VIDEO_PROGRESS = 'video_progress',
  VIDEO_COMPLETE = 'video_complete',

  // Challenge events
  CHALLENGE_REGISTER = 'challenge_register',
  CHALLENGE_DAY_START = 'challenge_day_start',
  CHALLENGE_DAY_COMPLETE = 'challenge_day_complete',
  CHALLENGE_COMPLETE = 'challenge_complete',

  // Purchase events
  CHECKOUT_START = 'checkout_start',
  CHECKOUT_ABANDON = 'checkout_abandon',
  PURCHASE = 'purchase',
  UPSELL_VIEW = 'upsell_view',
  UPSELL_ACCEPT = 'upsell_accept',
  UPSELL_DECLINE = 'upsell_decline',

  // Webinar events
  WEBINAR_REGISTER = 'webinar_register',
  WEBINAR_ATTEND = 'webinar_attend',
  WEBINAR_LEAVE = 'webinar_leave',

  // Other events
  BUTTON_CLICK = 'button_click',
  SCROLL_DEPTH = 'scroll_depth',
  TIME_ON_PAGE = 'time_on_page',
  CUSTOM = 'custom',
}

/**
 * Conversion Event Interface
 */
export interface IConversionEvent extends Document {
  _id: mongoose.Types.ObjectId;

  // Event identification
  eventType: ConversionEventType;
  eventName?: string;             // Custom event name for CUSTOM type

  // User/Lead identification
  leadId?: mongoose.Types.ObjectId;
  userId?: string;
  sessionId: string;
  anonymousId?: string;           // For tracking before identification

  // Context
  funnelId?: mongoose.Types.ObjectId;
  funnelSlug?: string;
  stepId?: string;
  stepOrder?: number;
  landingPageId?: string;
  challengeId?: mongoose.Types.ObjectId;
  emailId?: string;
  emailSequenceId?: string;

  // Event metadata
  metadata: {
    // Page/Content
    pageUrl?: string;
    pageTitle?: string;
    referrer?: string;

    // Video
    videoId?: string;
    videoPercent?: number;
    videoDuration?: number;
    watchTimeSeconds?: number;

    // Challenge
    dayNumber?: number;

    // Purchase
    productId?: string;
    productName?: string;
    amount?: number;
    currency?: string;
    orderId?: string;

    // Scroll/Time
    scrollPercent?: number;
    timeOnPageSeconds?: number;

    // Button/Link
    buttonId?: string;
    buttonText?: string;
    linkUrl?: string;

    // Form
    formId?: string;
    formFields?: string[];

    // Custom
    customData?: Record<string, any>;
  };

  // Source tracking
  source: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    referralCode?: string;
  };

  // Device/Browser info
  device: {
    type?: 'desktop' | 'tablet' | 'mobile';
    os?: string;
    browser?: string;
    screenWidth?: number;
    screenHeight?: number;
  };

  // Location
  location: {
    ip?: string;
    country?: string;
    region?: string;
    city?: string;
    timezone?: string;
  };

  // Attribution
  attribution: {
    firstTouch?: {
      source: string;
      campaign?: string;
      timestamp: Date;
    };
    lastTouch?: {
      source: string;
      campaign?: string;
      timestamp: Date;
    };
  };

  // Value tracking
  value?: number;                 // Monetary value of this event
  isConversion: boolean;          // Is this a conversion event?

  timestamp: Date;
  createdAt: Date;
}

/**
 * Conversion Event Schema
 */
const ConversionEventSchema = new Schema<IConversionEvent>({
  eventType: {
    type: String,
    required: true,
    enum: Object.values(ConversionEventType),
    index: true,
  },
  eventName: {
    type: String,
    maxlength: 100,
  },
  leadId: {
    type: Schema.Types.ObjectId,
    ref: 'Lead',
    index: true,
    sparse: true,
  },
  userId: {
    type: String,
    index: true,
    sparse: true,
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
  },
  anonymousId: {
    type: String,
    index: true,
    sparse: true,
  },
  funnelId: {
    type: Schema.Types.ObjectId,
    ref: 'Funnel',
    index: true,
    sparse: true,
  },
  funnelSlug: {
    type: String,
    index: true,
  },
  stepId: { type: String },
  stepOrder: { type: Number },
  landingPageId: { type: String, index: true },
  challengeId: {
    type: Schema.Types.ObjectId,
    ref: 'Challenge',
    index: true,
    sparse: true,
  },
  emailId: { type: String },
  emailSequenceId: { type: String },
  metadata: {
    pageUrl: { type: String },
    pageTitle: { type: String },
    referrer: { type: String },
    videoId: { type: String },
    videoPercent: { type: Number, min: 0, max: 100 },
    videoDuration: { type: Number },
    watchTimeSeconds: { type: Number },
    dayNumber: { type: Number },
    productId: { type: String },
    productName: { type: String },
    amount: { type: Number },
    currency: { type: String, default: 'USD' },
    orderId: { type: String },
    scrollPercent: { type: Number, min: 0, max: 100 },
    timeOnPageSeconds: { type: Number },
    buttonId: { type: String },
    buttonText: { type: String },
    linkUrl: { type: String },
    formId: { type: String },
    formFields: [{ type: String }],
    customData: { type: Schema.Types.Mixed },
  },
  source: {
    utmSource: { type: String },
    utmMedium: { type: String },
    utmCampaign: { type: String },
    utmContent: { type: String },
    utmTerm: { type: String },
    referralCode: { type: String },
  },
  device: {
    type: { type: String, enum: ['desktop', 'tablet', 'mobile'] },
    os: { type: String },
    browser: { type: String },
    screenWidth: { type: Number },
    screenHeight: { type: Number },
  },
  location: {
    ip: { type: String },
    country: { type: String },
    region: { type: String },
    city: { type: String },
    timezone: { type: String },
  },
  attribution: {
    firstTouch: {
      source: { type: String },
      campaign: { type: String },
      timestamp: { type: Date },
    },
    lastTouch: {
      source: { type: String },
      campaign: { type: String },
      timestamp: { type: Date },
    },
  },
  value: { type: Number },
  isConversion: { type: Boolean, default: false, index: true },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.funnelId = ret.funnelId?.toString();
      ret.leadId = ret.leadId?.toString();
      ret.challengeId = ret.challengeId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.funnelId = ret.funnelId?.toString();
      ret.leadId = ret.leadId?.toString();
      ret.challengeId = ret.challengeId?.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes for analytics queries
ConversionEventSchema.index({ timestamp: -1 });
ConversionEventSchema.index({ funnelId: 1, eventType: 1, timestamp: -1 });
ConversionEventSchema.index({ challengeId: 1, eventType: 1, timestamp: -1 });
ConversionEventSchema.index({ 'source.utmCampaign': 1, timestamp: -1 });
ConversionEventSchema.index({ isConversion: 1, timestamp: -1 });
ConversionEventSchema.index({ sessionId: 1, timestamp: 1 });

// TTL index - automatically delete events older than 2 years
ConversionEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63072000 });

// Pre-save: Determine if event is a conversion
ConversionEventSchema.pre('save', function(next) {
  const conversionTypes: ConversionEventType[] = [
    ConversionEventType.OPTIN,
    ConversionEventType.LEAD_CAPTURE,
    ConversionEventType.PURCHASE,
    ConversionEventType.UPSELL_ACCEPT,
    ConversionEventType.CHALLENGE_COMPLETE,
    ConversionEventType.WEBINAR_ATTEND,
  ];

  this.isConversion = conversionTypes.includes(this.eventType);

  // Set value for purchase events
  if (this.eventType === ConversionEventType.PURCHASE && this.metadata.amount) {
    this.value = this.metadata.amount;
  }

  next();
});

// Static methods for analytics
ConversionEventSchema.statics.getFunnelAnalytics = async function(
  funnelId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $match: {
        funnelId: new mongoose.Types.ObjectId(funnelId),
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$eventType',
        count: { $sum: 1 },
        uniqueSessions: { $addToSet: '$sessionId' },
        totalValue: { $sum: '$value' },
      },
    },
    {
      $project: {
        eventType: '$_id',
        count: 1,
        uniqueCount: { $size: '$uniqueSessions' },
        totalValue: 1,
        _id: 0,
      },
    },
  ];

  return this.aggregate(pipeline);
};

ConversionEventSchema.statics.getStepConversionRates = async function(
  funnelId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $match: {
        funnelId: new mongoose.Types.ObjectId(funnelId),
        eventType: { $in: [ConversionEventType.STEP_VIEW, ConversionEventType.STEP_COMPLETE] },
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { stepOrder: '$stepOrder', eventType: '$eventType' },
        uniqueSessions: { $addToSet: '$sessionId' },
      },
    },
    {
      $project: {
        stepOrder: '$_id.stepOrder',
        eventType: '$_id.eventType',
        count: { $size: '$uniqueSessions' },
        _id: 0,
      },
    },
    { $sort: { stepOrder: 1 as const, eventType: 1 as const } },
  ];

  return this.aggregate(pipeline);
};

ConversionEventSchema.statics.getChallengeAnalytics = async function(
  challengeId: string,
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $match: {
        challengeId: new mongoose.Types.ObjectId(challengeId),
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          eventType: '$eventType',
          dayNumber: '$metadata.dayNumber',
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: { $ifNull: ['$userId', '$leadId'] } },
      },
    },
    {
      $project: {
        eventType: '$_id.eventType',
        dayNumber: '$_id.dayNumber',
        count: 1,
        uniqueCount: { $size: '$uniqueUsers' },
        _id: 0,
      },
    },
    { $sort: { dayNumber: 1 as const, eventType: 1 as const } },
  ];

  return this.aggregate(pipeline);
};

ConversionEventSchema.statics.getRevenueBySource = async function(
  startDate: Date,
  endDate: Date
) {
  const pipeline = [
    {
      $match: {
        eventType: ConversionEventType.PURCHASE,
        timestamp: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: {
          source: '$source.utmSource',
          campaign: '$source.utmCampaign',
        },
        totalRevenue: { $sum: '$value' },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: '$value' },
      },
    },
    {
      $project: {
        source: '$_id.source',
        campaign: '$_id.campaign',
        totalRevenue: 1,
        orderCount: 1,
        avgOrderValue: { $round: ['$avgOrderValue', 2] },
        _id: 0,
      },
    },
    { $sort: { totalRevenue: -1 as const } },
  ];

  return this.aggregate(pipeline);
};

ConversionEventSchema.statics.getSessionJourney = async function(sessionId: string) {
  return this.find({ sessionId })
    .sort({ timestamp: 1 })
    .select('eventType metadata timestamp funnelSlug stepId');
};

const ConversionEventModel = mongoose.model<IConversionEvent>(
  'ConversionEvent',
  ConversionEventSchema
);

export { ConversionEventModel as ConversionEvent };
export default ConversionEventModel;
