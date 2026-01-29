-- Migration: 009_bootcamp_sessions.sql
-- Description: Add bootcamp sessions (cohorts) support for fixed enrollment periods
-- Date: 2026-01-29

-- ============================================================================
-- CREATE BOOTCAMP_SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bootcamp_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bootcamp_id UUID NOT NULL REFERENCES bootcamps(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,           -- e.g., "DevOps Class 2026 A"
    slug VARCHAR(100) NOT NULL,           -- e.g., "2026-a"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'upcoming'
        CHECK (status IN ('upcoming', 'ongoing', 'ended')),
    enrollment_open BOOLEAN NOT NULL DEFAULT false,
    max_capacity INTEGER,                 -- NULL = unlimited
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(bootcamp_id, slug)
);

-- Create indexes for common queries
CREATE INDEX idx_bootcamp_sessions_bootcamp ON bootcamp_sessions(bootcamp_id);
CREATE INDEX idx_bootcamp_sessions_status ON bootcamp_sessions(status);
CREATE INDEX idx_bootcamp_sessions_enrollment ON bootcamp_sessions(enrollment_open) WHERE enrollment_open = true;
CREATE INDEX idx_bootcamp_sessions_dates ON bootcamp_sessions(start_date, end_date);

-- ============================================================================
-- ALTER BOOTCAMP_ENROLLMENTS TABLE
-- ============================================================================

-- Add session_id column (nullable for backward compatibility with existing enrollments)
ALTER TABLE bootcamp_enrollments
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES bootcamp_sessions(id);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_bootcamp_enrollments_session ON bootcamp_enrollments(session_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE bootcamp_sessions IS 'Bootcamp cohort/session scheduling for fixed enrollment periods (1-3 times per year)';
COMMENT ON COLUMN bootcamp_sessions.name IS 'Display name for the session, e.g., "DevOps Class 2026 A"';
COMMENT ON COLUMN bootcamp_sessions.slug IS 'URL-friendly identifier, unique per bootcamp';
COMMENT ON COLUMN bootcamp_sessions.status IS 'Session status: upcoming (not started), ongoing (in progress), ended (completed)';
COMMENT ON COLUMN bootcamp_sessions.enrollment_open IS 'Whether new enrollments are currently accepted for this session';
COMMENT ON COLUMN bootcamp_sessions.max_capacity IS 'Maximum number of students allowed, NULL for unlimited';
COMMENT ON COLUMN bootcamp_enrollments.session_id IS 'Optional reference to specific bootcamp session (cohort)';
