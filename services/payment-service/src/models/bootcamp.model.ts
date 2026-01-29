// Bootcamp and Enrollment types for CloudMastersHub

// ============================================================================
// SESSION TYPES
// ============================================================================

export type BootcampSessionStatus = 'upcoming' | 'ongoing' | 'ended';

export interface BootcampSession {
  id: string;
  bootcamp_id: string;
  name: string;
  slug: string;
  start_date: Date;
  end_date: Date;
  status: BootcampSessionStatus;
  enrollment_open: boolean;
  max_capacity?: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface BootcampSessionWithStats extends BootcampSession {
  enrollment_count?: number;
  bootcamp_name?: string;
}

export interface CreateSessionRequest {
  name: string;
  slug: string;
  start_date: string; // ISO date string
  end_date: string;   // ISO date string
  status?: BootcampSessionStatus;
  enrollment_open?: boolean;
  max_capacity?: number;
  description?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  slug?: string;
  start_date?: string;
  end_date?: string;
  status?: BootcampSessionStatus;
  enrollment_open?: boolean;
  max_capacity?: number;
  description?: string;
}

// Helper to convert DB row to BootcampSession
export function rowToSession(row: any): BootcampSession {
  return {
    id: row.id,
    bootcamp_id: row.bootcamp_id,
    name: row.name,
    slug: row.slug,
    start_date: new Date(row.start_date),
    end_date: new Date(row.end_date),
    status: row.status,
    enrollment_open: row.enrollment_open,
    max_capacity: row.max_capacity || undefined,
    description: row.description || undefined,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// Helper to convert DB row to BootcampSessionWithStats
export function rowToSessionWithStats(row: any): BootcampSessionWithStats {
  return {
    ...rowToSession(row),
    enrollment_count: row.enrollment_count ? parseInt(row.enrollment_count) : undefined,
    bootcamp_name: row.bootcamp_name || undefined,
  };
}

// ============================================================================
// CURRICULUM TYPES
// ============================================================================

export interface CurriculumModule {
  title: string;
  weeks: number;
  topics: string[];
}

export interface CurriculumData {
  modules: CurriculumModule[];
  total_weeks: number;
  projects: number;
  labs: number;
}

export interface Bootcamp {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration: string;
  live_sessions_per_week?: string;

  // Pricing
  price_full: number;
  price_full_discounted: number;
  price_installment_total: number;
  installment_count: number;
  installment_amount: number;

  // Benefits
  includes_premium_access: boolean;
  core_benefits: string[];
  pay_in_full_benefits: string[];
  installment_unlock_schedule: Record<number, string[]>;

  // Curriculum
  curriculum_json: CurriculumData;

  // Stripe
  stripe_product_id?: string;
  stripe_price_id_full?: string;
  stripe_price_id_installment?: string;

  // Status
  active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export type BootcampPaymentType = 'full' | 'installment' | 'manual';
export type BootcampPaymentMethod = 'stripe' | 'cash' | 'zelle' | 'cashapp';
export type BootcampEnrollmentStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'paused' | 'past_due';

export interface BootcampEnrollment {
  id: string;
  user_id: string;
  bootcamp_id: string;
  session_id?: string; // Optional reference to specific bootcamp session
  payment_type: BootcampPaymentType;
  payment_method?: BootcampPaymentMethod;

  // Payment tracking
  amount_paid: number;
  amount_total: number;
  installments_paid: number;
  next_installment_due?: Date;

  // Stripe references
  stripe_subscription_id?: string;
  stripe_payment_intent_id?: string;
  stripe_schedule_id?: string;

  // Benefit unlocks
  benefits_unlocked: string[];

  // Status
  status: BootcampEnrollmentStatus;
  enrolled_at?: Date;
  completed_at?: Date;
  cancelled_at?: Date;

  // Notes
  admin_notes?: string;

  created_at: Date;
  updated_at: Date;
}

// Enrollment with bootcamp details
export interface BootcampEnrollmentWithDetails extends BootcampEnrollment {
  bootcamp: Bootcamp;
}

// Request DTOs
export interface CreateBootcampRequest {
  name: string;
  slug: string;
  description?: string;
  duration: string;
  live_sessions_per_week?: string;
  price_full: number;
  price_full_discounted: number;
  price_installment_total: number;
  installment_count: number;
  installment_amount: number;
  includes_premium_access?: boolean;
  core_benefits?: string[];
  pay_in_full_benefits?: string[];
  installment_unlock_schedule?: Record<number, string[]>;
  curriculum_json?: CurriculumData;
  stripe_product_id?: string;
  stripe_price_id_full?: string;
  stripe_price_id_installment?: string;
  sort_order?: number;
  active?: boolean;
}

export interface UpdateBootcampRequest extends Partial<CreateBootcampRequest> {
  id: string;
}

export interface BootcampCheckoutRequest {
  user_id: string;
  bootcamp_id: string;
  session_id?: string; // Optional session for cohort-based enrollment
  payment_type: 'full' | 'installment';
  success_url: string;
  cancel_url: string;
}

export interface ManualEnrollmentRequest {
  user_id: string;
  bootcamp_id: string;
  session_id?: string; // Optional session for cohort-based enrollment
  payment_method: 'cash' | 'zelle' | 'cashapp';
  amount_paid?: number;
  admin_notes?: string;
}

export interface UpdateEnrollmentRequest {
  enrollment_id: string;
  amount_paid?: number;
  installments_paid?: number;
  status?: BootcampEnrollmentStatus;
  benefits_unlocked?: string[];
  admin_notes?: string;
}

// Response DTOs
export interface BootcampListResponse {
  success: boolean;
  data: Bootcamp[];
}

export interface BootcampResponse {
  success: boolean;
  data: Bootcamp;
}

export interface BootcampCheckoutResponse {
  success: boolean;
  checkout_url: string;
  session_id: string;
}

export interface EnrollmentListResponse {
  success: boolean;
  data: BootcampEnrollmentWithDetails[];
}

export interface EnrollmentResponse {
  success: boolean;
  data: BootcampEnrollment;
}

// For public API (limited data)
export interface BootcampPublic {
  id: string;
  name: string;
  slug: string;
  description?: string;
  duration: string;
  live_sessions_per_week?: string;
  price_full: number;
  price_full_discounted: number;
  price_installment_total: number;
  installment_count: number;
  installment_amount: number;
  includes_premium_access: boolean;
  core_benefits: string[];
  pay_in_full_benefits: string[];
  installment_unlock_schedule: Record<number, string[]>;
  curriculum_json: CurriculumData;
}

// Helper to convert DB row to Bootcamp
export function rowToBootcamp(row: any): Bootcamp {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    duration: row.duration,
    live_sessions_per_week: row.live_sessions_per_week,
    price_full: parseFloat(row.price_full),
    price_full_discounted: parseFloat(row.price_full_discounted),
    price_installment_total: parseFloat(row.price_installment_total),
    installment_count: row.installment_count,
    installment_amount: parseFloat(row.installment_amount),
    includes_premium_access: row.includes_premium_access,
    core_benefits: row.core_benefits || [],
    pay_in_full_benefits: row.pay_in_full_benefits || [],
    installment_unlock_schedule: row.installment_unlock_schedule || {},
    curriculum_json: row.curriculum_json || { modules: [], total_weeks: 0, projects: 0, labs: 0 },
    stripe_product_id: row.stripe_product_id,
    stripe_price_id_full: row.stripe_price_id_full,
    stripe_price_id_installment: row.stripe_price_id_installment,
    active: row.active,
    sort_order: row.sort_order || 0,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

// Helper to convert DB row to BootcampEnrollment
export function rowToEnrollment(row: any): BootcampEnrollment {
  return {
    id: row.id,
    user_id: row.user_id,
    bootcamp_id: row.bootcamp_id,
    session_id: row.session_id || undefined,
    payment_type: row.payment_type,
    payment_method: row.payment_method,
    amount_paid: parseFloat(row.amount_paid || '0'),
    amount_total: parseFloat(row.amount_total),
    installments_paid: row.installments_paid || 0,
    next_installment_due: row.next_installment_due ? new Date(row.next_installment_due) : undefined,
    stripe_subscription_id: row.stripe_subscription_id,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    stripe_schedule_id: row.stripe_schedule_id,
    benefits_unlocked: row.benefits_unlocked || [],
    status: row.status,
    enrolled_at: row.enrolled_at ? new Date(row.enrolled_at) : undefined,
    completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
    cancelled_at: row.cancelled_at ? new Date(row.cancelled_at) : undefined,
    admin_notes: row.admin_notes,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}
