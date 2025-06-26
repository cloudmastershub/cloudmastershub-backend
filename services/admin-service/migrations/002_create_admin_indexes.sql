-- Migration: 002_create_admin_indexes.sql
-- Description: Additional indexes for admin service performance optimization
-- Created: 2024-12-26

-- Additional composite indexes for admin_actions
CREATE INDEX idx_admin_actions_admin_action ON admin_actions (admin_id, action);
CREATE INDEX idx_admin_actions_resource_created ON admin_actions (resource_type, resource_id, created_at DESC);
CREATE INDEX idx_admin_actions_date_range ON admin_actions (created_at DESC, admin_id);

-- Additional composite indexes for content_moderation_queue
CREATE INDEX idx_content_moderation_status_priority ON content_moderation_queue (status, priority, flagged_at DESC);
CREATE INDEX idx_content_moderation_author_status ON content_moderation_queue (author_id, status);
CREATE INDEX idx_content_moderation_reviewer ON content_moderation_queue (reviewed_by, reviewed_at DESC) WHERE reviewed_by IS NOT NULL;
CREATE INDEX idx_content_moderation_pending ON content_moderation_queue (flagged_at DESC) WHERE status = 'pending';

-- Additional indexes for platform_settings
CREATE INDEX idx_platform_settings_category_public ON platform_settings (category, is_public);
CREATE INDEX idx_platform_settings_updater ON platform_settings (updated_by, updated_at DESC) WHERE updated_by IS NOT NULL;

-- Additional indexes for feature_flags
CREATE INDEX idx_feature_flags_enabled_audience ON feature_flags (enabled, target_audience);
CREATE INDEX idx_feature_flags_rollout ON feature_flags (rollout_percentage, enabled) WHERE rollout_percentage > 0;
CREATE INDEX idx_feature_flags_updater ON feature_flags (updated_by, updated_at DESC) WHERE updated_by IS NOT NULL;

-- Additional indexes for user_management_actions
CREATE INDEX idx_user_mgmt_target_action ON user_management_actions (target_user_id, action);
CREATE INDEX idx_user_mgmt_admin_date ON user_management_actions (admin_id, created_at DESC);
CREATE INDEX idx_user_mgmt_active_restrictions ON user_management_actions (target_user_id, effective_until) 
    WHERE effective_until IS NOT NULL AND effective_until > CURRENT_TIMESTAMP;

-- Partial indexes for common queries
CREATE INDEX idx_content_moderation_high_priority ON content_moderation_queue (flagged_at DESC) 
    WHERE status = 'pending' AND priority IN ('high', 'urgent');

CREATE INDEX idx_admin_actions_recent ON admin_actions (created_at DESC, action) 
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- Full-text search indexes for content moderation
CREATE INDEX idx_content_moderation_title_search ON content_moderation_queue 
    USING gin(to_tsvector('english', content_title)) WHERE content_title IS NOT NULL;

CREATE INDEX idx_content_moderation_description_search ON content_moderation_queue 
    USING gin(to_tsvector('english', content_description)) WHERE content_description IS NOT NULL;

-- Add comments explaining the indexes
COMMENT ON INDEX idx_admin_actions_admin_action IS 'Optimizes queries filtering by admin and action type';
COMMENT ON INDEX idx_content_moderation_status_priority IS 'Optimizes moderation queue sorting by status and priority';
COMMENT ON INDEX idx_content_moderation_pending IS 'Optimizes queries for pending moderation items';
COMMENT ON INDEX idx_feature_flags_enabled_audience IS 'Optimizes feature flag lookups by status and audience';
COMMENT ON INDEX idx_user_mgmt_active_restrictions IS 'Optimizes queries for active user restrictions';