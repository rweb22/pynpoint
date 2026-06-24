-- Cleanup: Delete pincodes and postoffices with 'unknown' state
-- Run this on the production database

-- Step 1: Check what will be deleted from pincodes
SELECT pincode, office_name, state, district
FROM pincodes
WHERE LOWER(state) = 'unknown';

-- Step 2: Check what will be deleted from postoffices
SELECT pincode, officename, state, district
FROM postoffices
WHERE LOWER(state) = 'unknown';

-- Step 3: Delete postoffices first (to avoid foreign key issues)
DELETE FROM postoffices WHERE LOWER(state) = 'unknown';

-- Step 4: Delete pincodes
DELETE FROM pincodes WHERE LOWER(state) = 'unknown';

-- Step 5: Verify deletion
SELECT COUNT(*) as remaining_unknown_pincodes
FROM pincodes
WHERE LOWER(state) = 'unknown';

SELECT COUNT(*) as remaining_unknown_postoffices
FROM postoffices
WHERE LOWER(state) = 'unknown';

-- Step 6: Check final state count
SELECT COUNT(DISTINCT state) as total_states
FROM pincodes
WHERE is_active = true;
