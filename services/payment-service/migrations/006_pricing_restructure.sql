-- CloudMastersHub Payment Service
-- Migration 006: Pricing Restructure - Add yearly billing columns and bootcamp tables
-- Run Date: 2026-01-24

-- ============================================================================
-- PART 1: Add yearly pricing columns to subscription_plans
-- ============================================================================

-- Add yearly_price column for plans that support yearly billing
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS yearly_price DECIMAL(10, 2);

-- Add stripe_price_id_yearly column for yearly Stripe price
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id_yearly VARCHAR(255);

-- Add tier column for access control (replaces inference from name)
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) CHECK (tier IN ('free', 'basic', 'premium', 'enterprise'));

COMMENT ON COLUMN subscription_plans.yearly_price IS 'Annual price (NULL for plans without yearly option)';
COMMENT ON COLUMN subscription_plans.stripe_price_id_yearly IS 'Stripe Price ID for yearly billing';
COMMENT ON COLUMN subscription_plans.tier IS 'Access tier level for permission checks';

-- ============================================================================
-- PART 2: Create bootcamps table
-- ============================================================================

CREATE TABLE IF NOT EXISTS bootcamps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    duration VARCHAR(50) NOT NULL, -- "4-6 months"
    live_sessions_per_week VARCHAR(20), -- "2-3"

    -- Pricing
    price_full DECIMAL(10, 2) NOT NULL,
    price_full_discounted DECIMAL(10, 2) NOT NULL,
    price_installment_total DECIMAL(10, 2) NOT NULL,
    installment_count INTEGER NOT NULL DEFAULT 4,
    installment_amount DECIMAL(10, 2) NOT NULL,

    -- Benefits
    includes_premium_access BOOLEAN DEFAULT true,
    core_benefits JSONB DEFAULT '[]',
    pay_in_full_benefits JSONB DEFAULT '[]',
    installment_unlock_schedule JSONB DEFAULT '{}',

    -- Curriculum
    curriculum_json JSONB DEFAULT '{}',

    -- Stripe
    stripe_product_id VARCHAR(255),
    stripe_price_id_full VARCHAR(255),
    stripe_price_id_installment VARCHAR(255),

    -- Status
    active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for bootcamps updated_at
CREATE TRIGGER update_bootcamps_updated_at
    BEFORE UPDATE ON bootcamps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for bootcamps
CREATE INDEX IF NOT EXISTS idx_bootcamps_slug ON bootcamps(slug);
CREATE INDEX IF NOT EXISTS idx_bootcamps_active ON bootcamps(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_bootcamps_sort ON bootcamps(sort_order, name);

-- Comments for bootcamps
COMMENT ON TABLE bootcamps IS 'Bootcamp programs with multi-payment options';
COMMENT ON COLUMN bootcamps.price_full IS 'Original full price before discount';
COMMENT ON COLUMN bootcamps.price_full_discounted IS 'Discounted price for pay-in-full';
COMMENT ON COLUMN bootcamps.price_installment_total IS 'Total when paying in installments';
COMMENT ON COLUMN bootcamps.installment_unlock_schedule IS 'JSON mapping installment number to unlocked benefits';
COMMENT ON COLUMN bootcamps.curriculum_json IS 'Structured curriculum data for display';

-- ============================================================================
-- PART 3: Create bootcamp_enrollments table
-- ============================================================================

CREATE TABLE IF NOT EXISTS bootcamp_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    bootcamp_id UUID NOT NULL REFERENCES bootcamps(id) ON DELETE RESTRICT,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('full', 'installment', 'manual')),
    payment_method VARCHAR(50), -- 'stripe', 'cash', 'zelle', 'cashapp'

    -- Payment tracking
    amount_paid DECIMAL(10, 2) DEFAULT 0,
    amount_total DECIMAL(10, 2) NOT NULL,
    installments_paid INTEGER DEFAULT 0,
    next_installment_due TIMESTAMP WITH TIME ZONE,

    -- Stripe references
    stripe_subscription_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_schedule_id VARCHAR(255), -- For subscription schedules

    -- Benefit unlocks
    benefits_unlocked JSONB DEFAULT '[]',

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled', 'paused', 'past_due')),
    enrolled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,

    -- Notes (for manual payments)
    admin_notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for bootcamp_enrollments updated_at
