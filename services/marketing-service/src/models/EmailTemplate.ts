import mongoose, { Schema, Document } from 'mongoose';
import { tenantPlugin } from '../plugins/tenantPlugin';

/**
 * Email Template Categories
 */
export enum EmailTemplateCategory {
  WELCOME = 'welcome',
  NURTURE = 'nurture',
  SALES = 'sales',
  REMINDER = 'reminder',
  TRANSACTIONAL = 'transactional',
  CHALLENGE = 'challenge',
  WEBINAR = 'webinar',
  ABANDONED_CART = 'abandoned_cart',
  RE_ENGAGEMENT = 're_engagement',
  CONFIRMATION = 'confirmation',
  NOTIFICATION = 'notification',
  OTHER = 'other',
}

/**
 * Email Template Status
 */
export enum EmailTemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

/**
 * Template Variable Definition
 */
export interface ITemplateVariable {
  name: string;                   // e.g., "firstName", "courseName"
  description: string;            // Description for template editor
  defaultValue?: string;          // Fallback if variable not provided
  required: boolean;
  type: 'string' | 'number' | 'date' | 'url' | 'html';
}

/**
 * Email Template Interface
 */
export interface IEmailTemplate extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;                   // Internal name: "Day 1 Welcome Email"
  description?: string;
  category: EmailTemplateCategory;
  status: EmailTemplateStatus;

  // Email content
  subject: string;                // Subject line (supports variables)
  preheader?: string;             // Preview text
  htmlContent: string;            // Full HTML email body
  textContent?: string;           // Plain text fallback

  // Template variables
  variables: ITemplateVariable[];

  // Preview data for testing
  previewData?: Record<string, string>;

  // Design settings
  design: {
    headerImageUrl?: string;
    footerText?: string;
    primaryColor?: string;
    fontFamily?: string;
    logoUrl?: string;
  };

  // Tracking settings
  tracking: {
    trackOpens: boolean;
    trackClicks: boolean;
    googleAnalyticsId?: string;
    customTrackingParams?: Record<string, string>;
  };

  // Usage stats
  stats: {
    timesUsed: number;
    lastUsedAt?: Date;
    avgOpenRate?: number;
    avgClickRate?: number;
  };

  // Tags for organization
  tags?: string[];

  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Template Variable Schema
 */
const TemplateVariableSchema = new Schema<ITemplateVariable>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  defaultValue: { type: String },
  required: { type: Boolean, default: false },
  type: {
    type: String,
    required: true,
    enum: ['string', 'number', 'date', 'url', 'html'],
    default: 'string',
  },
}, { _id: false });

/**
 * Email Template Schema
 */
const EmailTemplateSchema = new Schema<IEmailTemplate>({
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
  category: {
    type: String,
    required: true,
    enum: Object.values(EmailTemplateCategory),
    default: EmailTemplateCategory.NURTURE,
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(EmailTemplateStatus),
    default: EmailTemplateStatus.DRAFT,
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200,
  },
  preheader: {
    type: String,
    maxlength: 200,
  },
  htmlContent: {
    type: String,
    required: true,
  },
  textContent: {
    type: String,
  },
  variables: {
    type: [TemplateVariableSchema],
    default: [],
  },
  previewData: {
    type: Schema.Types.Mixed,
  },
  design: {
    headerImageUrl: { type: String },
    footerText: { type: String },
    primaryColor: { type: String, default: '#4682B4' },
    fontFamily: { type: String, default: 'Arial, sans-serif' },
    logoUrl: { type: String },
  },
  tracking: {
    trackOpens: { type: Boolean, default: true },
    trackClicks: { type: Boolean, default: true },
    googleAnalyticsId: { type: String },
    customTrackingParams: { type: Schema.Types.Mixed },
  },
  stats: {
    timesUsed: { type: Number, default: 0 },
    lastUsedAt: { type: Date },
    avgOpenRate: { type: Number },
    avgClickRate: { type: Number },
  },
  tags: [{ type: String, trim: true }],
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
EmailTemplateSchema.plugin(tenantPlugin);

// Indexes
EmailTemplateSchema.index({ category: 1 });
EmailTemplateSchema.index({ status: 1 });
EmailTemplateSchema.index({ createdBy: 1 });
EmailTemplateSchema.index({ createdAt: -1 });
EmailTemplateSchema.index({ tags: 1 });
EmailTemplateSchema.index({ name: 'text', description: 'text', subject: 'text' });

// Instance methods
EmailTemplateSchema.methods.activate = function() {
  this.status = EmailTemplateStatus.ACTIVE;
  return this.save();
};

EmailTemplateSchema.methods.archive = function() {
  this.status = EmailTemplateStatus.ARCHIVED;
  return this.save();
};

EmailTemplateSchema.methods.recordUsage = function() {
  this.stats.timesUsed = (this.stats.timesUsed || 0) + 1;
  this.stats.lastUsedAt = new Date();
  return this.save();
};

EmailTemplateSchema.methods.render = function(data: Record<string, string>): { subject: string; html: string; text?: string } {
  let subject = this.subject;
  let html = this.htmlContent;
  let text = this.textContent;

  // Replace variables with provided data or defaults
  this.variables.forEach((variable: ITemplateVariable) => {
    const value = data[variable.name] || variable.defaultValue || '';
    const regex = new RegExp(`{{\\s*${variable.name}\\s*}}`, 'g');

    subject = subject.replace(regex, value);
    html = html.replace(regex, value);
    if (text) {
      text = text.replace(regex, value);
    }
  });

  return { subject, html, text };
};

EmailTemplateSchema.methods.getRequiredVariables = function(): string[] {
  return this.variables
    .filter((v: ITemplateVariable) => v.required)
    .map((v: ITemplateVariable) => v.name);
};

// Static methods
EmailTemplateSchema.statics.findByCategory = function(category: EmailTemplateCategory) {
  return this.find({
    category,
    status: EmailTemplateStatus.ACTIVE,
  });
};

EmailTemplateSchema.statics.findActive = function() {
  return this.find({ status: EmailTemplateStatus.ACTIVE });
};

// Pre-save: Auto-extract variables from content
EmailTemplateSchema.pre('save', function(next) {
  // Extract variables from subject and htmlContent if not manually defined
  if (this.isModified('subject') || this.isModified('htmlContent')) {
    const variableRegex = /{{(\w+)}}/g;
    const foundVariables = new Set<string>();

    // Extract from subject
    let match;
    while ((match = variableRegex.exec(this.subject)) !== null) {
      foundVariables.add(match[1]);
    }

    // Extract from HTML content
    while ((match = variableRegex.exec(this.htmlContent)) !== null) {
      foundVariables.add(match[1]);
    }

    // Add any new variables that aren't already defined
    const existingNames = this.variables.map((v: ITemplateVariable) => v.name);
    foundVariables.forEach(varName => {
      if (!existingNames.includes(varName)) {
        this.variables.push({
          name: varName,
          description: `Variable: ${varName}`,
          required: false,
          type: 'string',
        });
      }
    });
  }

  next();
});

const EmailTemplateModel = mongoose.model<IEmailTemplate>('EmailTemplate', EmailTemplateSchema);

export { EmailTemplateModel as EmailTemplate };
export default EmailTemplateModel;
