-- Migration: Sync DB schema to match app TypeScript types
-- Date: 2026-07-26
-- Purpose: Add missing columns, rename columns where the app expects different names,
-- and add NOT NULL constraints where the app assumes required fields.

-- ============================================================
-- 1. PROFILES: Add missing columns used by the app
-- ============================================================

-- email (from auth.users metadata, stored here for easy querying)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email TEXT;

UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- role (already added by migration 00000, but ensure it exists)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user' NOT NULL;

-- National ID verification columns
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS id_number TEXT,
ADD COLUMN IF NOT EXISTS id_type TEXT,
ADD COLUMN IF NOT EXISTS id_front_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS id_back_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS selfie_captured_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS selfie_url TEXT,
ADD COLUMN IF NOT EXISTS face_match_status TEXT CHECK (face_match_status IN ('not_run', 'passed', 'needs_review', 'failed')) DEFAULT 'not_run',
ADD COLUMN IF NOT EXISTS ocr_fields JSONB,
ADD COLUMN IF NOT EXISTS ocr_raw_text TEXT,
ADD COLUMN IF NOT EXISTS ocr_confidence JSONB,
ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ;

-- Add NOT NULL defaults for existing profiles
UPDATE public.profiles SET face_match_status = 'not_run' WHERE face_match_status IS NULL;
UPDATE public.profiles SET otp_verified = FALSE WHERE otp_verified IS NULL;

-- ============================================================
-- 2. LISTINGS: Add/sync columns the app expects
-- ============================================================

-- The DB has user_id (FK to profiles); the app uses seller_id.
-- Add seller_id as an alias column, initially backfilled from user_id.
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES public.profiles(id);

UPDATE public.listings SET seller_id = user_id WHERE seller_id IS NULL AND user_id IS NOT NULL;

-- Make seller_id NOT NULL where user_id is set
ALTER TABLE public.listings
ALTER COLUMN seller_id SET NOT NULL;

-- The DB has image_urls (TEXT); the app uses image_url (singular).
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE public.listings SET image_url = image_urls WHERE image_url IS NULL;

-- Mark required columns NOT NULL where the app expects them
ALTER TABLE public.listings
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN price SET NOT NULL,
ALTER COLUMN seller_id SET NOT NULL;

-- ============================================================
-- 3. CONVERSATIONS: Add columns the app expects
-- ============================================================

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS buyer_chat_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS seller_chat_consent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dispute_status TEXT CHECK (dispute_status IN ('none', 'pending_dual_consent', 'under_review', 'resolved')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.conversations SET
  buyer_chat_consent = FALSE,
  seller_chat_consent = FALSE,
  dispute_status = 'none',
  updated_at = created_at
WHERE dispute_status IS NULL;

ALTER TABLE public.conversations
ALTER COLUMN buyer_chat_consent SET NOT NULL,
ALTER COLUMN seller_chat_consent SET NOT NULL,
ALTER COLUMN dispute_status SET NOT NULL;

-- ============================================================
-- 4. MESSAGES: Add/sync columns the app expects
-- ============================================================

-- The DB has content (TEXT); the app expects text.
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS text TEXT;

UPDATE public.messages SET text = content WHERE text IS NULL AND content IS NOT NULL;

ALTER TABLE public.messages
ALTER COLUMN text SET NOT NULL;

-- Add missing columns
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.messages(id),
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

UPDATE public.messages SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- ============================================================
-- 5. REVIEW APPEALS: App uses conversation_id; DB references buyer_id/seller_id
-- No changes needed here — the app's ReviewAppeal TS type is already different.
-- The app will query review_appeals using buyer_id/seller_id directly.
-- ============================================================

-- ============================================================
-- 6. Update the listing_previews view to use image_url
-- ============================================================
CREATE OR REPLACE VIEW public.listing_previews AS
SELECT
  id,
  title,
  price,
  image_url,
  category,
  location,
  created_at
FROM public.listings
WHERE status = 'active';

GRANT SELECT ON public.listing_previews TO anon, authenticated;
