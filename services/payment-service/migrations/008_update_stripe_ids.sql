-- CloudMastersHub Payment Service
-- Migration 008: Update Stripe IDs with real live values
-- Run Date: 2026-01-24
--
-- This migration updates the placeholder Stripe IDs with real live mode IDs

-- ============================================================================
-- PART 1: Update Subscription Plans with real Stripe Price IDs
-- ============================================================================

-- Update Basic plan with real Stripe IDs
UPDATE subscription_plans
SET
    stripe_price_id = 'price_1St9XUBej8Yb7psWbelMMppw',
    stripe_price_id_yearly = 'price_1St9XoBej8Yb7psWwlA5p13y',
    yearly_price = 374.00,
    updated_at = NOW()
WHERE name = 'Basic';

-- Update Premium plan with real Stripe IDs
UPDATE subscription_plans
SET
    stripe_price_id = 'price_1St9YnBej8Yb7psWmWADM5ca',
    stripe_price_id_yearly = 'price_1St9YuBej8Yb7psWi8FDVND2',
    yearly_price = 888.00,
    updated_at = NOW()
WHERE name = 'Premium' AND interval = 'month';

-- ============================================================================
-- PART 2: Update Bootcamps with real Stripe IDs
-- ============================================================================

-- Update DevOps Bootcamp
UPDATE bootcamps
SET
    stripe_product_id = 'prod_TqrHdD4XYWfi4Y',
    stripe_price_id_full = 'price_1St9ZWBej8Yb7psWDVDbWBZu',
    stripe_price_id_installment = 'price_1St9ZYBej8Yb7psWskVwVQTi',
    updated_at = NOW()
WHERE slug = 'devops';

-- Update Cybersecurity Bootcamp
UPDATE bootcamps
SET
    stripe_product_id = 'prod_TqrIqqDLO6SobU',
    stripe_price_id_full = 'price_1St9ZmBej8Yb7psWKAbohqlv',
    stripe_price_id_installment = 'price_1St9ZnBej8Yb7psW1rqKPtCR',
    updated_at = NOW()
WHERE slug = 'cybersecurity';

-- Update MLOps Bootcamp
UPDATE bootcamps
SET
    stripe_product_id = 'prod_TqrIGSZuY7u1HW',
    stripe_price_id_full = 'price_1St9a8Bej8Yb7psWn6I2NIck',
    stripe_price_id_installment = 'price_1St9a9Bej8Yb7psWrDuDljas',
    updated_at = NOW()
WHERE slug = 'mlops';

-- ============================================================================
-- PART 3: Verify the updates
-- ============================================================================

-- Uncomment to verify:
-- SELECT name, price, yearly_price, stripe_price_id, stripe_price_id_yearly
-- FROM subscription_plans WHERE active = true ORDER BY price;
--
-- SELECT name, slug, stripe_product_id, stripe_price_id_full, stripe_price_id_installment
-- FROM bootcamps WHERE active = true ORDER BY sort_order;
