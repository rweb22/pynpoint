-- Task 1: Fix Andaman & Nicobar postoffices that are incorrectly marked as "dadra & nagar haveli and daman & diu"
-- Task 2: Merge "dadra & nagar haveli" and "daman & diu" back into combined UT

-- ============================================================================
-- TASK 1: Fix Andaman & Nicobar State Mismatches
-- ============================================================================

-- Step 1.1: Check Andaman & Nicobar pincodes with wrong state in postoffices
SELECT 
    po.pincode,
    COUNT(*) as affected_postoffices,
    po.state as postoffice_state,
    p.state as correct_pincode_state
FROM postoffices po
JOIN pincodes p ON po.pincode = p.pincode
WHERE LOWER(p.state) LIKE '%andaman%'
  AND LOWER(po.state) != LOWER(p.state)
GROUP BY po.pincode, po.state, p.state
ORDER BY affected_postoffices DESC;

-- Step 1.2: Update postoffices to correct Andaman & Nicobar state
UPDATE postoffices po
SET state = p.state,
    district = p.district,
    updated_at = CURRENT_TIMESTAMP
FROM pincodes p
WHERE po.pincode = p.pincode
  AND LOWER(p.state) LIKE '%andaman%'
  AND LOWER(po.state) != LOWER(p.state);

-- Step 1.3: Verify fix
SELECT COUNT(*) as remaining_andaman_mismatches
FROM postoffices po
JOIN pincodes p ON po.pincode = p.pincode
WHERE LOWER(p.state) LIKE '%andaman%'
  AND LOWER(po.state) != LOWER(p.state);


-- ============================================================================
-- TASK 2: Merge Dadra & Nagar Haveli + Daman & Diu back into combined UT
-- ============================================================================

-- Step 2.1: Check current state of these UTs in pincodes table
SELECT state, COUNT(*) as pincode_count
FROM pincodes
WHERE LOWER(state) IN ('dadra & nagar haveli', 'daman & diu', 'dadra & nagar haveli and daman & diu')
GROUP BY state;

-- Step 2.2: Check in postoffices table
SELECT state, COUNT(*) as postoffice_count
FROM postoffices
WHERE LOWER(state) IN ('dadra & nagar haveli', 'daman & diu', 'dadra & nagar haveli and daman & diu')
GROUP BY state;

-- Step 2.3: Update pincodes table - merge to combined name
UPDATE pincodes
SET state = 'dadra & nagar haveli and daman & diu',
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(state) IN ('dadra & nagar haveli', 'daman & diu');

-- Step 2.4: Update postoffices table - merge to combined name
UPDATE postoffices
SET state = 'dadra & nagar haveli and daman & diu',
    updated_at = CURRENT_TIMESTAMP
WHERE LOWER(state) IN ('dadra & nagar haveli', 'daman & diu');

-- Step 2.5: Verify the merge
SELECT state, COUNT(*) as pincode_count
FROM pincodes
WHERE LOWER(state) LIKE '%dadra%' OR LOWER(state) LIKE '%daman%'
GROUP BY state;

SELECT state, COUNT(*) as postoffice_count
FROM postoffices
WHERE LOWER(state) LIKE '%dadra%' OR LOWER(state) LIKE '%daman%'
GROUP BY state;

-- Step 2.6: Check total states count after merge
SELECT COUNT(DISTINCT state) as total_states
FROM pincodes
WHERE is_active = true;
