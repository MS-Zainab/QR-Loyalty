-- Phase 7b Migration: Backfill missing tenant slugs
-- This script is idempotent: running it multiple times is safe.
-- It only generates slugs for tenants that currently have NULL or empty slug.

DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix INTEGER;
BEGIN
  FOR rec IN
    SELECT id, business_name
    FROM public.tenants
    WHERE slug IS NULL OR slug = ''
    ORDER BY created_at ASC
  LOOP
    -- Generate base slug from business name
    base_slug := lower(trim(rec.business_name));
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-|-$', '', 'g');
    base_slug := substring(base_slug from 1 for 60);

    -- Fallback if too short
    IF length(base_slug) < 2 THEN
      base_slug := 'tenant-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || rec.id::text;
    END IF;

    -- Find unique candidate
    candidate := base_slug;
    suffix := 1;

    WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = candidate AND id != rec.id) LOOP
      suffix := suffix + 1;
      candidate := base_slug || '-' || suffix::text;
      IF length(candidate) > 60 THEN
        candidate := substring(candidate from 1 for 60);
        candidate := regexp_replace(candidate, '-$', '');
      END IF;
    END LOOP;

    UPDATE public.tenants
    SET slug = candidate, updated_at = now()
    WHERE id = rec.id;

    RAISE NOTICE 'Assigned slug "%" to tenant "%"', candidate, rec.business_name;
  END LOOP;
END $$;
