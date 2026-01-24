-- CloudMastersHub Payment Service
-- Migration 007: Seed new pricing structure and bootcamps
-- Run Date: 2026-01-24
--
-- New Pricing Structure:
-- - Free: $0 (unchanged)
-- - Basic: $39/mo, $374/yr (new)
-- - Premium: $99/mo, $888/yr (updated from $39)
-- - Enterprise: Removed
-- - Bootcamps: 3 programs with full/installment options

-- ============================================================================
-- PART 1: Deactivate old plans we're replacing
-- ============================================================================

-- Deactivate Enterprise and Premium Annual (they'll be replaced)
UPDATE subscription_plans
SET active = false, updated_at = NOW()
WHERE name IN ('Enterprise', 'Enterprise Annual', 'Premium Annual');

-- ============================================================================
-- PART 2: Update existing Premium plan
-- ============================================================================

UPDATE subscription_plans
SET
    price = 99.00,
    yearly_price = 888.00,
    tier = 'premium',
    description = 'Full access to all courses, labs, and premium features',
    features_json = '{
        "features": [
            "Access to ALL courses",
            "Unlimited lab hours",
            "Priority support",
            "Advanced analytics & progress tracking",
            "Course downloads for offline viewing",
            "Certificate of completion",
            "Custom learning paths",
            "Practice exams & assessments",
            "Community access",
            "Monthly live Q&A sessions"
        ],
        "limits": {
            "lab_hours_per_month": null,
            "concurrent_labs": 5,
            "course_downloads": true,
            "certificate_downloads": true
        }
    }',
    stripe_price_id = 'price_premium_monthly_99',
    stripe_price_id_yearly = 'price_premium_yearly_888',
    max_courses = NULL,
    max_labs = NULL,
    max_storage_gb = 100,
    updated_at = NOW()
WHERE name = 'Premium' AND interval = 'month';

-- Set tier for Free plan
UPDATE subscription_plans
SET tier = 'free', updated_at = NOW()
WHERE name = 'Free';

-- ============================================================================
-- PART 3: Insert Basic plan
-- ============================================================================

INSERT INTO subscription_plans (
    id,
    name,
    description,
    price,
    yearly_price,
    interval,
    tier,
    features_json,
    max_courses,
    max_labs,
    max_storage_gb,
    stripe_price_id,
    stripe_price_id_yearly,
    active
) VALUES (
    uuid_generate_v4(),
    'Basic',
    'Great for getting started with cloud learning',
    39.00,
    374.00,
    'month',
    'basic',
    '{
        "features": [
            "Access to beginner & intermediate courses",
            "10 lab hours per month",
            "Email support",
            "Basic progress tracking",
            "Course completion certificates",
            "Community forum access"
        ],
        "limits": {
            "lab_hours_per_month": 10,
            "concurrent_labs": 2,
            "course_downloads": false,
            "certificate_downloads": true
        }
    }',
    NULL,
    10,
    10,
    'price_basic_monthly_39',
    'price_basic_yearly_374',
    true
)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    price = EXCLUDED.price,
    yearly_price = EXCLUDED.yearly_price,
    tier = EXCLUDED.tier,
    features_json = EXCLUDED.features_json,
    max_labs = EXCLUDED.max_labs,
    max_storage_gb = EXCLUDED.max_storage_gb,
    stripe_price_id = EXCLUDED.stripe_price_id,
    stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
    active = EXCLUDED.active,
    updated_at = NOW();

-- ============================================================================
-- PART 4: Seed Bootcamp Programs
-- ============================================================================