CREATE TRIGGER update_bootcamp_enrollments_updated_at
    BEFORE UPDATE ON bootcamp_enrollments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes for bootcamp_enrollments
CREATE INDEX IF NOT EXISTS idx_bootcamp_enrollments_user ON bootcamp_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_bootcamp_enrollments_bootcamp ON bootcamp_enrollments(bootcamp_id);
CREATE INDEX IF NOT EXISTS idx_bootcamp_enrollments_status ON bootcamp_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_bootcamp_enrollments_stripe_sub ON bootcamp_enrollments(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_bootcamp_enrollments_user_bootcamp ON bootcamp_enrollments(user_id, bootcamp_id);

-- Unique constraint: One active enrollment per user per bootcamp
CREATE UNIQUE INDEX IF NOT EXISTS idx_bootcamp_enrollments_unique_active
    ON bootcamp_enrollments(user_id, bootcamp_id)
    WHERE status IN ('pending', 'active');

-- Comments for bootcamp_enrollments
COMMENT ON TABLE bootcamp_enrollments IS 'User enrollments in bootcamp programs';
COMMENT ON COLUMN bootcamp_enrollments.payment_type IS 'How the user is paying: full, installment, or manual (cash/zelle/etc)';
COMMENT ON COLUMN bootcamp_enrollments.payment_method IS 'Payment method: stripe, cash, zelle, cashapp';
COMMENT ON COLUMN bootcamp_enrollments.benefits_unlocked IS 'Array of benefit identifiers unlocked for this enrollment';
COMMENT ON COLUMN bootcamp_enrollments.stripe_schedule_id IS 'Stripe subscription schedule ID for installment plans';

-- ============================================================================
-- PART 4: Update user_access for bootcamp support
-- ============================================================================

-- Add bootcamp_enrollment to access_type check constraint
ALTER TABLE user_access DROP CONSTRAINT IF EXISTS user_access_access_type_check;
ALTER TABLE user_access ADD CONSTRAINT user_access_access_type_check
    CHECK (access_type IN ('subscription', 'purchase', 'trial', 'promotion', 'bootcamp'));

-- Add bootcamp to resource_type check constraint
ALTER TABLE user_access DROP CONSTRAINT IF EXISTS user_access_resource_type_check;
ALTER TABLE user_access ADD CONSTRAINT user_access_resource_type_check
    CHECK (resource_type IN ('platform', 'course', 'learning_path', 'lab', 'bootcamp'));

COMMENT ON TABLE user_access IS 'Centralized access control mapping (includes bootcamp access)';

-- ============================================================================
-- PART 5: Create views for easy querying
-- ============================================================================

-- Active bootcamps view
CREATE OR REPLACE VIEW active_bootcamps AS
SELECT
    id,
    name,
    slug,
    description,
    duration,
    live_sessions_per_week,
    price_full,
    price_full_discounted,
    price_installment_total,
    installment_count,
    installment_amount,
    includes_premium_access,
    core_benefits,
    pay_in_full_benefits,
    installment_unlock_schedule,
    curriculum_json,
    stripe_product_id,
    stripe_price_id_full,
    stripe_price_id_installment,
    created_at,
    updated_at
FROM bootcamps
WHERE active = true
ORDER BY sort_order ASC, name ASC;

COMMENT ON VIEW active_bootcamps IS 'View of currently active bootcamp programs';

-- User bootcamp access view
CREATE OR REPLACE VIEW user_bootcamp_access AS
SELECT
    be.user_id,
    be.bootcamp_id,
    b.name AS bootcamp_name,
    b.slug AS bootcamp_slug,
    be.payment_type,
    be.status,
    be.amount_paid,
    be.amount_total,
    be.installments_paid,
    be.benefits_unlocked,
    be.enrolled_at,
    b.includes_premium_access
FROM bootcamp_enrollments be
JOIN bootcamps b ON be.bootcamp_id = b.id
WHERE be.status IN ('active', 'completed');

COMMENT ON VIEW user_bootcamp_access IS 'View of user bootcamp enrollments with access info';
