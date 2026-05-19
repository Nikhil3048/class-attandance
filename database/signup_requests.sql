-- ═══════════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to add the signup requests table
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.signup_requests (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          TEXT NOT NULL,
    email         TEXT NOT NULL,
    temp_password TEXT NOT NULL,           -- stored temporarily, cleared after approval
    role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
    subject_name  TEXT,                    -- only required for teachers
    registration_number TEXT,              -- only required for students
    class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at   TIMESTAMPTZ,
    reject_reason TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signup_requests_status   ON public.signup_requests(status);
CREATE INDEX IF NOT EXISTS idx_signup_requests_class_id ON public.signup_requests(class_id);

ALTER TABLE public.signup_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access signup_requests"
  ON public.signup_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