-- DevOps Bootcamp
INSERT INTO bootcamps (
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
    sort_order,
    active
) VALUES (
    uuid_generate_v4(),
    'DevOps Engineering Bootcamp',
    'devops',
    'Master CI/CD, containerization, Kubernetes, and cloud infrastructure. Build real-world pipelines and deploy applications at scale.',
    '4-6 months',
    '2-3',
    2500.00,
    2300.00,
    2500.00,
    4,
    625.00,
    true,
    '[
        "Live instructor-led sessions",
        "Real-world project portfolio",
        "1-on-1 mentorship sessions",
        "Career coaching & resume review",
        "Slack community access",
        "Job placement assistance",
        "Certificate of completion"
    ]',
    '[
        "Immediate access to all modules",
        "Bonus: Interview prep course",
        "Lifetime access to recordings",
        "Priority mentor scheduling"
    ]',
    '{
        "1": ["Module 1-2 access", "Slack community"],
        "2": ["Module 3-4 access", "1-on-1 mentorship"],
        "3": ["Module 5-6 access", "Project reviews"],
        "4": ["All remaining modules", "Career coaching", "Certificate"]
    }',
    '{
        "modules": [
            {
                "title": "Linux & Shell Fundamentals",
                "weeks": 2,
                "topics": ["Linux administration", "Bash scripting", "System monitoring"]
            },
            {
                "title": "Version Control & CI/CD",
                "weeks": 3,
                "topics": ["Git workflows", "GitHub Actions", "Jenkins", "GitLab CI"]
            },
            {
                "title": "Containerization",
                "weeks": 3,
                "topics": ["Docker fundamentals", "Docker Compose", "Container security"]
            },
            {
                "title": "Kubernetes",
                "weeks": 4,
                "topics": ["K8s architecture", "Deployments", "Services", "Helm charts"]
            },
            {
                "title": "Cloud Platforms",
                "weeks": 4,
                "topics": ["AWS/GCP/Azure", "IaC with Terraform", "Cloud networking"]
            },
            {
                "title": "Monitoring & SRE",
                "weeks": 2,
                "topics": ["Prometheus", "Grafana", "Logging", "Incident response"]
            },
            {
                "title": "Capstone Project",
                "weeks": 2,
                "topics": ["End-to-end pipeline", "Production deployment", "Documentation"]
            }
        ],
        "total_weeks": 20,
        "projects": 6,
        "labs": 40
    }',
    'prod_devops_bootcamp',
    'price_devops_full_2300',
    'price_devops_installment_625',
    1,
    true
);

-- Cybersecurity Bootcamp
INSERT INTO bootcamps (
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
    sort_order,
    active
) VALUES (
    uuid_generate_v4(),
    'Cybersecurity Bootcamp',
    'cybersecurity',
    'Learn ethical hacking, penetration testing, and security operations. Prepare for industry certifications like Security+ and CEH.',
    '5-6 months',
    '2-3',
    2900.00,
    2700.00,
    3000.00,
    4,
    750.00,
    true,
    '[
        "Live instructor-led sessions",
        "Hands-on security labs",
        "CTF challenges & competitions",
        "1-on-1 mentorship sessions",
        "Career coaching & resume review",
        "Slack community access",
        "Job placement assistance",
        "Certificate of completion"
    ]',
    '[
        "Immediate access to all modules",
        "Bonus: Certification prep materials",
        "Lifetime access to recordings",
        "Priority mentor scheduling",
        "Free certification exam voucher"
    ]',
    '{
        "1": ["Module 1-2 access", "Slack community", "Lab environment"],
        "2": ["Module 3-4 access", "1-on-1 mentorship", "CTF access"],
        "3": ["Module 5-6 access", "Certification prep"],
        "4": ["All remaining modules", "Career coaching", "Certificate"]
    }',
    '{
        "modules": [
            {
                "title": "Security Fundamentals",
                "weeks": 2,
                "topics": ["Security principles", "Network basics", "Threat landscape"]
            },
            {
                "title": "Network Security",
                "weeks": 3,
                "topics": ["Firewalls", "IDS/IPS", "VPNs", "Network monitoring"]
            },
            {
                "title": "Ethical Hacking",
                "weeks": 4,
                "topics": ["Reconnaissance", "Scanning", "Exploitation", "Metasploit"]
            },
            {
                "title": "Web Application Security",
                "weeks": 3,
                "topics": ["OWASP Top 10", "SQL injection", "XSS", "Burp Suite"]
            },
            {
                "title": "Cloud Security",
                "weeks": 3,
                "topics": ["AWS security", "Azure security", "Cloud compliance"]
            },
            {
                "title": "Security Operations",
                "weeks": 3,
                "topics": ["SIEM", "Incident response", "Digital forensics"]
            },
            {
                "title": "Certification Prep & Capstone",
                "weeks": 4,
                "topics": ["Security+ prep", "CEH prep", "Capstone project"]
            }
        ],
        "total_weeks": 22,
        "projects": 8,
        "labs": 50
    }',
    'prod_cybersecurity_bootcamp',
    'price_cybersecurity_full_2700',
    'price_cybersecurity_installment_750',
    2,
    true
);

