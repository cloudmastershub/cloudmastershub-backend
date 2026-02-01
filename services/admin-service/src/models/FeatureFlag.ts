import mongoose, { Schema, Document } from 'mongoose';

export interface IFeatureFlag extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  enabled: boolean;

  // Targeting options
  enabledForRoles?: string[];
  enabledForUsers?: string[];
  enabledForSubscriptionTiers?: string[];
  rolloutPercentage?: number;

  // Metadata
  category?: string;
  tags?: string[];

  // Audit trail
  createdBy: string;
  updatedBy?: string;

  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  enabled: {
    type: Boolean,
    default: false
  },

  enabledForRoles: {
    type: [String],
    default: []
  },
  enabledForUsers: {
    type: [String],
    default: []
  },
  enabledForSubscriptionTiers: {
    type: [String],
    default: []
  },
  rolloutPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },

  category: {
    type: String,
    default: 'general'
  },
  tags: {
    type: [String],
    default: []
  },

  createdBy: {
    type: String,
    required: true
  },
  updatedBy: {
    type: String
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
  }
});

// Indexes
FeatureFlagSchema.index({ slug: 1 }, { unique: true });
FeatureFlagSchema.index({ enabled: 1 });
FeatureFlagSchema.index({ category: 1 });
FeatureFlagSchema.index({ tags: 1 });

// Pre-save hook to generate slug from name
FeatureFlagSchema.pre('save', function(next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
  next();
});

// Static method to check if a flag is enabled for a user
FeatureFlagSchema.statics.isEnabledForUser = async function(
  flagSlug: string,
  userId: string,
  userRoles: string[] = [],
  subscriptionTier?: string
): Promise<boolean> {
  const flag = await this.findOne({ slug: flagSlug });

  if (!flag) return false;
  if (!flag.enabled) return false;

  // Check if user is specifically enabled
  if (flag.enabledForUsers?.length > 0) {
    if (flag.enabledForUsers.includes(userId)) return true;
  }

  // Check if user's role is enabled
  if (flag.enabledForRoles?.length > 0) {
    const hasEnabledRole = userRoles.some(role => flag.enabledForRoles.includes(role));
    if (hasEnabledRole) return true;
  }

  // Check subscription tier
  if (flag.enabledForSubscriptionTiers?.length > 0 && subscriptionTier) {
    if (flag.enabledForSubscriptionTiers.includes(subscriptionTier)) return true;
  }

  // Check rollout percentage
  if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
    // Use user ID hash for consistent rollout
    const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const percentage = hash % 100;
    return percentage < flag.rolloutPercentage;
  }

  // If no targeting rules, flag is enabled globally
  if (
    (!flag.enabledForUsers || flag.enabledForUsers.length === 0) &&
    (!flag.enabledForRoles || flag.enabledForRoles.length === 0) &&
    (!flag.enabledForSubscriptionTiers || flag.enabledForSubscriptionTiers.length === 0)
  ) {
    return true;
  }

  return false;
};

export interface IFeatureFlagModel extends mongoose.Model<IFeatureFlag> {
  isEnabledForUser(
    flagSlug: string,
    userId: string,
    userRoles?: string[],
    subscriptionTier?: string
  ): Promise<boolean>;
}

export const FeatureFlag = mongoose.model<IFeatureFlag, IFeatureFlagModel>(
  'FeatureFlag',
  FeatureFlagSchema
);

export default FeatureFlag;
