import mongoose, { Schema, Document } from 'mongoose';

// Referral Commission Settings Model
export interface IReferralCommissionSettings extends Document {
  userId: string;
  userType: 'normal' | 'subscribed';
  initialCommissionRate: number;
  recurringCommissionRate: number;
  paymentModel: 'recurring' | 'one-time';
  isActive: boolean;
  customRates: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralCommissionSettingsSchema = new Schema<IReferralCommissionSettings>({
  userId: { type: String, required: true, unique: true },
  userType: { 
    type: String, 
    enum: ['normal', 'subscribed'], 
    required: true 
  },
  initialCommissionRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  recurringCommissionRate: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100
  },
  paymentModel: {
    type: String,
    enum: ['recurring', 'one-time'],
    default: 'recurring'
  },
  isActive: { type: Boolean, default: true },
  customRates: { type: Boolean, default: false }
}, {
  timestamps: true,
  collection: 'referral_commission_settings'
});

// Index for efficient queries
ReferralCommissionSettingsSchema.index({ userId: 1 });
ReferralCommissionSettingsSchema.index({ userType: 1, isActive: 1 });

// Referral Earning Model
export interface IReferralEarning extends Document {
  referrerId: string;
  referredUserId: string;
  transactionId: string;
  transactionType: 'subscription' | 'course_purchase' | 'upgrade';
  earningType: 'initial' | 'recurring';
  grossAmount: number;
  commissionRate: number;
  earningAmount: number;
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  eligibleForPayoutAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralEarningSchema = new Schema<IReferralEarning>({
  referrerId: { type: String, required: true, index: true },
  referredUserId: { type: String, required: true, index: true },
  transactionId: { type: String, required: true, unique: true },
  transactionType: {
    type: String,
    enum: ['subscription', 'course_purchase', 'upgrade'],
    required: true
  },
  earningType: {
    type: String,
    enum: ['initial', 'recurring'],
    required: true
  },
  grossAmount: { type: Number, required: true, min: 0 },
  commissionRate: { type: Number, required: true, min: 0, max: 100 },
  earningAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'USD' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  eligibleForPayoutAt: { type: Date, required: true }
}, {
  timestamps: true,
  collection: 'referral_earnings'
});

// Indexes for efficient queries
ReferralEarningSchema.index({ referrerId: 1, status: 1 });
ReferralEarningSchema.index({ eligibleForPayoutAt: 1, status: 1 });
ReferralEarningSchema.index({ referredUserId: 1 });
ReferralEarningSchema.index({ transactionId: 1 });

// Pre-save middleware to calculate eligible payout date (30 days from creation)
ReferralEarningSchema.pre('save', function(next) {
  if (this.isNew) {
    const eligibleDate = new Date();
    eligibleDate.setDate(eligibleDate.getDate() + 30);
    this.eligibleForPayoutAt = eligibleDate;
  }
  next();
});

// Referral Payout Request Model
export interface IReferralPayoutRequest extends Document {
  referrerId: string;
  requestedAmount: number;
  currency: string;
  earningIds: string[];
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  paymentMethod: 'paypal' | 'bank_transfer' | 'stripe';
  paymentDetails: any;
  adminNote?: string;
  processedAt?: Date;
  processedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralPayoutRequestSchema = new Schema<IReferralPayoutRequest>({
  referrerId: { type: String, required: true, index: true },
  requestedAmount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true, default: 'USD' },
  earningIds: [{ type: String, required: true }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'paid', 'cancelled'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['paypal', 'bank_transfer', 'stripe'],
    required: true
  },
  paymentDetails: { type: Schema.Types.Mixed, required: true },
  adminNote: { type: String },
  processedAt: { type: Date },
  processedBy: { type: String }
}, {
  timestamps: true,
  collection: 'referral_payout_requests'
});

// Indexes for efficient queries
ReferralPayoutRequestSchema.index({ referrerId: 1, status: 1 });
ReferralPayoutRequestSchema.index({ status: 1, createdAt: -1 });
ReferralPayoutRequestSchema.index({ processedBy: 1 });

// Referral Link Model
export interface IReferralLink extends Document {
  userId: string;
  referralCode: string;
  clicks: number;
  conversions: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralLinkSchema = new Schema<IReferralLink>({
  userId: { type: String, required: true, unique: true },
  referralCode: { 
    type: String, 
    unique: true,
    validate: {
      validator: function(v: string) {
        return v && v.length > 0;
      },
      message: 'Referral code must be generated and cannot be empty'
    }
  },
  clicks: { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  lastUsed: { type: Date }
}, {
  timestamps: true,
  collection: 'referral_links'
});

// Indexes
ReferralLinkSchema.index({ userId: 1 });
ReferralLinkSchema.index({ referralCode: 1 });

// Pre-save middleware to generate unique referral code
ReferralLinkSchema.pre('save', async function(next) {
  if (this.isNew && !this.referralCode) {
    try {
      // Generate a unique referral code based on user ID and timestamp
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 8);
      
      // Clean userId for referral code (remove @ and . characters, take first 8 chars)
      const cleanUserId = this.userId.replace(/[@.]/g, '').substring(0, 8);
      this.referralCode = `${cleanUserId}-${timestamp}-${randomStr}`.toLowerCase();
      
      // Ensure uniqueness by checking if code already exists
      let attempts = 0;
      while (attempts < 5) {
        const existing = await mongoose.models.ReferralLink?.findOne({ referralCode: this.referralCode });
        if (!existing) break;
        
        // Generate new code if collision
        const newRandomStr = Math.random().toString(36).substring(2, 8);
        this.referralCode = `${cleanUserId}-${timestamp}-${newRandomStr}`.toLowerCase();
        attempts++;
      }
    } catch (error) {
      console.error('Error generating referral code:', error);
      // Fallback: simple timestamp-based code
      const fallbackCode = `ref-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      this.referralCode = fallbackCode;
    }
  }
  next();
});

// Export models
export const ReferralCommissionSettings = mongoose.model<IReferralCommissionSettings>(
  'ReferralCommissionSettings', 
  ReferralCommissionSettingsSchema
);

export const ReferralEarning = mongoose.model<IReferralEarning>(
  'ReferralEarning', 
  ReferralEarningSchema
);

export const ReferralPayoutRequest = mongoose.model<IReferralPayoutRequest>(
  'ReferralPayoutRequest', 
  ReferralPayoutRequestSchema
);

export const ReferralLink = mongoose.model<IReferralLink>(
  'ReferralLink', 
  ReferralLinkSchema
);