import mongoose, { Schema, Document } from 'mongoose';

// Popup types
export enum PopupType {
  VIDEO = 'video',
  LEAD_CAPTURE = 'lead_capture'
}

// Display trigger types
export enum DisplayTrigger {
  DELAY = 'delay',
  SCROLL = 'scroll',
  EXIT_INTENT = 'exit_intent'
}

// Form field types for lead capture
export enum FormFieldType {
  TEXT = 'text',
  EMAIL = 'email',
  SELECT = 'select',
  CHECKBOX = 'checkbox',
  TEXTAREA = 'textarea',
  TEL = 'tel'
}

// Form field interface
export interface IFormField {
  id: string;
  type: FormFieldType;
  name: string;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];  // For select fields
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

// Success action types
export enum SuccessAction {
  MESSAGE = 'message',
  REDIRECT = 'redirect'
}

export type VideoType = 'youtube' | 'vimeo' | 'video' | 'iframe';

export interface IPopup extends Document {
  _id: mongoose.Types.ObjectId;

  // Shared fields
  name: string;
  title: string;
  description?: string;
  type: PopupType;
  enabled: boolean;
  targetPages: string[];
  excludePages: string[];
  showOnce: boolean;
  dismissible: boolean;
  priority: number;
  startDate?: Date;
  endDate?: Date;

  // Display trigger settings
  displayTrigger: DisplayTrigger;
  showAfterSeconds: number;      // For delay trigger
  scrollPercentage?: number;     // For scroll trigger (0-100)

  // Analytics (shared)
  viewCount: number;
  clickCount: number;
  dismissCount: number;
  submissionCount: number;       // For lead capture

  // Video-specific fields
  videoType?: VideoType;
  videoUrl?: string;
  videoEmbedCode?: string;
  autoPlay?: boolean;
  ctaText?: string;
  ctaLink?: string;
  ctaOpenInNewTab?: boolean;

  // Lead capture-specific fields
  formFields?: IFormField[];
  submitButtonText?: string;
  thankYouMessage?: string;
  successAction?: SuccessAction;
  redirectUrl?: string;
  redirectDelay?: number;        // Delay before redirect (ms)
  workflowId?: string;           // Trigger workflow on submission
  tagsToApply?: string[];        // Tags to apply to lead
  initialScore?: number;         // Starting lead score

  // Audit
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Backward compatibility alias
export type IVideoPopup = IPopup;

// Form field sub-schema
const FormFieldSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: Object.values(FormFieldType),
    default: FormFieldType.TEXT
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  placeholder: {
    type: String,
    trim: true
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [{
    type: String,
    trim: true
  }],
  validation: {
    minLength: { type: Number },
    maxLength: { type: Number },
    pattern: { type: String }
  }
}, { _id: false });

const PopupSchema = new Schema<IPopup>({
  // Shared fields
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    maxlength: 500
  },
  type: {
    type: String,
    enum: Object.values(PopupType),
    default: PopupType.VIDEO
  },
  enabled: {
    type: Boolean,
    default: false
  },
  targetPages: [{
    type: String,
    trim: true
  }],
  excludePages: [{
    type: String,
    trim: true
  }],
  showOnce: {
    type: Boolean,
    default: true
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },

  // Display trigger settings
  displayTrigger: {
    type: String,
    enum: Object.values(DisplayTrigger),
    default: DisplayTrigger.DELAY
  },
  showAfterSeconds: {
    type: Number,
    default: 5,
    min: 0,
    max: 120
  },
  scrollPercentage: {
    type: Number,
    min: 0,
    max: 100
  },

  // Analytics
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  clickCount: {
    type: Number,
    default: 0,
    min: 0
  },
  dismissCount: {
    type: Number,
    default: 0,
    min: 0
  },
  submissionCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Video-specific fields
  videoType: {
    type: String,
    enum: ['youtube', 'vimeo', 'video', 'iframe']
  },
  videoUrl: {
    type: String,
    trim: true
  },
  videoEmbedCode: {
    type: String
  },
  autoPlay: {
    type: Boolean,
    default: false
  },
  ctaText: {
    type: String,
    maxlength: 100
  },
  ctaLink: {
    type: String
  },
  ctaOpenInNewTab: {
    type: Boolean,
    default: false
  },

  // Lead capture-specific fields
  formFields: {
    type: [FormFieldSchema],
    default: undefined
  },
  submitButtonText: {
    type: String,
    default: 'Subscribe',
    maxlength: 50
  },
  thankYouMessage: {
    type: String,
    maxlength: 500
  },
  successAction: {
    type: String,
    enum: Object.values(SuccessAction),
    default: SuccessAction.MESSAGE
  },
  redirectUrl: {
    type: String,
    trim: true
  },
  redirectDelay: {
    type: Number,
    default: 2000,
    min: 0,
    max: 10000
  },
  workflowId: {
    type: String
  },
  tagsToApply: [{
    type: String,
    trim: true
  }],
  initialScore: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },

  // Audit fields
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(_doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(_doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Backward compatibility alias
const VideoPopupSchema = PopupSchema;

// Indexes
PopupSchema.index({ enabled: 1, priority: -1 });
PopupSchema.index({ type: 1 });
PopupSchema.index({ targetPages: 1 });
PopupSchema.index({ createdAt: -1 });

// Static method to find active popups for a specific page
PopupSchema.statics.findActiveForPage = function(pagePath: string, popupType?: PopupType) {
  const now = new Date();
  const query: any = {
    enabled: true,
    $or: [
      { targetPages: { $size: 0 } },
      { targetPages: '*' },
      { targetPages: pagePath },
      { targetPages: { $regex: new RegExp(pagePath.replace(/\//g, '\\/').replace(/\*/g, '.*')) } }
    ],
    excludePages: { $nin: [pagePath] },
    $and: [
      { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
      { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] }
    ]
  };

  if (popupType) {
    query.type = popupType;
  }

  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

// Static method to find all enabled popups
PopupSchema.statics.findEnabled = function(popupType?: PopupType) {
  const query: any = { enabled: true };
  if (popupType) {
    query.type = popupType;
  }
  return this.find(query).sort({ priority: -1, createdAt: -1 });
};

// Instance methods for analytics
PopupSchema.methods.recordView = function() {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

PopupSchema.methods.recordClick = function() {
  this.clickCount = (this.clickCount || 0) + 1;
  return this.save();
};

PopupSchema.methods.recordDismiss = function() {
  this.dismissCount = (this.dismissCount || 0) + 1;
  return this.save();
};

PopupSchema.methods.recordSubmission = function() {
  this.submissionCount = (this.submissionCount || 0) + 1;
  return this.save();
};

// Default form fields for lead capture
export const DEFAULT_LEAD_CAPTURE_FIELDS: IFormField[] = [
  {
    id: 'email',
    type: FormFieldType.EMAIL,
    name: 'email',
    label: 'Email',
    placeholder: 'Enter your email',
    required: true
  },
  {
    id: 'firstName',
    type: FormFieldType.TEXT,
    name: 'firstName',
    label: 'First Name',
    placeholder: 'Enter your name',
    required: false
  }
];

// Use 'Popup' as collection name for new unified model
const PopupModel = mongoose.model<IPopup>('Popup', PopupSchema);

// Export with backward compatible names
export { PopupModel as Popup };
export { PopupModel as VideoPopup };  // Backward compatibility
export default PopupModel;