-- MLOps Bootcamp
INSERT INTO bootcamps (
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
    sort_order,
    active
) VALUES (
    uuid_generate_v4(),
    'MLOps & AI Engineering Bootcamp',
    'mlops',
    'Bridge the gap between data science and production. Learn to deploy, monitor, and scale ML models in production environments.',
    '5-7 months',
    '2-3',
    3400.00,
    3150.00,
    3500.00,
    4,
    875.00,
    true,
    '[
        "Live instructor-led sessions",
        "Real ML pipeline projects",
        "GPU cloud lab access",
        "1-on-1 mentorship sessions",
        "Career coaching & resume review",
        "Slack community access",
        "Job placement assistance",
        "Certificate of completion"
    ]',
    '[
        "Immediate access to all modules",
        "Bonus: Advanced ML course",
        "Lifetime access to recordings",
        "Priority mentor scheduling",
        "Extended GPU lab hours"
    ]',
    '{
        "1": ["Module 1-2 access", "Slack community", "GPU lab access"],
        "2": ["Module 3-4 access", "1-on-1 mentorship"],
        "3": ["Module 5-6 access", "Project reviews"],
        "4": ["All remaining modules", "Career coaching", "Certificate"]
    }',
    '{
        "modules": [
            {
                "title": "Python for ML Engineers",
                "weeks": 2,
                "topics": ["Advanced Python", "Data manipulation", "Testing"]
            },
            {
                "title": "ML Fundamentals",
                "weeks": 3,
                "topics": ["Supervised learning", "Unsupervised learning", "Model evaluation"]
            },
            {
                "title": "Deep Learning",
                "weeks": 4,
                "topics": ["Neural networks", "CNNs", "RNNs", "Transformers", "PyTorch"]
            },
            {
                "title": "ML System Design",
                "weeks": 3,
                "topics": ["Feature stores", "Model serving", "A/B testing"]
            },
            {
                "title": "MLOps Tools & Platforms",
                "weeks": 4,
                "topics": ["MLflow", "Kubeflow", "SageMaker", "Vertex AI"]
            },
            {
                "title": "Production ML",
                "weeks": 4,
                "topics": ["Model monitoring", "Data drift", "Model retraining", "CI/CD for ML"]
            },
            {
                "title": "Capstone Project",
                "weeks": 4,
                "topics": ["End-to-end ML system", "Production deployment", "Documentation"]
            }
        ],
        "total_weeks": 24,
        "projects": 7,
        "labs": 45
    }',
    'prod_mlops_bootcamp',
    'price_mlops_full_3150',
    'price_mlops_installment_875',
    3,
    true
);

-- ============================================================================
-- PART 5: Update views
-- ============================================================================

-- Update active subscription plans view with new ordering
DROP VIEW IF EXISTS active_subscription_plans;
CREATE OR REPLACE VIEW active_subscription_plans AS
SELECT
    id,
    name,
    description,
    price,
    yearly_price,
    interval,
    tier,
    features_json,
    max_courses,
    max_labs,
    max_storage_gb,
    stripe_price_id,
    stripe_price_id_yearly,
    created_at,
    updated_at
FROM subscription_plans
WHERE active = true
ORDER BY
    CASE
        WHEN tier = 'free' THEN 1
        WHEN tier = 'basic' THEN 2
        WHEN tier = 'premium' THEN 3
        WHEN tier = 'enterprise' THEN 4
        ELSE 5
    END;

COMMENT ON VIEW active_subscription_plans IS 'View of active subscription plans ordered by tier';

-- ============================================================================
-- PART 6: Verify the data
-- ============================================================================

-- Uncomment to verify:
-- SELECT name, price, yearly_price, tier FROM subscription_plans WHERE active = true ORDER BY price;
-- SELECT name, slug, price_full_discounted, installment_amount FROM bootcamps WHERE active = true ORDER BY sort_order;
