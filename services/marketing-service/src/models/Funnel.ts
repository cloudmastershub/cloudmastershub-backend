import mongoose, { Schema, Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

/**
 * Funnel Types
 */
export enum FunnelType {
  CHALLENGE = 'challenge',      // Multi-day challenge (e.g., 7-Day DevOps Kickstart)
  WEBINAR = 'webinar',          // Webinar registration funnel
  SALES = 'sales',              // Direct sales page funnel
  LEAD_MAGNET = 'lead-magnet',  // Free resource download funnel
  APPLICATION = 'application',   // High-ticket application funnel
  TRIPWIRE = 'tripwire',        // Low-ticket to upsell funnel
  PRODUCT_LAUNCH = 'product-launch', // Launch sequence funnel
}

export enum FunnelStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

export enum FunnelStepType {
  OPTIN = 'optin',              // Lead capture page
  CONTENT = 'content',          // Content delivery page (challenge day, etc.)
  SALES = 'sales',              // Sales page
  CHECKOUT = 'checkout',        // Payment page
  UPSELL = 'upsell',            // One-click upsell
  DOWNSELL = 'downsell',        // Alternative offer
  THANK_YOU = 'thank-you',      // Confirmation page
  WEBINAR = 'webinar',          // Webinar registration/replay
  APPLICATION = 'application',   // Application form
  BOOKING = 'booking',          // Calendar booking
}

export enum DeliveryMode {
  TIME_BASED = 'time-based',    // Unlock based on time since registration
  DRIP_FED = 'drip-fed',        // Unlock after previous completion
  ALL_AT_ONCE = 'all-at-once',  // All content available immediately
}

/**
 * Block types for the step page builder
 */
export enum StepBlockType {
  // Content blocks
  HERO = 'hero',
  VSL = 'vsl',
  TEXT = 'text',
  CTA = 'cta',
  BENEFITS = 'benefits',
  FEATURES = 'features',
  TESTIMONIALS = 'testimonials',
  FAQ = 'faq',
  PRICING = 'pricing',
  GUARANTEE = 'guarantee',
  STATS = 'stats',
  INSTRUCTOR = 'instructor',
  COUNTDOWN = 'countdown',
  SCHEDULE = 'schedule',
  STICKY_BAR = 'sticky_bar',
  // Layout blocks
  SPACER = 'spacer',
  DIVIDER = 'divider',
  SECTION = 'section',
  COLUMNS = 'columns',
  // Funnel-specific blocks
  OPTIN_FORM = 'optin_form',
  CHECKOUT = 'checkout',
  ORDER_SUMMARY = 'order_summary',
  ORDER_BUMP = 'order_bump',
  BOOKING_WIDGET = 'booking_widget',
  APPLICATION_FORM = 'application_form',
  WEBINAR_REGISTRATION = 'webinar_registration',
  PROGRESS_INDICATOR = 'progress_indicator',
}

/**
 * Block interface for step page builder
 */
export interface IStepBlock {
  id: string;
  type: StepBlockType;
  data: Record<string, any>;
  position: number;
  children?: IStepBlock[];
}

/**
 * Step Page Content - Inline content for the step page
 */
export interface IStepPageContent {
  // Block-based content (new)
  blocks?: IStepBlock[];

  // Legacy fields (kept for backward compatibility)
  headline?: string;
  subheadline?: string;
  description?: string;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  formFields?: Array<{
    name: string;
    type: 'text' | 'email' | 'phone' | 'select' | 'checkbox';
    label: string;
    required: boolean;
    placeholder?: string;
    options?: string[];
  }>;
  testimonials?: Array<{
    name: string;
    title?: string;
    quote: string;
    imageUrl?: string;
  }>;
  features?: Array<{
    title: string;
    description: string;
    icon?: string;
  }>;
  productInfo?: {
    name: string;
    price: number;
    originalPrice?: number;
    currency: string;
    description?: string;
  };
}

/**
 * Funnel Step - A single page/step in the funnel
 */
export interface IFunnelStep {
  id: string;
  name: string;                  // "Registration", "Day 1", "Sales Page"
  type: FunnelStepType;
  landingPageId: string;         // Reference to LandingPage in admin-service
  order: number;

  // Inline page content (alternative to landingPageId)
  pageContent?: IStepPageContent;

  // Conditional display settings
  conditions: {
    afterStepId?: string;        // Show after this step is completed
    delayHours?: number;         // Hours delay from registration or previous step
    requiresCompletion?: boolean; // Must complete previous step (for drip-fed)
    showOnDays?: number[];       // Specific days to show (e.g., [1, 3, 5])
  };

  // Step-specific settings
  settings: {
    isRequired?: boolean;        // Must complete to proceed
    trackCompletion?: boolean;   // Track when user completes this step
    emailOnComplete?: string;    // Email template ID to send on completion
    redirectOnComplete?: string; // Next step ID to redirect to
    // Urgency/Timer settings
    showCountdownTimer?: boolean;
    timerDuration?: number;      // Timer duration in seconds
    timerRedirectUrl?: string;
    // Popup settings
    showExitPopup?: boolean;
    exitPopupDelay?: number;
    // Tracking
    facebookPixelEvent?: string;
    googleAnalyticsEvent?: string;
    customTrackingCode?: string;
  };
}

/**
 * Funnel Metrics
 */
export interface IFunnelMetrics {
  totalVisitors: number;
  uniqueVisitors: number;
  totalLeads: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  averageOrderValue: number;
}

/**
 * Funnel Interface
 */
export interface IFunnel extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  type: FunnelType;
  status: FunnelStatus;

  // Funnel structure
  steps: IFunnelStep[];

  // Settings
  settings: {
    deliveryMode: DeliveryMode;
    accessDurationDays?: number;   // How long user has access (null = forever)
    emailSequenceId?: string;      // Linked email sequence
    defaultEmailProviderId?: string; // Email provider for this funnel
    trackingPixelId?: string;      // Facebook/Google pixel ID
    customDomain?: string;         // Custom domain for funnel pages
  };

  // Design settings
  design: {
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
  };

  // Metrics (aggregated)
  metrics: IFunnelMetrics;

  // Metadata
  tags?: string[];
  createdBy: string;
  updatedBy: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Funnel Step Schema
 */
const FunnelStepSchema = new Schema<IFunnelStep>({
  id: { type: String, required: true, default: () => uuidv4() },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: Object.values(FunnelStepType),
  },
  landingPageId: { type: String, default: null },  // Can be linked later to a landing page
  order: { type: Number, required: true, min: 0 },
  // Inline page content
  pageContent: {
    // Block-based content (new)
    blocks: [{
      id: { type: String, required: true },
      type: { type: String, required: true, enum: Object.values(StepBlockType) },
      data: { type: Schema.Types.Mixed, required: true, default: {} },
      position: { type: Number, required: true, min: 0 },
      children: { type: Schema.Types.Mixed, default: undefined },
    }],
    // Legacy fields (kept for backward compatibility)
    headline: { type: String },
    subheadline: { type: String },
    description: { type: String },
    ctaText: { type: String },
    ctaUrl: { type: String },
    imageUrl: { type: String },
    videoUrl: { type: String },
    formFields: [{
      name: { type: String },
      type: { type: String, enum: ['text', 'email', 'phone', 'select', 'checkbox'] },
      label: { type: String },
      required: { type: Boolean },
      placeholder: { type: String },
      options: [{ type: String }],
    }],
    testimonials: [{
      name: { type: String },
      title: { type: String },
      quote: { type: String },
      imageUrl: { type: String },
    }],
    features: [{
      title: { type: String },
      description: { type: String },
      icon: { type: String },
    }],
    productInfo: {
      name: { type: String },
      price: { type: Number },
      originalPrice: { type: Number },
      currency: { type: String },
      description: { type: String },
    },
  },
  conditions: {
    afterStepId: { type: String },
    delayHours: { type: Number, min: 0 },
    requiresCompletion: { type: Boolean, default: false },
    showOnDays: [{ type: Number }],
  },
  settings: {
    isRequired: { type: Boolean, default: false },
    trackCompletion: { type: Boolean, default: true },
    emailOnComplete: { type: String },
    redirectOnComplete: { type: String },
    // Timer/Urgency settings
    showCountdownTimer: { type: Boolean, default: false },
    timerDuration: { type: Number },
    timerRedirectUrl: { type: String },
    // Popup settings
    showExitPopup: { type: Boolean, default: false },
    exitPopupDelay: { type: Number },
    // Tracking
    facebookPixelEvent: { type: String },
    googleAnalyticsEvent: { type: String },
    customTrackingCode: { type: String },
  },
}, { _id: false });

