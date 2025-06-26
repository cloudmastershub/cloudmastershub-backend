-- CloudMastersHub Payment Service Seed Data
-- Migration 002: Insert default subscription plans
-- Run Date: 2024-12-25

-- Insert default subscription plans
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
) VALUES 
-- Free Plan
(
    uuid_generate_v4(),
    'Free',
    'Get started with basic cloud learning',
    0.00,
    'lifetime',
    '{
        "features": [
            "Access to free courses",
            "Basic labs (2 hours/month)",
            "Community support",
            "Basic progress tracking"
        ],
        "limits": {
            "lab_hours_per_month": 2,
            "concurrent_labs": 1,
            "course_downloads": false,
            "certificate_downloads": false
        }
    }',
    NULL, -- No limit on free courses
    2,    -- 2 hours of labs per month
    1,    -- 1GB storage
    NULL, -- No Stripe price needed for free
    true
),
-- Premium Plan
(
    uuid_generate_v4(),
    'Premium',
    'Full access to all courses and advanced features',
    39.00,
    'month',
    '{
        "features": [
            "Access to all courses",
            "Unlimited labs",
            "Priority support",
            "Advanced analytics",
            "Course downloads",
            "Certificate downloads",
            "Learning paths",
            "Practice exams"
        ],
        "limits": {
            "lab_hours_per_month": null,
            "concurrent_labs": 3,
            "course_downloads": true,
            "certificate_downloads": true
        }
    }',
    NULL, -- Unlimited courses
    NULL, -- Unlimited labs
    50,   -- 50GB storage
    NULL, -- Set when Stripe prices are created
    true
),
-- Premium Annual Plan (discounted)
(
    uuid_generate_v4(),
    'Premium Annual',
    'Full access to all courses and advanced features (billed annually)',
    348.00, -- $29/month * 12 = $348/year (25% discount)
    'year',
    '{
        "features": [
            "Access to all courses",
            "Unlimited labs",
            "Priority support",
            "Advanced analytics",
            "Course downloads",
            "Certificate downloads",
            "Learning paths",
            "Practice exams",
            "25% discount"
        ],
        "limits": {
            "lab_hours_per_month": null,
            "concurrent_labs": 3,
            "course_downloads": true,
            "certificate_downloads": true
        }
    }',
    NULL, -- Unlimited courses
    NULL, -- Unlimited labs
    50,   -- 50GB storage
    NULL, -- Set when Stripe prices are created
    true
),
-- Enterprise Plan
(
    uuid_generate_v4(),
    'Enterprise',
    'Advanced features for teams and organizations',
    99.00,
    'month',
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
            "Custom integrations"
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
    NULL, -- Set when Stripe prices are created
    true
);

-- Create a view for easier access to active plans
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
ORDER BY price ASC;

-- Grant permissions (adjust based on your database user setup)
-- GRANT SELECT ON active_subscription_plans TO payment_service_user;

-- Comments
COMMENT ON VIEW active_subscription_plans IS 'View of currently active subscription plans';

-- Example of how to update Stripe price IDs after creating them in Stripe
-- UPDATE subscription_plans SET stripe_price_id = 'price_stripe_id_here' WHERE name = 'Premium';
-- UPDATE subscription_plans SET stripe_price_id = 'price_stripe_id_here' WHERE name = 'Premium Annual';
-- UPDATE subscription_plans SET stripe_price_id = 'price_stripe_id_here' WHERE name = 'Enterprise';