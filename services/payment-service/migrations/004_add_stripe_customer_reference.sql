-- CloudMastersHub Payment Service Database Schema
-- Migration 004: Add reference column for Stripe customer ID
-- Run Date: 2024-12-25

-- Note: This migration documents the expected schema for the users table
-- The actual column should be added to the user-service database

-- In the user-service database, you would run:
-- ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) UNIQUE;

-- For local development and testing, create a temporary reference table
-- This allows the payment service to work independently
CREATE TABLE IF NOT EXISTS user_stripe_mapping (
    user_id UUID PRIMARY KEY,
    stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_stripe_mapping_updated_at 
BEFORE UPDATE ON user_stripe_mapping 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_stripe_mapping_stripe_id 
ON user_stripe_mapping(stripe_customer_id);

-- Comment for documentation
COMMENT ON TABLE user_stripe_mapping IS 'Temporary mapping table for Stripe customer IDs. In production, this should be a column in the users table of user-service.';