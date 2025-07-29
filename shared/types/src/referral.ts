export interface ReferralCommissionSettings {
  id: string;
  userId: string; // referrer user ID
  userType: 'normal' | 'subscribed';
  initialCommissionRate: number; // percentage (e.g., 20 for 20%)
  recurringCommissionRate: number; // percentage (e.g., 10 for 10%)
  paymentModel: 'recurring' | 'one-time';
  isActive: boolean;
  customRates: boolean; // true if admin has set custom rates
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralEarning {
  id: string;
  referrerId: string; // user who made the referral
  referredUserId: string; // user who was referred
  transactionId: string; // payment transaction ID
  transactionType: 'subscription' | 'course_purchase' | 'upgrade';
  earningType: 'initial' | 'recurring';
  grossAmount: number; // original transaction amount
  commissionRate: number; // percentage applied
  earningAmount: number; // actual commission earned
  currency: string;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  eligibleForPayoutAt: Date; // 30 days after earning
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralPayoutRequest {
  id: string;
  referrerId: string;
  requestedAmount: number;
  currency: string;
  earningIds: string[]; // array of ReferralEarning IDs included in this payout
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  paymentMethod: 'paypal' | 'bank_transfer' | 'stripe';
  paymentDetails: any; // payment method specific details
  adminNote?: string;
  processedAt?: Date;
  processedBy?: string; // admin user ID
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number; // referred users who are still active
  totalEarnings: number;
  pendingEarnings: number;
  paidEarnings: number;
  conversionRate: number; // percentage of referred users who made a purchase
  thisMonthReferrals: number;
  thisMonthEarnings: number;
}

export interface ReferralLink {
  userId: string;
  referralCode: string; // unique code for the user
  clicks: number;
  conversions: number;
  lastUsed?: Date;
  createdAt: Date;
}

// Admin dashboard types
export interface AdminReferralOverview {
  totalReferrers: number;
  activeReferrers: number;
  totalEarnings: number;
  pendingPayouts: number;
  thisMonthStats: {
    newReferrers: number;
    totalEarnings: number;
    conversions: number;
  };
}

export interface ReferrerPerformance {
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'normal' | 'subscribed';
  totalReferrals: number;
  activeReferrals: number;
  totalEarnings: number;
  pendingEarnings: number;
  conversionRate: number;
  lastActivity: Date;
  joinedAt: Date;
}

// API request/response types
export interface CreateReferralEarningRequest {
  referredUserId: string;
  transactionId: string;
  transactionType: 'subscription' | 'course_purchase' | 'upgrade';
  grossAmount: number;
  currency: string;
}

export interface PayoutRequestData {
  requestedAmount: number;
  currency: string;
  paymentMethod: 'paypal' | 'bank_transfer' | 'stripe';
  paymentDetails: any;
}

export interface UpdatePayoutRequest {
  status: 'approved' | 'rejected' | 'paid' | 'cancelled';
  adminNote?: string;
}

export interface ReferralFilters {
  userType?: 'normal' | 'subscribed';
  status?: 'active' | 'inactive';
  sortBy?: 'earnings' | 'referrals' | 'conversion_rate' | 'recent_activity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface EarningFilters {
  status?: 'pending' | 'approved' | 'paid' | 'cancelled';
  earningType?: 'initial' | 'recurring';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}