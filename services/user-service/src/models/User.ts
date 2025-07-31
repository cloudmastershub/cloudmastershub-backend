import mongoose, { Schema, Document } from 'mongoose';
import { User as IUser, UserRole, SubscriptionPlanType } from '@cloudmastershub/types';

// Re-export UserRole for use in other files
export { UserRole } from '@cloudmastershub/types';

export interface IUserDocument extends Omit<IUser, 'id'>, Document {
  _id: mongoose.Types.ObjectId;
  referredBy?: string; // ID of the user who referred this user
  referralDate?: Date; // When this user was referred
  referrerId?: string; // ID of the user who referred this user (alias for referredBy)
  referralCode?: string; // The referral code used to signup
  isActive?: boolean; // Whether the user is active
  password?: string; // Hashed password (if using email/password auth)
  emailVerified?: boolean;
  lastLogin?: Date;
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
  transform: function(doc, ret) {
    delete ret._id;
    delete ret.__v;
    delete ret.password; // Never return password in JSON
    return ret;
  }
});

const User = mongoose.model<IUserDocument>('User', UserSchema);

export default User;
export { User };