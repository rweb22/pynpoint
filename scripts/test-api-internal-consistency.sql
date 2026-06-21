-- Internal Consistency Testing for DIGIPIN API

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔄 DIGIPIN API Internal Consistency Tests'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 1: Round-trip Consistency (Pincode → DIGIPIN → Pincode)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Testing: 110001 (Delhi)'
\echo ''

WITH pincode_to_digipin AS (
  -- Step 1: Get all DIGIPIN cells for pincode 110001
  SELECT 
    pincode,
    office_name,
    digipin_cells,
    array_length(digipin_cells, 1) as cell_count
  FROM pincodes
  WHERE pincode = '110001'
),
digipin_to_pincode AS (
  -- Step 2: For each cell, find which pincodes contain it
  SELECT
    cell as digipin_code,
    ARRAY_AGG(DISTINCT p.pincode ORDER BY p.pincode) as matching_pincodes
  FROM pincode_to_digipin ptd,
       LATERAL unnest(ptd.digipin_cells) as cell
  CROSS JOIN pincodes p
  WHERE p.digipin_cells @> ARRAY[cell]
  GROUP BY cell
)
SELECT 
  '110001 → DIGIPIN cells' as test,
  ptd.cell_count as total_cells,
  ptd.digipin_cells[1:5] as sample_cells
FROM pincode_to_digipin ptd
UNION ALL
SELECT 
  'DIGIPIN → Pincodes (sample)' as test,
  COUNT(*) as cells_tested,
  NULL as sample_cells
FROM digipin_to_pincode
UNION ALL
SELECT 
  'All cells map back to 110001' as test,
  COUNT(*) FILTER (WHERE '110001' = ANY(matching_pincodes)) as cells_mapping_back,
  NULL
FROM digipin_to_pincode;

\echo ''
\echo 'Detailed breakdown for first 5 cells:'
WITH pincode_cells AS (
  SELECT unnest(digipin_cells) as cell
  FROM pincodes
  WHERE pincode = '110001'
  LIMIT 5
)
SELECT 
  pc.cell as digipin_code,
  COUNT(DISTINCT p.pincode) as pincode_count,
  ARRAY_AGG(DISTINCT p.pincode ORDER BY p.pincode) as pincodes,
  '110001' = ANY(ARRAY_AGG(DISTINCT p.pincode)) as contains_original
FROM pincode_cells pc
JOIN pincodes p ON p.digipin_cells @> ARRAY[pc.cell]
GROUP BY pc.cell
ORDER BY pc.cell;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 2: Boundary Cell Consistency'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Cells shared between multiple pincodes (boundary cells):'
\echo ''

WITH cell_sharing AS (
  SELECT 
    unnest(digipin_cells) as cell,
    COUNT(DISTINCT pincode) as pincode_count,
    ARRAY_AGG(DISTINCT pincode ORDER BY pincode) as pincodes
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  GROUP BY cell
  HAVING COUNT(DISTINCT pincode) > 1
)
SELECT 
  pincode_count,
  COUNT(*) as num_cells,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM cell_sharing
GROUP BY pincode_count
ORDER BY pincode_count DESC
LIMIT 10;

\echo ''
\echo 'Sample boundary cells (shared by 2 pincodes):'
WITH cell_sharing AS (
  SELECT 
    unnest(digipin_cells) as cell,
    COUNT(DISTINCT pincode) as pincode_count,
    ARRAY_AGG(DISTINCT pincode ORDER BY pincode) as pincodes
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  GROUP BY cell
  HAVING COUNT(DISTINCT pincode) = 2
  LIMIT 5
)
SELECT 
  cell as digipin_code,
  pincodes[1] as pincode_1,
  pincodes[2] as pincode_2
FROM cell_sharing;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 3: Unique Cell Consistency'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Cells that belong to exactly one pincode (interior cells):'
\echo ''

WITH all_cells AS (
  SELECT cell
  FROM pincodes,
       LATERAL unnest(digipin_cells) as cell
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
),
unique_cells AS (
  SELECT cell, COUNT(DISTINCT pincode) as pincode_count
  FROM pincodes,
       LATERAL unnest(digipin_cells) as cell
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  GROUP BY cell
  HAVING COUNT(DISTINCT pincode) = 1
)
SELECT
  COUNT(*) as total_unique_cells,
  ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(DISTINCT cell) FROM all_cells) * 100, 2) as percentage_unique
FROM unique_cells;

\echo ''
\echo 'Sample unique cells for 110001:'
WITH delhi_unique AS (
  SELECT unnest(digipin_cells) as cell
  FROM pincodes
  WHERE pincode = '110001'
)
SELECT 
  du.cell as digipin_code,
  p.pincode,
  p.office_name
FROM delhi_unique du
JOIN pincodes p ON p.digipin_cells @> ARRAY[du.cell]
GROUP BY du.cell, p.pincode, p.office_name
HAVING COUNT(*) = 1
LIMIT 5;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 4: Cross-validation with Multiple Pincodes'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Testing 5 random pincodes for round-trip consistency:'
\echo ''

WITH test_pincodes AS (
  SELECT pincode, office_name, state, digipin_cells
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  ORDER BY random()
  LIMIT 5
),
round_trip AS (
  SELECT 
    tp.pincode as original_pincode,
    tp.office_name,
    tp.state,
    array_length(tp.digipin_cells, 1) as cell_count,
    tp.digipin_cells[1] as sample_cell,
    -- Check if reverse lookup includes original pincode
    EXISTS(
      SELECT 1 FROM pincodes p 
      WHERE p.digipin_cells @> ARRAY[tp.digipin_cells[1]]
        AND p.pincode = tp.pincode
    ) as round_trip_success
  FROM test_pincodes tp
)
SELECT 
  original_pincode,
  office_name,
  state,
  cell_count,
  sample_cell,
  CASE WHEN round_trip_success THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM round_trip;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 5: Cell Format Validation'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Verify all cells are Level 6 (6 characters):'
\echo ''

WITH all_cells AS (
  SELECT 
    unnest(digipin_cells) as cell,
    pincode
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
)
SELECT 
  length(cell) as cell_length,
  COUNT(*) as count,
  CASE 
    WHEN length(cell) = 6 THEN '✅ Valid'
    ELSE '❌ Invalid'
  END as status
FROM all_cells
GROUP BY length(cell)
ORDER BY cell_length;

\echo ''
\echo 'Check character set (should only use: F,C,9,8,3,2,J,K,L,M,P,T,4,5,6,7):'
WITH all_cells AS (
  SELECT DISTINCT unnest(digipin_cells) as cell
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  LIMIT 100
)
SELECT 
  COUNT(*) as sample_size,
  COUNT(*) FILTER (WHERE cell ~ '^[FC9832JKLMPT4567]{6}$') as valid_chars,
  COUNT(*) FILTER (WHERE cell !~ '^[FC9832JKLMPT4567]{6}$') as invalid_chars
FROM all_cells;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Internal Consistency Tests Complete'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
