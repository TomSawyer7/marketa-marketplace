-- Migration: Add QR extraction and eVerify columns
-- Date: 2026-07-27
-- Purpose: Store decoded QR payload from ID back, eVerify admin result

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS qr_payload TEXT,
ADD COLUMN IF NOT EXISTS qr_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qr_image_data_url TEXT,
ADD COLUMN IF NOT EXISTS everify_status TEXT CHECK (everify_status IN ('none', 'passed', 'failed')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS everify_notes TEXT;
