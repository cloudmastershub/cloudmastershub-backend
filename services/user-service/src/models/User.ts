import mongoose, { Schema, Document } from 'mongoose';
import { User as IUser, UserRole, SubscriptionPlanType } from '@cloudmastershub/types';

// Re-export UserRole for use in other files
export { UserRole } from '@cloudmastershub/types';

export interface INotificationPreferences {
  emailPreferences?: {
    marketing?: boolean;
    transactional?: boolean;
    courseUpdates?: boolean;
    communityUpdates?: boolean;
    securityAlerts?: boolean;
    weeklyDigest?: boolean;
  };
  pushPreferences?: {
    enabled?: boolean;
    courseReminders?: boolean;
    messages?: boolean;
    achievements?: boolean;
  };
  emailFrequency?: 'instant' | 'daily' | 'weekly' | 'never';
  unsubscribedAt?: Date;
}

export interface IUserDocument extends Omit<IUser, 'id'>, Document {
  _id: mongoose.Types.ObjectId;
  referredBy?: string;
  referralDate?: Date;
  referrerId?: string;
  referralCode?: string;
  isActive?: boolean;
  password?: string;
  emailVerified?: boolean;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  notificationPreferences?: INotificationPreferences;
}

const UserSchema = new Schema<IUserDocument>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
  },
  bio: { 
    type: String,
    maxlength: 500
  },
  avatar: { 
    type: String 
  },
  subscription: { 
    type: String, 
    enum: Object.values(SubscriptionPlanType),
    default: SubscriptionPlanType.FREE
  },
  roles: [{ 
    type: String, 
    enum: Object.values(UserRole),
    default: [UserRole.STUDENT]
  }],
  // Referral fields
  referredBy: { 
    type: String,
    index: true
  },
  referralDate: { 
    type: Date
  },
  referrerId: { 
    type: String,
    index: true
  },
  referralCode: { 
    type: String
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // Auth fields
  password: {
    type: String
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  // Password reset fields
  passwordResetToken: {
    type: String,
    index: true
  },
  passwordResetExpires: {
    type: Date
  },
  // Email verification fields
  emailVerificationToken: {
    type: String,
    index: true
  },
  emailVerificationExpires: {
    type: Date
  },
  // Notification preferences
  notificationPreferences: {
    emailPreferences: {
      marketing: { type: Boolean, default: true },
      transactional: { type: Boolean, default: true },
      courseUpdates: { type: Boolean, default: true },
      communityUpdates: { type: Boolean, default: true },
      securityAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: true },
    },
    pushPreferences: {
      enabled: { type: Boolean, default: false },
      courseReminders: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      achievements: { type: Boolean, default: true },
    },
    emailFrequency: {
      type: String,
      enum: ['instant', 'daily', 'weekly', 'never'],
      default: 'instant',
    },
    unsubscribedAt: { type: Date },
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes for efficient queries
UserSchema.index({ email: 1 });
UserSchema.index({ referredBy: 1 });
UserSchema.index({ referrerId: 1 });
UserSchema.index({ referralCode: 1 });
UserSchema.index({ subscription: 1, roles: 1 });
UserSchema.index({ isActive: 1 });
UserSchema.index({ createdAt: -1 });

// Virtual for full name
UserSchema.virtual('name').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for ID (convert _id to string)
UserSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc: any, ret: any) {
    delete ret._id;
    delete ret.__v;
    delete ret.password; // Never return password in JSON
    return ret;
  }
});

const User = mongoose.model<IUserDocument>('User', UserSchema);

export default User;
export { User };