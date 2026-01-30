export interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price: number;
  yearly_price?: number;
  currency: string;
  interval: 'month' | 'year' | 'lifetime';
  stripe_price_id: string;
  stripe_price_id_yearly?: string;
  stripe_product_id?: string;
  features?: string[];
  features_json?: {
    features: string[];
    limits?: {
      lab_hours_per_month: number | null;
      concurrent_labs: number;
      course_downloads: boolean;
      certificate_downloads: boolean;
    };
  };
  max_courses: number | null;
  max_labs: number | null;
  max_storage_gb?: number | null;
  active: boolean;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  // Trial configuration
  trial_days: number;
  trial_available: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete' | 'paused' | 'incomplete_expired';
  started_at: Date;
  expires_at: Date | null;
  cancelled_at: Date | null;
  stripe_subscription_id: string;
  stripe_customer_id?: string;
  trial_ends_at: Date | null;
  // Pause tracking
  paused_at: Date | null;
  pause_expires_at: Date | null;
  pause_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  stripe_payment_intent_id: string;
  metadata_json: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  type: 'card' | 'bank_account';
  last_four: string;
  stripe_payment_method_id: string;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Purchase {
  id: string;
  user_id: string;
  purchasable_type: 'course' | 'learning_path';
  purchasable_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripe_payment_intent_id: string;
  purchased_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UserAccess {
  id: string;
  user_id: string;
  access_type: 'subscription' | 'purchase';
  access_id: string; // subscription_id or purchase_id
  granted_at: Date;
  expires_at: Date | null;
  source: 'platform' | 'individual' | 'trial';
  created_at: Date;
  updated_at: Date;
}

// Request/Response DTOs
export interface CreateSubscriptionRequest {
  user_id: string;
  plan_id: string;
  payment_method_id?: string;
}

export interface CreatePurchaseRequest {
  user_id: string;
  purchasable_type: 'course' | 'learning_path';
  purchasable_id: string;
  amount: number;
  currency: string;
}

export interface SubscriptionStatusResponse {
  user_id: string;
  subscription: {
    id: string;
    plan: SubscriptionPlan;
    status: string;
    started_at: Date;
    expires_at: Date | null;
    trial_ends_at: Date | null;
  } | null;
  purchases: Purchase[];
  access: UserAccess[];
}

export interface CreateCheckoutSessionRequest {
  user_id: string;
  type: 'subscription' | 'purchase';
  plan_id?: string;
  billing_cycle?: 'monthly' | 'yearly';
  purchasable_type?: 'course' | 'learning_path';
  purchasable_id?: string;
  success_url: string;
  cancel_url: string;
}