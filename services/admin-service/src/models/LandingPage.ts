import mongoose, { Schema, Document } from 'mongoose';

// Block types enum matching the frontend
export enum BlockType {
  HERO = 'hero',
  VSL = 'vsl',
  COUNTDOWN = 'countdown',
  SCHEDULE = 'schedule',
  BENEFITS = 'benefits',
  PRICING = 'pricing',
  TESTIMONIALS = 'testimonials',
  FAQ = 'faq',
  CTA = 'cta',
  FEATURES = 'features',
  GUARANTEE = 'guarantee',
  STATS = 'stats',
  INSTRUCTOR = 'instructor',
  STICKY_BAR = 'sticky_bar',
  SPACER = 'spacer',
  TEXT = 'text',
  DIVIDER = 'divider',
  SECTION = 'section',
  COLUMNS = 'columns',
}

// Landing page status
export enum LandingPageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// Block interface
export interface IBlock {
  id: string;
  type: BlockType;
  data: Record<string, any>;
  position: number;
  children?: IBlock[]; // For section and columns blocks with nested content
  transparent?: boolean; // Optional transparency setting
}

// Landing Page interface
export interface ILandingPage extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  ogImage?: string;
  status: LandingPageStatus;
  blocks: IBlock[];
  template?: string;
  createdBy: string;
  updatedBy: string;
  publishedAt?: Date;
  viewCount: number;
  conversionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Block schema (subdocument)
const BlockSchema = new Schema<IBlock>({
  id: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: Object.values(BlockType)
  },
  data: { type: Schema.Types.Mixed, required: true, default: {} },
  position: { type: Number, required: true, min: 0 },
  children: { type: Schema.Types.Mixed, default: undefined }, // For nested blocks in section/columns
  transparent: { type: Boolean, default: undefined }
}, { _id: false });

// Landing Page schema
const LandingPageSchema = new Schema<ILandingPage>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    // Note: index is created separately below with unique constraint
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens']
  },
  description: {
    type: String,
    maxlength: 1000
  },
  metaTitle: {
    type: String,
    maxlength: 70
  },
  metaDescription: {
    type: String,
    maxlength: 160
  },
  metaKeywords: [{
    type: String,
    trim: true
  }],
  ogImage: {
    type: String
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(LandingPageStatus),
    default: LandingPageStatus.DRAFT
  },
  blocks: {
    type: [BlockSchema],
    default: []
  },
  template: {
    type: String,
    default: null
  },
  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String,
    required: true
  },
  publishedAt: {
    type: Date
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  conversionCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better query performance
LandingPageSchema.index({ status: 1 });
LandingPageSchema.index({ createdBy: 1 });
LandingPageSchema.index({ createdAt: -1 });
LandingPageSchema.index({ title: 'text', description: 'text' });
LandingPageSchema.index({ slug: 1 }, { unique: true });

// Pre-validation middleware to generate slug from title if not provided
LandingPageSchema.pre('validate', async function(next) {
  try {
    if (!this.slug && this.title) {
      // Generate slug from title
      let baseSlug = this.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
        .substring(0, 50);

      if (!baseSlug) {
        baseSlug = `landing-page-${Date.now()}`;
      }

      this.slug = baseSlug;
    }
    next();
  } catch (error: any) {
    next(error);
  }
});

// Pre-save middleware to ensure slug uniqueness
LandingPageSchema.pre('save', async function(next) {
  try {
    if (this.isNew || this.isModified('slug')) {
      const LandingPageModel = mongoose.model<ILandingPage>('LandingPage');

      // Check for existing slugs
      const existingPage = await LandingPageModel.findOne({
        slug: this.slug,
        _id: { $ne: this._id }
      });

      if (existingPage) {
        // Append timestamp to make unique
        this.slug = `${this.slug}-${Date.now()}`;
      }
    }

    // Set publishedAt when publishing
    if (this.isModified('status')) {
      if (this.status === LandingPageStatus.PUBLISHED && !this.publishedAt) {
        this.publishedAt = new Date();
      }
    }

    next();
  } catch (error: any) {
    next(error);
  }
});

// Instance methods
LandingPageSchema.methods.publish = function() {
  this.status = LandingPageStatus.PUBLISHED;
  this.publishedAt = new Date();
  return this.save();
};

LandingPageSchema.methods.unpublish = function() {
  this.status = LandingPageStatus.DRAFT;
  return this.save();
};

LandingPageSchema.methods.archive = function() {
  this.status = LandingPageStatus.ARCHIVED;
  return this.save();
};

LandingPageSchema.methods.incrementViewCount = function() {
  this.viewCount = (this.viewCount || 0) + 1;
  return this.save();
};

LandingPageSchema.methods.incrementConversionCount = function() {
  this.conversionCount = (this.conversionCount || 0) + 1;
  return this.save();
};

// Static methods
LandingPageSchema.statics.findPublished = function() {
  return this.find({ status: LandingPageStatus.PUBLISHED });
};

LandingPageSchema.statics.findBySlug = function(slug: string) {
  return this.findOne({ slug });
};

LandingPageSchema.statics.findByCreator = function(creatorId: string) {
  return this.find({ createdBy: creatorId });
};

const LandingPageModel = mongoose.model<ILandingPage>('LandingPage', LandingPageSchema);
export { LandingPageModel as LandingPage };
export default LandingPageModel;
