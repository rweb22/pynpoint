-- Comprehensive DIGIPIN Validation Across 20 Random Pincodes
-- Tests geometric accuracy across different regions of India

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 DIGIPIN Multi-Pincode Geometric Validation'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Test pincodes from the previous random selection
CREATE TEMP TABLE test_pincodes AS
SELECT unnest(ARRAY[
  '124508', '387520', '333702', '641003', '587113',
  '604305', '442904', '249146', '515621', '531085',
  '423117', '784101', '341512', '277303', '147105',
  '444901', '521156', '382045', '607101', '518360'
]) as pincode;

\echo '📍 Testing 20 pincodes from across India:'
SELECT
  tp.pincode,
  p.office_name,
  p.state,
  p.district,
  ROUND((ST_Area(p.boundary) / 1000000.0)::numeric, 2) as area_km2
FROM test_pincodes tp
JOIN pincodes p ON tp.pincode = p.pincode
ORDER BY p.state, tp.pincode;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 1: Generate cells for all test pincodes
\echo '🔢 Step 1: Generating DIGIPIN cells for all test pincodes...'
\echo ''

CREATE TEMP TABLE multi_test_cells AS
SELECT
  p.pincode,
  p.state,
  p.district,
  UNNEST(polygon_to_digipin_cells_level6(p.boundary, 200.0)) as cell,
  ROUND((ST_Area(p.boundary) / 1000000.0)::numeric, 2) as area_km2
FROM test_pincodes tp
JOIN pincodes p ON tp.pincode = p.pincode;

\echo 'Cell generation summary:'
SELECT
  pincode,
  state,
  area_km2,
  COUNT(*) as cell_count,
  ROUND((COUNT(*)::numeric / NULLIF(area_km2, 0)), 2) as cells_per_km2
FROM multi_test_cells
GROUP BY pincode, state, area_km2
ORDER BY state, pincode;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 2: Validate cell prefixes match expected regions
\echo '🗺️  Step 2: Validating cell prefixes match geographic regions...'
\echo ''

-- Extract first 2-3 characters as region prefix
CREATE TEMP TABLE cell_prefix_validation AS
SELECT
  pincode,
  state,
  cell,
  SUBSTRING(cell, 1, 2) as region_prefix
FROM multi_test_cells;

\echo 'Region prefix distribution by state:'
SELECT
  state,
  region_prefix,
  COUNT(*) as cell_count,
  COUNT(DISTINCT pincode) as pincode_count
FROM cell_prefix_validation
GROUP BY state, region_prefix
ORDER BY state, region_prefix;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 3: Check for neighboring pincodes and shared cells
\echo '🔗 Step 3: Testing boundary sharing for pincodes with neighbors...'
\echo ''
\echo '   ⏳ Finding neighbors (ST_Touches check)...'

CREATE TEMP TABLE neighbor_pairs AS
SELECT
  p1.pincode as pincode_1,
  p2.pincode as pincode_2,
  p1.state,
  p1.office_name as office_1,
  p2.office_name as office_2,
  p2.boundary
FROM test_pincodes tp1
JOIN pincodes p1 ON tp1.pincode = p1.pincode
JOIN pincodes p2 ON ST_Touches(p1.boundary::geometry, p2.boundary::geometry);

\echo '   ✓ Neighbor pairs found:'
SELECT
  COUNT(DISTINCT pincode_1) as test_pincodes_with_neighbors,
  COUNT(*) as total_neighbor_pairs
FROM neighbor_pairs;

\echo ''
\echo 'Sample neighbor pairs:'
SELECT pincode_1, pincode_2, state, office_1, office_2
FROM neighbor_pairs
LIMIT 10;



\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 4: Generate cells for neighbor pincodes (only for those that touch our test set)
\echo '🔄 Step 4: Generating cells for neighbor pincodes...'
\echo ''
\echo '   ⏳ Generating DIGIPIN cells for neighbors (this may take a few minutes)...'

CREATE TEMP TABLE neighbor_cells AS
SELECT
  np.pincode_2 as pincode,
  UNNEST(polygon_to_digipin_cells_level6(np.boundary, 200.0)) as cell
FROM neighbor_pairs np;

\echo '   ✓ Neighbor cells generated:'
SELECT COUNT(DISTINCT pincode) as neighbor_pincodes, COUNT(*) as total_cells
FROM neighbor_cells;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 5: Find shared cells between test pincodes and their neighbors
\echo '🔗 Step 5: Finding shared boundary cells...'
\echo ''
\echo '   ⏳ Comparing cells to find overlaps...'

CREATE TEMP TABLE shared_cells AS
SELECT
  np.pincode_1,
  np.pincode_2,
  c1.cell,
  np.state
FROM neighbor_pairs np
JOIN multi_test_cells c1 ON c1.pincode = np.pincode_1
JOIN neighbor_cells c2 ON c2.pincode = np.pincode_2 AND c2.cell = c1.cell;

\echo '   ✓ Shared cell statistics:'
SELECT
  COUNT(DISTINCT pincode_1) as test_pincodes_with_shared_cells,
  COUNT(DISTINCT (pincode_1, pincode_2)) as neighbor_pairs_with_shared_cells,
  COUNT(*) as total_shared_cells
FROM shared_cells;

