-- Migration: Normalize all names to lowercase
-- Purpose: Fix data consistency issues with mixed-case state/district/city names
-- Issue: States like "Andhra Pradesh" and "andhra pradesh" appear as duplicates
-- Impact: Administrative endpoints show duplicate entries

-- =====================================================================
-- STEP 1: Normalize pincodes table
-- =====================================================================

-- Check before update (optional)
SELECT 
    'States with mixed case' as issue,
    COUNT(DISTINCT state) as total,
    COUNT(DISTINCT LOWER(state)) as normalized
FROM pincodes 
WHERE state IS NOT NULL;

SELECT 
    'Districts with mixed case' as issue,
    COUNT(DISTINCT district) as total,
    COUNT(DISTINCT LOWER(district)) as normalized
FROM pincodes 
WHERE district IS NOT NULL;

-- Normalize state names to lowercase
UPDATE pincodes 
SET state = LOWER(state) 
WHERE state IS NOT NULL 
  AND state != LOWER(state);

-- Normalize district names to lowercase
UPDATE pincodes 
SET district = LOWER(district) 
WHERE district IS NOT NULL 
  AND district != LOWER(district);

-- Normalize city names to lowercase
UPDATE pincodes 
SET city = LOWER(city) 
WHERE city IS NOT NULL 
  AND city != LOWER(city);

-- Normalize office_name to lowercase
UPDATE pincodes 
SET office_name = LOWER(office_name) 
WHERE office_name IS NOT NULL 
  AND office_name != LOWER(office_name);

-- =====================================================================
-- STEP 2: Normalize postoffices table
-- =====================================================================

-- Normalize officename to lowercase
UPDATE postoffices 
SET officename = LOWER(officename) 
WHERE officename IS NOT NULL 
  AND officename != LOWER(officename);

-- Normalize area to lowercase
UPDATE postoffices 
SET area = LOWER(area) 
WHERE area IS NOT NULL 
  AND area != LOWER(area);

-- Normalize district to lowercase
UPDATE postoffices 
SET district = LOWER(district) 
WHERE district IS NOT NULL 
  AND district != LOWER(district);

-- Normalize state to lowercase
UPDATE postoffices 
SET state = LOWER(state) 
WHERE state IS NOT NULL 
  AND state != LOWER(state);

-- Normalize division to lowercase
UPDATE postoffices 
SET division = LOWER(division) 
WHERE division IS NOT NULL 
  AND division != LOWER(division);

-- Normalize region to lowercase
UPDATE postoffices 
SET region = LOWER(region) 
WHERE region IS NOT NULL 
  AND region != LOWER(region);

-- Normalize circle to lowercase
UPDATE postoffices 
SET circle = LOWER(circle) 
WHERE circle IS NOT NULL 
  AND circle != LOWER(circle);

-- =====================================================================
-- STEP 3: Verification
-- =====================================================================

-- Verify pincodes table
SELECT 
    'pincodes - states' as table_field,
    COUNT(DISTINCT state) as unique_count
FROM pincodes 
WHERE state IS NOT NULL;

SELECT 
    'pincodes - districts' as table_field,
    COUNT(DISTINCT district) as unique_count
FROM pincodes 
WHERE district IS NOT NULL;

SELECT 
    'pincodes - cities' as table_field,
    COUNT(DISTINCT city) as unique_count
FROM pincodes 
WHERE city IS NOT NULL;

-- Verify postoffices table
SELECT 
    'postoffices - states' as table_field,
    COUNT(DISTINCT state) as unique_count
FROM postoffices 
WHERE state IS NOT NULL;

SELECT 
    'postoffices - districts' as table_field,
    COUNT(DISTINCT district) as unique_count
FROM postoffices 
WHERE district IS NOT NULL;

-- Show sample of normalized data
SELECT state, COUNT(*) as pincode_count
FROM pincodes
WHERE state IS NOT NULL
GROUP BY state
ORDER BY pincode_count DESC
LIMIT 10;

-- =====================================================================
-- Expected Results:
-- =====================================================================
-- Before: 46 states in /administrative/states (with duplicates)
-- After: 37 unique states (India has 28 states + 8 UTs + 1 unknown)
--
-- This will fix the duplicate state issue where we had:
-- - "andhra pradesh" (1249 pincodes) + "Andhra Pradesh" (1 pincode)
-- - "assam" (578) + "Assam" (1)
-- - "gujarat" (1014) + "Gujarat" (1)
-- - etc.
--
-- Performance: ~1-2 seconds on 19,287 pincodes + 165,627 post offices
-- =====================================================================
