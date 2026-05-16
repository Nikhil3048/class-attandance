-- ═══════════════════════════════════════════════════════════════════════════
-- AttendanceIQ — Supabase Database Schema
-- Run this in the Supabase SQL Editor (supabase.com → your project → SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. USERS TABLE ──────────────────────────────────────────────────────────
-- Stores role info linked to Supabase Auth users
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. CLASSES TABLE ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name  TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. SUBJECTS TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subjects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_name    TEXT NOT NULL,
    class_id        UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(subject_name, class_id)
);

-- ─── 4. STUDENTS TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.students (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                TEXT NOT NULL,
    registration_number TEXT NOT NULL UNIQUE,
    class_id            UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. ATTENDANCE TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.attendance (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id  UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id  UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('present', 'absent')),
    marked_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent duplicate attendance for same student+subject+date
    UNIQUE(student_id, subject_id, date)
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_student   ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_subject   ON public.attendance(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date      ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_students_class       ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_class       ON public.subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_subjects_teacher     ON public.subjects(teacher_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- For this MVP, we use the service role key on the server side, 
-- so RLS is not strictly needed. But enable it for good practice.
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance  ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (our backend uses service role key)
-- Public read for authenticated users (our backend validates roles)
CREATE POLICY "Service role full access users"      ON public.users       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access classes"    ON public.classes     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access subjects"   ON public.subjects    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access students"   ON public.students    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access attendance" ON public.attendance  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- SAMPLE DATA (run separately after creating tables)
-- ═══════════════════════════════════════════════════════════════════════════

-- NOTE: First create auth users via the app or Supabase Auth dashboard,
-- then get their UUIDs and insert into users table.
-- OR use the admin panel in the app itself after setting up the first admin.

-- Example classes:
INSERT INTO public.classes (class_name) VALUES
    ('CS-A 2024'),
    ('CS-B 2024'),
    ('IT-A 2024')
ON CONFLICT DO NOTHING;

-- After inserting users, you can run:
-- INSERT INTO public.subjects (subject_name, class_id, teacher_id) VALUES
--     ('Data Structures', '<class_id>', '<teacher_id>'),
--     ('Computer Networks', '<class_id>', '<teacher_id>');
