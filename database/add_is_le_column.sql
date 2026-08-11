-- ═══════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to add the is_le column to existing tables
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS is_le BOOLEAN DEFAULT FALSE;

ALTER TABLE public.signup_requests 
ADD COLUMN IF NOT EXISTS is_le BOOLEAN DEFAULT FALSE;
