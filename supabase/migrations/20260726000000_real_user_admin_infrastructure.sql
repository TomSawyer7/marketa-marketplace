-- Migration: Real-User + Admin Infrastructure & Row Level Security (RLS) Policies
-- Date: 2026-07-26

-- 1. Ensure 'role' column exists on public.profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('user', 'admin')) DEFAULT 'user' NOT NULL;

-- 2. Helper function to check if requesting user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable RLS on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES: PROFILES TABLE
-- Allow public reading of basic profiles (for seller/buyer details)
CREATE POLICY "Public profiles reading"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Users can update their own profile data (e.g. self ID verification submission)
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can read and update any profile (for ID verification queue audits & approvals)
CREATE POLICY "Admins full management on profiles"
  ON public.profiles
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 5. RLS POLICIES: LISTINGS TABLE
-- Anyone authenticated can view active listings
CREATE POLICY "Read active listings"
  ON public.listings
  FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR public.is_admin());

-- Sellers can manage their own listings
CREATE POLICY "Sellers can manage own listings"
  ON public.listings
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admins can manage all listings
CREATE POLICY "Admins full management on listings"
  ON public.listings
  FOR ALL
  USING (public.is_admin());

-- 6. RLS POLICIES: CONVERSATIONS TABLE
-- Users can read conversations where they are buyer or seller
CREATE POLICY "Users access own conversations"
  ON public.conversations
  FOR SELECT
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.is_admin());

-- Users can create/update conversations they belong to
CREATE POLICY "Users manage own conversations"
  ON public.conversations
  FOR ALL
  USING (buyer_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Admins can inspect all dual-consent dispute conversations
CREATE POLICY "Admins inspect dispute conversations"
  ON public.conversations
  FOR SELECT
  USING (public.is_admin());

-- 7. RLS POLICIES: MESSAGES TABLE
-- Users can read messages in their own conversations; Admins can read for compliance audits
CREATE POLICY "Users and admins read conversation messages"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid() OR public.is_admin())
    )
  );

-- Users can insert messages into their active conversations
CREATE POLICY "Users send messages to own conversations"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
      AND (c.buyer_id = auth.uid() OR c.seller_id = auth.uid())
    )
  );