/**
 * Funnel Metrics Schema
 */
const FunnelMetricsSchema = new Schema<IFunnelMetrics>({
  totalVisitors: { type: Number, default: 0 },
  uniqueVisitors: { type: Number, default: 0 },
  totalLeads: { type: Number, default: 0 },
  totalConversions: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  conversionRate: { type: Number, default: 0 },
  averageOrderValue: { type: Number, default: 0 },
}, { _id: false });

/**
 * Funnel Schema
 */
const FunnelSchema = new Schema<IFunnel>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
  },
  description: {
    type: String,
    maxlength: 2000,
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(FunnelType),
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(FunnelStatus),
    default: FunnelStatus.DRAFT,
  },
  steps: {
    type: [FunnelStepSchema],
    default: [],
  },
  settings: {
    deliveryMode: {
      type: String,
      enum: Object.values(DeliveryMode),
      default: DeliveryMode.TIME_BASED,
    },
    accessDurationDays: { type: Number, min: 1 },
    emailSequenceId: { type: String },
    defaultEmailProviderId: { type: String },
    trackingPixelId: { type: String },
    customDomain: { type: String },
  },
  design: {
    primaryColor: { type: String },
    secondaryColor: { type: String },
    logoUrl: { type: String },
    faviconUrl: { type: String },
  },
  metrics: {
    type: FunnelMetricsSchema,
    default: () => ({}),
  },
  tags: [{ type: String, trim: true }],
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
  publishedAt: { type: Date },
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

