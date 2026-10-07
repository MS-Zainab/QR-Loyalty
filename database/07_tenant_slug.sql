-- Phase 7 Migration: Add branded slug to tenants for human-readable QR routing
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS slug text;

-- Slug must be unique across all tenants
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON public.tenants (slug) WHERE slug IS NOT NULL;

-- Only lowercase alphanumeric and hyphens allowed — enforced in application layer