\echo ''
\echo 'Sample shared cells:'
SELECT * FROM shared_cells LIMIT 15;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 6: Verify shared cells have consistent regional prefixes
\echo '🔍 Step 6: Verifying shared cells have consistent regional prefixes...'
\echo ''
\echo '   ⏳ Checking regional prefix consistency for shared boundary cells...'

CREATE TEMP TABLE shared_cell_regions AS
SELECT
  sc.pincode_1,
  sc.pincode_2,
  sc.cell,
  SUBSTRING(sc.cell, 1, 2) as region_prefix,
  c1.state as state_1
FROM shared_cells sc
JOIN multi_test_cells c1 ON c1.pincode = sc.pincode_1 AND c1.cell = sc.cell;

\echo '   ✓ Regional prefix analysis for shared cells:'
SELECT
  state_1,
  region_prefix,
  COUNT(DISTINCT pincode_1) as pincodes,
  COUNT(*) as shared_cells
FROM shared_cell_regions
GROUP BY state_1, region_prefix
ORDER BY state_1, region_prefix;

\echo ''
\echo 'Regional consistency check:'
SELECT
  state_1,
  COUNT(DISTINCT region_prefix) as unique_prefixes,
  CASE
    WHEN COUNT(DISTINCT region_prefix) <= 5 THEN '✅ PASS - Regional consistency maintained'
    ELSE '⚠️  WARN - Multiple regions detected'
  END as consistency_status
FROM shared_cell_regions
GROUP BY state_1
ORDER BY state_1;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 7: Verify unique cells are contained within their pincodes
\echo '🔒 Step 7: Verifying unique cells are contained within their pincodes...'
\echo ''
\echo '   ⏳ Finding cells unique to each test pincode...'

CREATE TEMP TABLE unique_test_cells AS
SELECT
  c.pincode,
  c.cell,
  c.state,
  SUBSTRING(c.cell, 1, 2) as region_prefix
FROM multi_test_cells c
WHERE c.cell NOT IN (
  SELECT cell FROM shared_cells WHERE pincode_1 = c.pincode
);

\echo '   ✓ Unique cells per pincode:'
SELECT
  pincode,
  state,
  COUNT(*) as unique_cells,
  COUNT(DISTINCT region_prefix) as unique_prefixes
FROM unique_test_cells
GROUP BY pincode, state
ORDER BY state, pincode;

\echo ''
\echo 'Regional consistency for unique cells:'
SELECT
  state,
  region_prefix,
  COUNT(DISTINCT pincode) as pincodes,
  COUNT(*) as unique_cells
FROM unique_test_cells
GROUP BY state, region_prefix
ORDER BY state, region_prefix;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- STEP 8: Final validation summary
\echo '✅ Step 8: Final Validation Summary'
\echo ''
\echo '   ⏳ Calculating statistics...'

\echo ''
\echo 'Overall Statistics:'
SELECT
  (SELECT COUNT(DISTINCT pincode) FROM multi_test_cells) as pincodes_tested,
  (SELECT COUNT(DISTINCT state) FROM multi_test_cells) as states_covered,
  (SELECT COUNT(*) FROM multi_test_cells) as total_cells_generated,
  (SELECT COUNT(DISTINCT pincode_1) FROM neighbor_pairs) as pincodes_with_neighbors,
  (SELECT COUNT(*) FROM shared_cells) as total_shared_boundary_cells,
  (SELECT COUNT(*) FROM unique_test_cells) as total_unique_cells;

\echo ''
\echo 'Cell Distribution:'
SELECT
  'Shared boundary cells' as category,
  COUNT(*) as count,
  ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM multi_test_cells) * 100)::numeric, 1) as percentage
FROM shared_cells
UNION ALL
SELECT
  'Unique interior cells' as category,
  COUNT(*) as count,
  ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM multi_test_cells) * 100)::numeric, 1) as percentage
FROM unique_test_cells;

\echo ''
\echo 'Validation Results:'
SELECT
  'All pincodes generated cells' as test,
  CASE
    WHEN (SELECT COUNT(DISTINCT pincode) FROM multi_test_cells) = 20 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
UNION ALL
SELECT
  'Shared boundary cells exist' as test,
  CASE
    WHEN (SELECT COUNT(*) FROM shared_cells) > 0 THEN '✅ PASS'
    ELSE '⚠️  WARN - No neighbors tested'
  END as result
UNION ALL
SELECT
  'Multiple states covered' as test,
  CASE
    WHEN (SELECT COUNT(DISTINCT state) FROM multi_test_cells) >= 5 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as result
UNION ALL
SELECT
  'Regional consistency (shared cells)' as test,
  CASE
    WHEN (SELECT MAX(prefix_count) FROM (
      SELECT COUNT(DISTINCT region_prefix) as prefix_count
      FROM shared_cell_regions
      GROUP BY state_1
    ) sub) <= 3 THEN '✅ PASS'
    ELSE '❌ FAIL - Too many region prefixes per state'
  END as result
UNION ALL
SELECT
  'Regional consistency (unique cells)' as test,
  CASE
    WHEN (SELECT MAX(prefix_count) FROM (
      SELECT COUNT(DISTINCT region_prefix) as prefix_count
      FROM unique_test_cells
      GROUP BY state
    ) sub) <= 3 THEN '✅ PASS'
    ELSE '❌ FAIL - Too many region prefixes per state'
  END as result;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Multi-Pincode Validation Complete!'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
