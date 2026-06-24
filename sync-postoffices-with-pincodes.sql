-- Sync postoffices table with pincodes table
-- This ensures state and district in postoffices match their pincode entry

-- Step 1: Identify all mismatches between postoffices and pincodes
SELECT 
    po.pincode, 
    COUNT(*) as affected_postoffices,
    po.state as postoffice_state, 
    p.state as pincode_state,
    po.district as postoffice_district,
    p.district as pincode_district
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL 
  AND (LOWER(po.state) != LOWER(p.state) OR LOWER(po.district) != LOWER(p.district))
GROUP BY po.pincode, po.state, p.state, po.district, p.district
ORDER BY affected_postoffices DESC;

-- Step 2: Count total mismatched records
SELECT COUNT(*) as total_mismatched_postoffices
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL 
  AND (LOWER(po.state) != LOWER(p.state) OR LOWER(po.district) != LOWER(p.district));

-- Step 3: Update ALL postoffices to match their pincode's state and district
-- This is the master fix that ensures consistency
UPDATE postoffices po
SET state = p.state,
    district = p.district,
    updated_at = CURRENT_TIMESTAMP
FROM pincodes p
WHERE po.pincode = p.pincode
  AND p.state IS NOT NULL
  AND (LOWER(po.state) != LOWER(p.state) OR LOWER(po.district) != LOWER(p.district));

-- Step 4: Verify all mismatches are fixed
SELECT COUNT(*) as remaining_mismatched
FROM postoffices po
LEFT JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL 
  AND (LOWER(po.state) != LOWER(p.state) OR LOWER(po.district) != LOWER(p.district));

-- Step 5: Show summary by state
SELECT 
    p.state,
    COUNT(DISTINCT po.pincode) as pincodes_with_postoffices,
    COUNT(*) as total_postoffices
FROM postoffices po
JOIN pincodes p ON po.pincode = p.pincode
WHERE p.state IS NOT NULL
GROUP BY p.state
ORDER BY p.state;
