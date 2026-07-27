-- Migration: Add active liveness detection columns
-- Date: 2026-07-27
-- Purpose: Store liveness check results from Section 3b landmark-based detection

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS liveness_check_passed BOOLEAN,
ADD COLUMN IF NOT EXISTS liveness_challenge_type TEXT CHECK (liveness_challenge_type IN ('blink', 'turn_left', 'turn_right')) ;
