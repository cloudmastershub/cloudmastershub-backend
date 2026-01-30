-- Migration: 010_trial_and_pause_support.sql
-- Description: Add trial and pause support for hybrid subscription model
-- Date: 2026-01-30

-- ============================================================================
-- ADD PAUSE TRACKING TO SUBSCRIPTIONS TABLE
-- ============================================================================

-- Add pause-related columns to subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pause_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- Update status check constraint to include 'paused' status
-- First drop existing constraint if it exists, then recreate
DO $$
BEGIN
  -- Check if constraint exists and drop it
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_status_check'
  ) THEN
    ALTER TABLE subscriptions DROP CONSTRAINT subscriptions_status_check;
  END IF;

  -- Add updated constraint including 'paused' status
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete', 'paused', 'incomplete_expired'));
EXCEPTION
  WHEN others THEN
    -- Constraint may not exist or already updated, continue
    NULL;
END $$;

-- ============================================================================
-- ADD TRIAL CONFIGURATION TO SUBSCRIPTION_PLANS TABLE
-- ============================================================================

-- Add trial-related columns to subscription_plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_available BOOLEAN DEFAULT false;

-- Update plans with trial settings
-- Basic and Premium plans get 14-day free trial
UPDATE subscription_plans
SET
  trial_days = 14,
  trial_available = true
WHERE tier IN ('basic', 'premium');

-- Free plan has no trial (it's already free)
UPDATE subscription_plans
SET
  trial_days = 0,
  trial_available = false
WHERE tier = 'free';

-- Enterprise/Bootcamp plans typically don't have trials
UPDATE subscription_plans
SET
  trial_days = 0,
  trial_available = false
WHERE tier IN ('enterprise', 'bootcamp');

-- ============================================================================
-- CREATE TRIAL_REMINDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trial_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    reminder_day INTEGER NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    email_template VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_trial_reminders_subscription ON trial_reminders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_trial_reminders_user ON trial_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_reminders_status ON trial_reminders(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_trial_reminders_scheduled ON trial_reminders(scheduled_for) WHERE status = 'pending';

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_trial_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trial_reminders_updated_at ON trial_reminders;
CREATE TRIGGER trial_reminders_updated_at
    BEFORE UPDATE ON trial_reminders
    FOR EACH ROW
    EXECUTE FUNCTION update_trial_reminders_updated_at();

-- ============================================================================
-- CREATE PAUSE_HISTORY TABLE (for audit trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscription_pause_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    paused_at TIMESTAMP WITH TIME ZONE NOT NULL,
    resumed_at TIMESTAMP WITH TIME ZONE,
    pause_reason TEXT,
    pause_duration_days INTEGER,
    stripe_pause_collection_behavior VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for pause history
CREATE INDEX IF NOT EXISTS idx_pause_history_subscription ON subscription_pause_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_pause_history_user ON subscription_pause_history(user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN subscriptions.paused_at IS 'Timestamp when subscription was paused';
COMMENT ON COLUMN subscriptions.pause_expires_at IS 'When the pause period ends (max 30 days from pause)';
COMMENT ON COLUMN subscriptions.pause_reason IS 'User-provided reason for pausing (optional)';

COMMENT ON COLUMN subscription_plans.trial_days IS 'Number of days for free trial (0 for no trial)';
COMMENT ON COLUMN subscription_plans.trial_available IS 'Whether this plan offers a free trial';

COMMENT ON TABLE trial_reminders IS 'Scheduled trial reminder emails (Day 7, 10, 12, 13)';
COMMENT ON COLUMN trial_reminders.reminder_day IS 'Which day of trial this reminder is for (7, 10, 12, 13)';
COMMENT ON COLUMN trial_reminders.scheduled_for IS 'When this reminder should be sent';
COMMENT ON COLUMN trial_reminders.status IS 'pending=not sent, sent=delivered, skipped=user converted/cancelled, failed=send error';
COMMENT ON COLUMN trial_reminders.email_template IS 'Marketing service email template to use';

COMMENT ON TABLE subscription_pause_history IS 'Audit trail for subscription pause/resume actions';
