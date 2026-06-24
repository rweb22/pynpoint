-- Fix Andaman & Nicobar postoffices that have wrong state
-- Some postoffices have "dadra & nagar haveli and daman & diu" as state 
-- but their pincode belongs to Andaman & Nicobar

-- Step 1: Identify the issue - find postoffices with mismatched states
SELECT 
    po.pincode, 
    po.officename, 
    po.state as postoffice_state, 
    p.state as pincode_state,
    po.district as postoffice_district,
    p.district as pincode_district
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL 
  AND LOWER(po.state) != LOWER(p.state)
  AND (LOWER(p.state) LIKE '%andaman%' OR LOWER(po.state) LIKE '%andaman%')
ORDER BY po.pincode;

-- Step 2: Count how many need fixing
SELECT COUNT(*) as mismatched_andaman_postoffices
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL 
  AND LOWER(po.state) != LOWER(p.state)
  AND LOWER(p.state) LIKE '%andaman%';

-- Step 3: Update postoffices.state to match pincodes.state for Andaman & Nicobar
UPDATE postoffices po
SET state = p.state,
    district = p.district,
    updated_at = CURRENT_TIMESTAMP
FROM pincodes p
WHERE po.pincode = p.pincode
  AND p.state IS NOT NULL
  AND LOWER(po.state) != LOWER(p.state)
  AND LOWER(p.state) LIKE '%andaman%';

-- Step 4: Verify the fix
SELECT COUNT(*) as remaining_mismatched
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL 
  AND LOWER(po.state) != LOWER(p.state)
  AND LOWER(p.state) LIKE '%andaman%';

-- Step 5: Show updated records
SELECT 
    po.pincode, 
    po.officename, 
    po.state as postoffice_state, 
    p.state as pincode_state,
    po.district
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE LOWER(p.state) LIKE '%andaman%'
ORDER BY po.pincode
LIMIT 10;