// Indexes
FunnelSchema.index({ status: 1 });
FunnelSchema.index({ type: 1 });
FunnelSchema.index({ createdBy: 1 });
FunnelSchema.index({ createdAt: -1 });
FunnelSchema.index({ slug: 1 }, { unique: true });
FunnelSchema.index({ tags: 1 });
FunnelSchema.index({ name: 'text', description: 'text' });

// Pre-validation: Generate slug from name if not provided
FunnelSchema.pre('validate', async function(next) {
  try {
    if (!this.slug && this.name) {
      let baseSlug = this.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        .substring(0, 50);

      if (!baseSlug) {
        baseSlug = `funnel-${Date.now()}`;
      }

      this.slug = baseSlug;
    }
    next();
  } catch (error: any) {
    next(error);
  }
});

// Pre-save: Ensure slug uniqueness and set publishedAt
FunnelSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('slug')) {
      const FunnelModel = mongoose.model<IFunnel>('Funnel');
      const existingFunnel = await FunnelModel.findOne({
        slug: this.slug,
        _id: { $ne: this._id },
      });

      if (existingFunnel) {
        this.slug = `${this.slug}-${Date.now()}`;
      }
    }

    if (this.isModified('status')) {
      if (this.status === FunnelStatus.PUBLISHED && !this.publishedAt) {
        this.publishedAt = new Date();
      }
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

// Instance methods
FunnelSchema.methods.publish = function() {
  this.status = FunnelStatus.PUBLISHED;
  this.publishedAt = new Date();
  return this.save();
};

FunnelSchema.methods.pause = function() {
  this.status = FunnelStatus.PAUSED;
  return this.save();
};

FunnelSchema.methods.archive = function() {
  this.status = FunnelStatus.ARCHIVED;
  return this.save();
};

// Static methods
FunnelSchema.statics.findPublished = function() {
  return this.find({ status: FunnelStatus.PUBLISHED });
};

FunnelSchema.statics.findBySlug = function(slug: string) {
  return this.findOne({ slug });
};

FunnelSchema.statics.findByType = function(type: FunnelType) {
  return this.find({ type });
};

const FunnelModel = mongoose.model<IFunnel>('Funnel', FunnelSchema);

export { FunnelModel as Funnel };
export default FunnelModel;
