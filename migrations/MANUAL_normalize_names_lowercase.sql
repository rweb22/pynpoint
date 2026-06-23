-- =====================================================================
-- MANUAL MIGRATION: Normalize all names to lowercase
-- =====================================================================
-- Run this manually via: railway run psql $DATABASE_URL -f migrations/MANUAL_normalize_names_lowercase.sql
-- 
-- Purpose: Fix duplicate states/districts due to mixed-case names
-- Issue: "Andhra Pradesh" vs "andhra pradesh" appear as separate entries
-- 
-- Expected time: ~10-20 seconds total
-- =====================================================================

\timing on

-- Step 1: Check and drop constraint if exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'postoffices' 
        AND constraint_name = 'uq_postoffices_pincode_officename'
    ) THEN
        ALTER TABLE postoffices DROP CONSTRAINT uq_postoffices_pincode_officename;
        RAISE NOTICE 'Dropped constraint uq_postoffices_pincode_officename';
    ELSE
        RAISE NOTICE 'Constraint uq_postoffices_pincode_officename does not exist';
    END IF;
END $$;

-- Step 2: Normalize pincodes table
\echo 'Normalizing pincodes table...'
UPDATE pincodes SET state = LOWER(state);
UPDATE pincodes SET district = LOWER(district);
UPDATE pincodes SET city = LOWER(city);
UPDATE pincodes SET office_name = LOWER(office_name);
\echo 'Pincodes normalized'

-- Step 3: Normalize postoffices table
\echo 'Normalizing postoffices table...'
UPDATE postoffices SET officename = LOWER(officename);
UPDATE postoffices SET area = LOWER(area);
UPDATE postoffices SET district = LOWER(district);
UPDATE postoffices SET state = LOWER(state);
UPDATE postoffices SET division = LOWER(division);
UPDATE postoffices SET region = LOWER(region);
UPDATE postoffices SET circle = LOWER(circle);
\echo 'Postoffices normalized'

-- Step 4: Deduplicate postoffices
\echo 'Deduplicating postoffices...'
DELETE FROM postoffices
WHERE id NOT IN (
    SELECT MIN(id)
    FROM postoffices
    GROUP BY pincode, officename
);
\echo 'Duplicates removed'

-- Step 5: Re-add unique constraint
\echo 'Re-adding unique constraint...'
ALTER TABLE postoffices 
ADD CONSTRAINT uq_postoffices_pincode_officename 
UNIQUE (pincode, officename);
\echo 'Constraint re-added'

-- Step 6: Verify results
\echo 'Verification:'
SELECT COUNT(DISTINCT state) as unique_states FROM pincodes WHERE state IS NOT NULL;
SELECT COUNT(DISTINCT district) as unique_districts FROM pincodes WHERE district IS NOT NULL;
SELECT COUNT(*) as total_postoffices FROM postoffices;

\echo 'Migration complete!'
