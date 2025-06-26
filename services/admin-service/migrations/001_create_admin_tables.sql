-- Migration: 001_create_admin_tables.sql
-- Description: Create admin-related tables for CloudMastersHub admin service
-- Created: 2024-12-26

-- Admin actions audit log table
CREATE TABLE admin_actions (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_admin_actions_admin_id (admin_id),
    INDEX idx_admin_actions_action (action),
    INDEX idx_admin_actions_resource (resource_type, resource_id),
    INDEX idx_admin_actions_created_at (created_at)
);

-- Content moderation queue table
CREATE TABLE content_moderation_queue (
    id SERIAL PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL, -- 'course', 'lesson', 'comment', etc.
    content_id VARCHAR(255) NOT NULL,
    content_title VARCHAR(500),
    content_description TEXT,
    author_id VARCHAR(255) NOT NULL,
    author_email VARCHAR(255),
    flag_reason VARCHAR(100) NOT NULL,
    flag_details TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'in_review'
    flagged_by VARCHAR(255),
    flagged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_content_moderation_status (status),
    INDEX idx_content_moderation_priority (priority),
    INDEX idx_content_moderation_content (content_type, content_id),
    INDEX idx_content_moderation_author (author_id),
    INDEX idx_content_moderation_flagged_at (flagged_at)
);

-- Platform settings table
CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL, -- 'general', 'security', 'payment', 'content', 'email'
    setting_key VARCHAR(100) NOT NULL,
    setting_value JSONB NOT NULL,
    data_type VARCHAR(20) NOT NULL, -- 'string', 'number', 'boolean', 'object', 'array'
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- whether setting can be accessed by non-admin users
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255),
    
    -- Ensure unique category + key combination
    UNIQUE CONSTRAINT unique_category_key (category, setting_key),
    
    -- Indexes for performance
    INDEX idx_platform_settings_category (category),
    INDEX idx_platform_settings_public (is_public),
    INDEX idx_platform_settings_updated_at (updated_at)
);

-- Feature flags table
CREATE TABLE feature_flags (
    id SERIAL PRIMARY KEY,
    flag_name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT FALSE,
    description TEXT,
    target_audience VARCHAR(50) DEFAULT 'all', -- 'all', 'beta_users', 'premium_users', 'admins'
    rollout_percentage INTEGER DEFAULT 0, -- 0-100, for gradual rollouts
    conditions JSONB, -- additional conditions for flag activation
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    -- Constraints
    CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
    
    -- Indexes for performance
    INDEX idx_feature_flags_enabled (enabled),
    INDEX idx_feature_flags_target_audience (target_audience),
    INDEX idx_feature_flags_updated_at (updated_at)
);

-- User management actions table (for tracking user account changes)
CREATE TABLE user_management_actions (
    id SERIAL PRIMARY KEY,
    target_user_id VARCHAR(255) NOT NULL,
    target_user_email VARCHAR(255),
    admin_id VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'ban', 'unban', 'suspend', 'promote', 'demote', 'reset_password'
    reason TEXT,
    duration_hours INTEGER, -- for temporary actions like suspensions
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    effective_until TIMESTAMP WITH TIME ZONE, -- for temporary actions
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes for performance
    INDEX idx_user_mgmt_target_user (target_user_id),
    INDEX idx_user_mgmt_admin (admin_id),
    INDEX idx_user_mgmt_action (action),
    INDEX idx_user_mgmt_created_at (created_at),
    INDEX idx_user_mgmt_effective_until (effective_until)
);

-- Insert default platform settings
INSERT INTO platform_settings (category, setting_key, setting_value, data_type, description, is_public) VALUES
-- General settings
('general', 'site_name', '"CloudMastersHub"', 'string', 'Name of the platform', true),
('general', 'site_description', '"Premier cloud learning platform for AWS, Azure, and GCP"', 'string', 'Platform description', true),
('general', 'support_email', '"support@cloudmastershub.com"', 'string', 'Support contact email', true),
('general', 'maintenance_mode', 'false', 'boolean', 'Whether the site is in maintenance mode', false),
('general', 'maintenance_message', '""', 'string', 'Message to display during maintenance', false),
('general', 'default_language', '"en"', 'string', 'Default platform language', true),
('general', 'timezone', '"UTC"', 'string', 'Default platform timezone', true),

