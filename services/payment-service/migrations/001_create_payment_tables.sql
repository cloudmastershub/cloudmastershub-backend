-- CloudMastersHub Payment Service Database Schema
-- Migration 001: Create core payment and subscription tables
-- Run Date: 2024-12-25

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: subscription_plans
-- Stores the available subscription plans (Free, Premium, Enterprise)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    interval VARCHAR(20) NOT NULL CHECK (interval IN ('month', 'year', 'lifetime')),
    features_json JSONB NOT NULL DEFAULT '{}',
    max_courses INTEGER, -- NULL means unlimited
    max_labs INTEGER,    -- NULL means unlimited
    max_storage_gb INTEGER, -- NULL means unlimited
    stripe_price_id VARCHAR(255), -- Stripe Price ID for billing
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: subscriptions
-- Stores user subscription records
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References users table in user service
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete', 'paused')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    stripe_subscription_id VARCHAR(255) UNIQUE, -- Stripe Subscription ID
    stripe_customer_id VARCHAR(255), -- Stripe Customer ID
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: payments
-- Stores payment transaction records
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References users table in user service
    subscription_id UUID REFERENCES subscriptions(id),
    purchase_id UUID, -- References purchases table
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
    payment_method VARCHAR(50), -- 'card', 'bank_transfer', etc.
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    stripe_invoice_id VARCHAR(255),
    failure_reason TEXT,
    metadata_json JSONB DEFAULT '{}',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: payment_methods
-- Stores user payment methods (cards, bank accounts)
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References users table in user service
    type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account', 'wallet')),
    last_four VARCHAR(4),
    brand VARCHAR(50), -- 'visa', 'mastercard', 'amex', etc.
    exp_month INTEGER,
    exp_year INTEGER,
    stripe_payment_method_id VARCHAR(255) UNIQUE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: purchases
-- Stores individual course/learning path purchases
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References users table in user service
    purchasable_type VARCHAR(20) NOT NULL CHECK (purchasable_type IN ('course', 'learning_path')),
    purchasable_id UUID NOT NULL, -- References course or learning_path ID
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    stripe_payment_intent_id VARCHAR(255),
    refund_amount DECIMAL(10, 2) DEFAULT 0.00,
    refunded_at TIMESTAMP WITH TIME ZONE,
    purchased_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for lifetime access
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: user_access
-- Centralized access control mapping (what users have access to)
CREATE TABLE IF NOT EXISTS user_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References users table in user service
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('subscription', 'purchase', 'trial', 'promotion')),
    access_id UUID NOT NULL, -- subscription_id, purchase_id, etc.
    resource_type VARCHAR(20) NOT NULL CHECK (resource_type IN ('platform', 'course', 'learning_path', 'lab')),
    resource_id UUID, -- course_id, learning_path_id, etc. (NULL for platform-wide)
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for permanent access
    revoked_at TIMESTAMP WITH TIME ZONE,
    source VARCHAR(50) NOT NULL, -- 'subscription', 'individual_purchase', 'trial', 'promotion'
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: invoices
-- Stores billing invoices for subscriptions
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- References users table in user service
    subscription_id UUID REFERENCES subscriptions(id),
    stripe_invoice_id VARCHAR(255) UNIQUE,
    invoice_number VARCHAR(100),
    amount_due DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    hosted_invoice_url TEXT,
    invoice_pdf_url TEXT,
    metadata_json JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_purchasable ON purchases(purchasable_type, purchasable_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

CREATE INDEX IF NOT EXISTS idx_user_access_user_id ON user_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_resource ON user_access(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_user_access_active ON user_access(user_id, resource_type) WHERE expires_at IS NULL OR expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Functions to auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_methods_updated_at BEFORE UPDATE ON payment_methods FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_access_updated_at BEFORE UPDATE ON user_access FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE subscription_plans IS 'Available subscription plans with pricing and features';
COMMENT ON TABLE subscriptions IS 'User subscription records linked to Stripe';
COMMENT ON TABLE payments IS 'Payment transaction history';
COMMENT ON TABLE payment_methods IS 'Stored payment methods for users';
COMMENT ON TABLE purchases IS 'Individual course/learning path purchases';
COMMENT ON TABLE user_access IS 'Centralized access control mapping';
COMMENT ON TABLE invoices IS 'Billing invoices for subscriptions';

COMMENT ON COLUMN subscriptions.user_id IS 'References users.id from user-service';
COMMENT ON COLUMN payments.user_id IS 'References users.id from user-service';
COMMENT ON COLUMN payment_methods.user_id IS 'References users.id from user-service';
COMMENT ON COLUMN purchases.user_id IS 'References users.id from user-service';
COMMENT ON COLUMN user_access.user_id IS 'References users.id from user-service';
COMMENT ON COLUMN invoices.user_id IS 'References users.id from user-service';