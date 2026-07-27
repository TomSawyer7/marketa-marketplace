-- Migration: Verified-User Tier RLS for listings, conversations, messages
-- Date: 2026-07-26
-- Requires: 20260726000000_real_user_admin_infrastructure.sql (is_admin function, role column)

-- 1. Create a public listing previews view for Tier 1 (anon) and Tier 2 (unverified) access
CREATE OR REPLACE VIEW public.listing_previews AS
SELECT
  id,
  title,
  price,
  image_urls AS image_url,
  category,
  location,
  created_at
FROM public.listings
WHERE status = 'active';

-- Grant anon and authenticated users access to the preview view
GRANT SELECT ON public.listing_previews TO anon, authenticated;

-- 2. Update listings RLS: Replace the broad "Read active listings" policy
-- with one that restricts full detail to verified users / sellers / admins
DROP POLICY IF EXISTS "Read active listings" ON public.listings;

-- Anon and unverified users can only see active listings via the preview view
-- So we restrict direct table access to verified users, sellers, and admins
CREATE POLICY "Verified users and sellers read full listing detail"
  ON public.listings
  FOR SELECT
  USING (
    (status = 'active' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND verification_status = 'verified'
    ))
    OR user_id = auth.uid()
    OR public.is_admin()
  );

-- 3. Update conversations RLS: ensure only verified participants or admins can read
DROP POLICY IF EXISTS "Users access own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admins inspect dispute conversations" ON public.conversations;

CREATE POLICY "Verified participants or admins read conversations"
  ON public.conversations
  FOR SELECT
  USING (
    (
      (buyer_id = auth.uid() OR seller_id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND verification_status = 'verified'
      )
    )
    OR public.is_admin()
  );

-- 4. Update messages RLS: ensure only verified participants or admins can read
DROP POLICY IF EXISTS "Users and admins read conversation messages" ON public.messages;

CREATE POLICY "Verified participants or admins read messages"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (
        (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND verification_status = 'verified'
        )
      )
      OR public.is_admin()
    )
  );
