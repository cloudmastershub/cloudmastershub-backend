export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  maxCourses: number | null;
  maxLabs: number | null;
  stripeProductId: string;
  stripePriceId: string;
  active: boolean;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  startedAt: Date;
  expiresAt: Date | null;
  cancelledAt: Date | null;
  stripeSubscriptionId: string;
  trialEndsAt: Date | null;
  plan: SubscriptionPlan;
}

export interface SubscriptionStatus {
  userId: string;
  hasActiveSubscription: boolean;
  subscription: UserSubscription | null;
  plan: SubscriptionPlan | null;
  accessLevel: 'free' | 'premium' | 'enterprise';
  maxCourses: number | null;
  maxLabs: number | null;
  canAccessPremiumContent: boolean;
  canCreateCourses: boolean;
  canCreateLabs: boolean;
}

export interface UserAccess {
  id: string;
  userId: string;
  accessType: 'platform' | 'course' | 'learning_path' | 'lab';
  accessId: string;
  grantedAt: Date;
  expiresAt: Date | null;
  source: 'subscription' | 'purchase' | 'trial' | 'admin_grant';
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card' | 'bank_account';
  lastFour: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string;
  stripePaymentMethodId: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  subscriptionId?: string;
  purchaseId?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface Purchase {
  id: string;
  userId: string;
  purchasableType: 'course' | 'learning_path';
  purchasableId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripePaymentIntentId: string;
  purchasedAt: Date;
  refundedAt?: Date;
  refundReason?: string;
}

export interface Invoice {
  id: string;
  userId: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  stripeInvoiceId: string;
  pdfUrl?: string;
  hostedInvoiceUrl?: string;
  createdAt: Date;
  paidAt?: Date;
  dueDate?: Date;
}

export interface CheckoutSessionRequest {
  userId: string;
  planId?: string;
  purchaseType?: 'subscription' | 'course' | 'learning_path';
  purchaseId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResponse {
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: {
    message: string;
    code?: string;
  };
}

export interface PaymentServiceRequest {
  userId: string;
  action: 'get_subscription_status' | 'verify_access' | 'check_usage_limits' | 'update_subscription';
  resourceType?: 'course' | 'learning_path' | 'lab' | 'platform';
  resourceId?: string;
  metadata?: Record<string, any>;
}

export interface PaymentServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

export interface AccessVerificationRequest {
  userId: string;
  resourceType: 'course' | 'learning_path' | 'lab' | 'platform';
  resourceId?: string;
  requiredPlan?: 'free' | 'premium' | 'enterprise';
}

export interface AccessVerificationResponse {
  hasAccess: boolean;
  accessLevel: 'free' | 'premium' | 'enterprise';
  source: 'subscription' | 'purchase' | 'trial' | 'admin_grant' | 'none';
  subscription?: UserSubscription;
  purchase?: Purchase;
  reason?: string;
  upgradeRequired?: boolean;
  suggestedPlan?: SubscriptionPlan;
}

export interface UsageLimitsRequest {
  userId: string;
  resourceType: 'course' | 'lab';
  action: 'check' | 'increment' | 'decrement';
}

export interface UsageLimitsResponse {
  withinLimits: boolean;
  currentUsage: number;
  maxAllowed: number | null;
  subscription?: UserSubscription;
  upgradeRequired?: boolean;
  suggestedPlan?: SubscriptionPlan;
}

export interface PaymentEvent {
  type: 'subscription.created' | 'subscription.updated' | 'subscription.cancelled' | 
        'purchase.completed' | 'payment.succeeded' | 'payment.failed' |
        'access.granted' | 'access.revoked';
  userId: string;
  subscriptionId?: string;
  purchaseId?: string;
  paymentId?: string;
  resourceType?: string;
  resourceId?: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface RefundRequest {
  purchaseId?: string;
  paymentId?: string;
  amount?: number;
  reason: string;
  adminUserId: string;
}

export interface RefundResponse {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: 'pending' | 'succeeded' | 'failed';
  error?: {
    message: string;
    code?: string;
  };
}

export enum SubscriptionPlanType {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  REFUNDED = 'refunded'
}

export enum SubscriptionStatusType {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing'
}

export enum AccessType {
  PLATFORM = 'platform',
  COURSE = 'course',
  LEARNING_PATH = 'learning_path',
  LAB = 'lab'
}

export enum AccessSource {
  SUBSCRIPTION = 'subscription',
  PURCHASE = 'purchase',
  TRIAL = 'trial',
  ADMIN_GRANT = 'admin_grant'
}