-- Phase 6 Migration: Add validity period to loyalty_programs and optional loyalty_program_id to stamps
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS start_date timestamptz;
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS end_date timestamptz;
ALTER TABLE public.stamps ADD COLUMN IF NOT EXISTS loyalty_program_id uuid REFERENCES public.loyalty_programs(id) ON DELETE SET NULL;
