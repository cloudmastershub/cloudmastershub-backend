-- CloudMastersHub Payment Service
-- Migration 005: Update Stripe Price IDs with real values
-- Run Date: 2025-01-27

-- Update Premium Monthly plan with real Stripe price ID
UPDATE subscription_plans 
SET stripe_price_id = 'price_1ReUzyBDGO3PHkIgoQ4O7oFe'
WHERE name = 'Premium' AND interval = 'month';

-- Update Premium Annual plan with real Stripe price ID
UPDATE subscription_plans 
SET stripe_price_id = 'price_1ReV07BDGO3PHkIg6THNSw1D'
WHERE name = 'Premium Annual' AND interval = 'year';

-- Update Enterprise Monthly plan with real Stripe price ID
UPDATE subscription_plans 
SET stripe_price_id = 'price_1ReV0FBDGO3PHkIgN0IDtmWM'
WHERE name = 'Enterprise' AND interval = 'month';

-- Insert Enterprise Annual plan if it doesn't exist
INSERT INTO subscription_plans (
    id,
    name,
    description,
    price,
    interval,
    features_json,
    max_courses,
    max_labs,
    max_storage_gb,
    stripe_price_id,
    active
) 
SELECT 
    uuid_generate_v4(),
    'Enterprise Annual',
    'Advanced features for teams and organizations (billed annually)',
    948.00, -- $79/month * 12 = $948/year (20% discount)
    'year',
    '{
        "features": [
            "Everything in Premium",
            "Team management",
            "Custom learning paths",
            "Advanced analytics & reporting",
            "SSO integration",
            "API access",
            "Custom branding",
            "Dedicated support",
            "Custom integrations",
            "20% discount"
        ],
        "limits": {
            "lab_hours_per_month": null,
            "concurrent_labs": 10,
            "course_downloads": true,
            "certificate_downloads": true,
            "team_size": 50
        }
    }',
    NULL, -- Unlimited courses
    NULL, -- Unlimited labs
    200,  -- 200GB storage
    'price_1ReV0OBDGO3PHkIgcRjdgx89', -- Real Stripe price ID for Enterprise Annual
    true
WHERE NOT EXISTS (
    SELECT 1 FROM subscription_plans 
    WHERE name = 'Enterprise Annual' AND interval = 'year'
);

-- Update the view to show all plans
DROP VIEW IF EXISTS active_subscription_plans;
CREATE OR REPLACE VIEW active_subscription_plans AS
SELECT 
    id,
    name,
    description,
    price,
    interval,
    features_json,
    max_courses,
    max_labs,
    max_storage_gb,
    stripe_price_id,
    created_at,
    updated_at
FROM subscription_plans 
WHERE active = true 
ORDER BY 
    CASE 
        WHEN name = 'Free' THEN 1
        WHEN name = 'Premium' THEN 2
        WHEN name = 'Premium Annual' THEN 3
        WHEN name = 'Enterprise' THEN 4
        WHEN name = 'Enterprise Annual' THEN 5
        ELSE 6
    END;

-- Comments
COMMENT ON TABLE subscription_plans IS 'Subscription plans with real Stripe price IDs';
COMMENT ON VIEW active_subscription_plans IS 'View of active subscription plans ordered by tier';

-- Verify the updates
-- SELECT name, price, interval, stripe_price_id FROM subscription_plans WHERE active = true;