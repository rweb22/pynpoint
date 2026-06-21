-- Test DIGIPIN population on a small sample before full run

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 Testing DIGIPIN Population (5 pincodes)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Select 5 test pincodes
\echo '1️⃣  Selecting 5 test pincodes...'
CREATE TEMP TABLE test_pincodes AS
SELECT pincode, office_name, state, boundary
FROM pincodes
WHERE boundary IS NOT NULL
  AND pincode IN ('110001', '400001', '560001', '600001', '700001')
LIMIT 5;

SELECT pincode, office_name, state FROM test_pincodes;

\echo ''
\echo '2️⃣  Before update - checking current state...'
SELECT 
  pincode,
  CASE 
    WHEN digipin_cells IS NULL THEN 'NULL'
    WHEN digipin_cells = '{}' THEN 'Empty array'
    ELSE 'Has ' || cardinality(digipin_cells) || ' cells'
  END as current_state
FROM pincodes
WHERE pincode IN (SELECT pincode FROM test_pincodes);

\echo ''
\echo '3️⃣  Generating DIGIPIN cells for test pincodes...'
UPDATE pincodes p
SET digipin_cells = polygon_to_digipin_cells_level6(t.boundary, 200.0)
FROM test_pincodes t
WHERE p.pincode = t.pincode;

\echo ''
\echo '4️⃣  After update - verifying results...'
SELECT 
  pincode,
  office_name,
  cardinality(digipin_cells) as cell_count,
  (digipin_cells)[1:3] as sample_cells
FROM pincodes
WHERE pincode IN (SELECT pincode FROM test_pincodes)
ORDER BY pincode;

\echo ''
\echo '5️⃣  Verify cells are in correct format...'
SELECT 
  pincode,
  CASE 
    WHEN digipin_cells IS NULL THEN '❌ NULL'
    WHEN digipin_cells = '{}' THEN '❌ Empty'
    WHEN cardinality(digipin_cells) > 0 AND LENGTH((digipin_cells)[1]) = 6 THEN '✅ Valid'
    ELSE '❌ Invalid format'
  END as validation,
  cardinality(digipin_cells) as cells
FROM pincodes
WHERE pincode IN (SELECT pincode FROM test_pincodes)
ORDER BY pincode;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Test Complete!'
\echo ''
\echo 'If all validations show ✅ Valid, the population script is working.'
\echo 'If not, there is an issue with the function or update logic.'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
