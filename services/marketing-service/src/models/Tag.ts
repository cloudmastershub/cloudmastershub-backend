import mongoose, { Schema, Document } from 'mongoose';

/**
 * Tag Category - for organizing tags
 */
export enum TagCategory {
  LEAD_STATUS = 'lead_status',
  INTEREST = 'interest',
  SOURCE = 'source',
  ENGAGEMENT = 'engagement',
  PRODUCT = 'product',
  CAMPAIGN = 'campaign',
  CUSTOM = 'custom',
}

/**
 * Tag Interface
 */
export interface ITag extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  category: TagCategory;
  color?: string;
  usageCount: number;
  isSystem: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tag Schema
 */
const TagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      enum: Object.values(TagCategory),
      default: TagCategory.CUSTOM,
    },
    color: {
      type: String,
      trim: true,
      match: /^#[0-9A-Fa-f]{6}$/,
      default: '#6B7280',
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
TagSchema.index({ slug: 1 }, { unique: true });
TagSchema.index({ name: 1 });
TagSchema.index({ category: 1 });
TagSchema.index({ usageCount: -1 });
TagSchema.index({ name: 'text', description: 'text' });

// Pre-save hook to generate slug
TagSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

// Static methods
TagSchema.statics.findByCategory = function (category: TagCategory) {
  return this.find({ category }).sort({ name: 1 });
};

TagSchema.statics.findBySlug = function (slug: string) {
  return this.findOne({ slug: slug.toLowerCase() });
};

TagSchema.statics.search = function (query: string, limit = 10) {
  return this.find({
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { slug: { $regex: query, $options: 'i' } },
    ],
  })
    .sort({ usageCount: -1, name: 1 })
    .limit(limit);
};

TagSchema.statics.incrementUsage = function (tagName: string) {
  const slug = tagName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return this.findOneAndUpdate(
    { slug },
    { $inc: { usageCount: 1 } },
    { new: true }
  );
};

TagSchema.statics.decrementUsage = function (tagName: string) {
  const slug = tagName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return this.findOneAndUpdate(
    { slug, usageCount: { $gt: 0 } },
    { $inc: { usageCount: -1 } },
    { new: true }
  );
};

const TagModel = mongoose.model<ITag>('Tag', TagSchema);

export { TagModel as Tag };
export default TagModel;
