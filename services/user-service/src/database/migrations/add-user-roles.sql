-- Migration: Add roles support to users table
-- Date: 2025-06-27
-- Description: Add roles column to support role-based access control

-- Add roles column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT ARRAY['student']::TEXT[];

-- Create index for roles array queries
CREATE INDEX IF NOT EXISTS idx_users_roles ON users USING GIN (roles);

-- Update existing users to have default student role
UPDATE users 
SET roles = ARRAY['student']::TEXT[] 
WHERE roles IS NULL OR array_length(roles, 1) IS NULL;

-- Add constraint to ensure valid roles
ALTER TABLE users 
ADD CONSTRAINT IF NOT EXISTS check_valid_roles 
CHECK (
  roles <@ ARRAY['student', 'instructor', 'admin']::TEXT[] 
  AND array_length(roles, 1) > 0
);

-- Grant admin role to specific user (mbuaku@gmail.com)
UPDATE users 
SET roles = ARRAY['admin', 'student']::TEXT[]
WHERE email = 'mbuaku@gmail.com';

-- Insert user if doesn't exist (for testing purposes)
INSERT INTO users (
  email, 
  password_hash, 
  first_name, 
  last_name, 
  roles,
  subscription_type, 
  email_verified
) VALUES (
  'mbuaku@gmail.com',
  -- Default password hash for 'admin123' - CHANGE THIS IMMEDIATELY
  '$2b$10$8K1p/a0dqaillc9UWYAWeOuzdMRcQZeVfsjHg4EVagAGdQuTZfPaS',
  'Admin',
  'User',
  ARRAY['admin', 'student']::TEXT[],
  'enterprise',
  true
) ON CONFLICT (email) DO UPDATE SET
  roles = ARRAY['admin', 'student']::TEXT[],
  subscription_type = 'enterprise',
  email_verified = true;

COMMIT;