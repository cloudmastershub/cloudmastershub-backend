import mongoose, { Schema, Document } from 'mongoose';

export type VideoType = 'youtube' | 'vimeo' | 'video' | 'iframe';

export interface IVideoPopup extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  title: string;
  description?: string;
  videoType: VideoType;
  videoUrl: string;
  videoEmbedCode?: string;
  enabled: boolean;
  targetPages: string[];
  excludePages: string[];
  showAfterSeconds: number;
  showOnce: boolean;
  dismissible: boolean;
  autoPlay: boolean;
  ctaText?: string;
  ctaLink?: string;
  ctaOpenInNewTab: boolean;
  priority: number;
  startDate?: Date;
  endDate?: Date;
  viewCount: number;
  clickCount: number;
  dismissCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoPopupSchema = new Schema<IVideoPopup>({
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
  videoType: {
    type: String,
    required: true,
    enum: ['youtube', 'vimeo', 'video', 'iframe'],
    default: 'youtube'
  },
  videoUrl: {
    type: String,
    required: true,
    trim: true
  },
  videoEmbedCode: {
    type: String
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
  showAfterSeconds: {
    type: Number,
    default: 5,
    min: 0,
    max: 120
  },
  showOnce: {
    type: Boolean,
    default: true
  },
  dismissible: {
    type: Boolean,
    default: true
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

// Indexes
VideoPopupSchema.index({ enabled: 1, priority: -1 });
VideoPopupSchema.index({ targetPages: 1 });
VideoPopupSchema.index({ createdAt: -1 });

// Static method to find active popups for a specific page
VideoPopupSchema.statics.findActiveForPage = function(pagePath: string) {
  const now = new Date();
  return this.find({
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
  }).sort({ priority: -1, createdAt: -1 });
};

// Static method to find all enabled popups
VideoPopupSchema.statics.findEnabled = function() {
  return this.find({ enabled: true }).sort({ priority: -1, createdAt: -1 });
};

// Instance methods for analytics
VideoPopupSchema.methods.recordView = function() {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

VideoPopupSchema.methods.recordClick = function() {
  this.clickCount = (this.clickCount || 0) + 1;
  return this.save();
};

VideoPopupSchema.methods.recordDismiss = function() {
  this.dismissCount = (this.dismissCount || 0) + 1;
  return this.save();
};

const VideoPopupModel = mongoose.model<IVideoPopup>('VideoPopup', VideoPopupSchema);
export { VideoPopupModel as VideoPopup };
export default VideoPopupModel;
