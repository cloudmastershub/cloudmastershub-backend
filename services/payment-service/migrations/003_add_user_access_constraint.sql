-- CloudMastersHub Payment Service Database Schema
-- Migration 003: Add unique constraint to user_access table
-- Run Date: 2024-12-25

-- Add unique constraint to prevent duplicate access entries
-- Uses COALESCE to handle NULL resource_id values
ALTER TABLE user_access 
ADD CONSTRAINT unique_user_access 
UNIQUE (user_id, access_type, access_id, resource_type, COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'));

-- Add index for performance when checking user access
CREATE INDEX IF NOT EXISTS idx_user_access_lookup 
ON user_access(user_id, resource_type, resource_id) 
WHERE revoked_at IS NULL;

-- Add index for finding active accesses by type
CREATE INDEX IF NOT EXISTS idx_user_access_active 
ON user_access(user_id, access_type) 
WHERE revoked_at IS NULL;