-- Security settings
('security', 'password_min_length', '8', 'number', 'Minimum password length', false),
('security', 'password_require_special_chars', 'true', 'boolean', 'Require special characters in passwords', false),
('security', 'session_timeout', '480', 'number', 'Session timeout in minutes', false),
('security', 'max_login_attempts', '5', 'number', 'Maximum failed login attempts', false),
('security', 'lockout_duration', '30', 'number', 'Account lockout duration in minutes', false),
('security', 'two_factor_required', 'false', 'boolean', 'Whether 2FA is required', false),

-- Payment settings
('payment', 'currency', '"USD"', 'string', 'Default currency', true),
('payment', 'tax_rate', '0.08', 'number', 'Default tax rate', false),
('payment', 'refund_window', '30', 'number', 'Refund window in days', true),
('payment', 'stripe_enabled', 'true', 'boolean', 'Whether Stripe payments are enabled', false),
('payment', 'paypal_enabled', 'false', 'boolean', 'Whether PayPal payments are enabled', false),
('payment', 'trial_period', '14', 'number', 'Trial period in days', true),

-- Content settings
('content', 'auto_approve_content', 'false', 'boolean', 'Auto-approve new content', false),
('content', 'max_course_size', '5000', 'number', 'Maximum course size in MB', false),
('content', 'allowed_video_formats', '["mp4", "mov", "avi"]', 'array', 'Allowed video formats', false),
('content', 'max_video_duration', '180', 'number', 'Maximum video duration in minutes', false),
('content', 'require_course_preview', 'true', 'boolean', 'Require course preview', false),
('content', 'content_moderation_enabled', 'true', 'boolean', 'Enable content moderation', false),

-- Email settings
('email', 'from_name', '"CloudMastersHub"', 'string', 'Email sender name', false),
('email', 'from_email', '"noreply@cloudmastershub.com"', 'string', 'Email sender address', false),
('email', 'smtp_host', '"smtp.sendgrid.net"', 'string', 'SMTP server host', false),
('email', 'smtp_port', '587', 'number', 'SMTP server port', false),
('email', 'smtp_secure', 'true', 'boolean', 'Use secure SMTP connection', false),
('email', 'welcome_email_enabled', 'true', 'boolean', 'Send welcome emails', false),
('email', 'course_update_notifications', 'true', 'boolean', 'Send course update notifications', false),
('email', 'payment_notifications', 'true', 'boolean', 'Send payment notifications', false);

-- Insert default feature flags
INSERT INTO feature_flags (flag_name, enabled, description, target_audience, rollout_percentage, created_by, updated_by) VALUES
('lab_environments', true, 'Interactive cloud lab environments', 'all', 100, 'system', 'system'),
('learning_paths', true, 'Curated learning pathways', 'all', 100, 'system', 'system'),
('ai_recommendations', false, 'AI-powered course recommendations', 'beta_users', 0, 'system', 'system'),
('social_learning', true, 'Community features and discussions', 'all', 100, 'system', 'system'),
('beta_features', false, 'Access to beta features for testing', 'beta_users', 0, 'system', 'system');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at timestamps
CREATE TRIGGER update_content_moderation_queue_updated_at 
    BEFORE UPDATE ON content_moderation_queue 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at 
    BEFORE UPDATE ON platform_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at 
    BEFORE UPDATE ON feature_flags 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments to tables
COMMENT ON TABLE admin_actions IS 'Audit log for all admin actions performed on the platform';
COMMENT ON TABLE content_moderation_queue IS 'Queue for content that needs moderation review';
COMMENT ON TABLE platform_settings IS 'Configurable platform settings organized by category';
COMMENT ON TABLE feature_flags IS 'Feature flags for enabling/disabling platform features';
COMMENT ON TABLE user_management_actions IS 'Log of user account management actions performed by admins';

-- Add comments to important columns
COMMENT ON COLUMN admin_actions.details IS 'JSON object containing additional details about the action';
COMMENT ON COLUMN content_moderation_queue.priority IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN platform_settings.setting_value IS 'JSON value of the setting (allows complex data types)';
COMMENT ON COLUMN feature_flags.conditions IS 'JSON object with additional conditions for flag activation';
COMMENT ON COLUMN feature_flags.rollout_percentage IS 'Percentage of users to enable feature for (0-100)';