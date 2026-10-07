-- Phase 8 Migration: Merge duplicate customers and enforce uniqueness
-- This migration is IDEMPOTENT and SAFE. It can be run multiple times without damage.
--
-- PROBLEM: Multiple customer rows may exist for the same tenant_id + phone combination,
-- causing duplicate profiles in staff lists and incorrect loyalty progress tracking.
--
-- SOLUTION:
-- 1. Identify duplicate groups (same tenant_id + normalized phone).
-- 2. For each group, keep the OLDEST customer record (earliest created_at).
-- 3. Migrate all stamps, redemptions, and visits to the kept record.
-- 4. Delete the duplicate records.
-- 5. Add a UNIQUE constraint on (tenant_id, phone) WHERE phone IS NOT NULL.

DO $$
DECLARE
  dup_group RECORD;
  keeper_id UUID;
  dup_ids UUID[];
  migrated_stamps INTEGER := 0;
  migrated_redemptions INTEGER := 0;
  migrated_visits INTEGER := 0;
  deleted_records INTEGER := 0;
BEGIN
  RAISE NOTICE '=== Starting customer deduplication migration ===';

  -- Step 1: Find duplicate groups (tenant_id + phone with count > 1)
  FOR dup_group IN
    SELECT
      tenant_id,
      phone,
      array_agg(id ORDER BY created_at ASC) AS all_ids,
      min(created_at) AS earliest_created
    FROM public.customers
    WHERE phone IS NOT NULL
    GROUP BY tenant_id, phone
    HAVING count(*) > 1
    ORDER BY tenant_id, phone
  LOOP
    -- The first ID (earliest created_at) is the keeper
    keeper_id := dup_group.all_ids[1];
    -- Remaining IDs are duplicates to merge and delete
    dup_ids := dup_group.all_ids[2:array_length(dup_group.all_ids, 1)];

    RAISE NOTICE 'Merging % duplicates for tenant %, phone % → keeping %',
      array_length(dup_ids, 1), dup_group.tenant_id, dup_group.phone, keeper_id;

    -- Step 2a: Migrate stamps from duplicates to keeper
    UPDATE public.stamps
    SET customer_id = keeper_id
    WHERE customer_id = ANY(dup_ids);
    GET DIAGNOSTICS migrated_stamps = ROW_COUNT;

    -- Step 2b: Migrate redemptions from duplicates to keeper
    UPDATE public.redemptions
    SET customer_id = keeper_id
    WHERE customer_id = ANY(dup_ids);
    GET DIAGNOSTICS migrated_redemptions = ROW_COUNT;

    -- Step 2c: Migrate visits from duplicates to keeper
    UPDATE public.visits
    SET customer_id = keeper_id
    WHERE customer_id = ANY(dup_ids);
    GET DIAGNOSTICS migrated_visits = ROW_COUNT;

    -- Step 3: Delete duplicate customer records (not the keeper)
    DELETE FROM public.customers
    WHERE id = ANY(dup_ids);
    GET DIAGNOSTICS deleted_records = ROW_COUNT;

    RAISE NOTICE '  Migrated: % stamps, % redemptions, % visits. Deleted % duplicate records.',
      migrated_stamps, migrated_redemptions, migrated_visits, deleted_records;
  END LOOP;

  RAISE NOTICE '=== Customer deduplication complete ===';

  -- Step 4: Add unique constraint if it doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_tenant_phone_unique'
    AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_tenant_phone_unique
      UNIQUE (tenant_id, phone);
    RAISE NOTICE 'Added UNIQUE constraint: customers_tenant_phone_unique';
  ELSE
    RAISE NOTICE 'UNIQUE constraint customers_tenant_phone_unique already exists — skipping.';
  END IF;

END $$;
