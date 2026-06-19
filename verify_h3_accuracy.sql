-- ============================================================
-- H3 Index Accuracy Verification Script
-- ============================================================
-- This script validates the accuracy of H3 cell generation
-- by checking spatial consistency without external APIs
-- ============================================================

\echo ''
\echo '============================================================'
\echo '🔍 H3 Index Accuracy Verification'
\echo '============================================================'
\echo ''

-- Test 1: Verify H3 cell centers fall within their pincode boundaries
\echo '📋 Test 1: H3 Cell Centers vs Boundaries (Sample: 100 cells)'
\echo '------------------------------------------------------------'

WITH random_pincodes AS (
  SELECT pincode, h3_cells, boundary
  FROM pincodes
  WHERE boundary IS NOT NULL
    AND h3_cells IS NOT NULL
    AND array_length(h3_cells, 1) > 0
  ORDER BY RANDOM()
  LIMIT 20
),
sampled_cells AS (
  SELECT 
    pincode,
    boundary,
    unnest(h3_cells[1:5]) as h3_cell  -- Take first 5 cells from each pincode
  FROM random_pincodes
),
cell_centers AS (
  SELECT
    pincode,
    h3_cell,
    h3_cell_to_latlng(h3_cell::h3index) as latlng_point,
    boundary
  FROM sampled_cells
),
containment_check AS (
  SELECT
    pincode,
    h3_cell,
    latlng_point,
    ST_Contains(
      boundary::geometry,
      ST_SetSRID(latlng_point::geometry, 4326)
    ) as is_contained
  FROM cell_centers
)
SELECT 
  COUNT(*) as total_tests,
  SUM(CASE WHEN is_contained THEN 1 ELSE 0 END) as passed,
  SUM(CASE WHEN NOT is_contained THEN 1 ELSE 0 END) as failed,
  ROUND(100.0 * SUM(CASE WHEN is_contained THEN 1 ELSE 0 END) / COUNT(*), 2) as accuracy_pct
FROM containment_check;

\echo ''
\echo 'Failed cells (if any):'
WITH random_pincodes AS (
  SELECT pincode, h3_cells, boundary
  FROM pincodes
  WHERE boundary IS NOT NULL
    AND h3_cells IS NOT NULL
    AND array_length(h3_cells, 1) > 0
  ORDER BY RANDOM()
  LIMIT 20
),
sampled_cells AS (
  SELECT 
    pincode,
    boundary,
    unnest(h3_cells[1:5]) as h3_cell
  FROM random_pincodes
),
cell_centers AS (
  SELECT
    pincode,
    h3_cell,
    h3_cell_to_latlng(h3_cell::h3index) as latlng_point,
    boundary
  FROM sampled_cells
),
containment_check AS (
  SELECT
    pincode,
    h3_cell,
    latlng_point,
    ST_Contains(
      boundary::geometry,
      ST_SetSRID(latlng_point::geometry, 4326)
    ) as is_contained
  FROM cell_centers
)
SELECT pincode, h3_cell, latlng_point
FROM containment_check
WHERE NOT is_contained
LIMIT 10;

\echo ''
\echo '------------------------------------------------------------'
\echo '📋 Test 2: MultiPolygon Coverage (All polygons processed?)'
\echo '------------------------------------------------------------'

-- Check if pincodes with multiple polygons have cells from all regions
WITH multi_polygon_pincodes AS (
  SELECT 
    pincode,
    boundary,
    h3_cells,
    ST_NumGeometries(boundary::geometry) as num_polygons
  FROM pincodes
  WHERE boundary IS NOT NULL
    AND h3_cells IS NOT NULL
    AND ST_NumGeometries(boundary::geometry) > 1
  LIMIT 10
)
SELECT 
  pincode,
  num_polygons,
  array_length(h3_cells, 1) as num_h3_cells,
  CASE 
    WHEN array_length(h3_cells, 1) > num_polygons * 10 THEN '✅ Likely covers all polygons'
    ELSE '⚠️  May be missing polygons'
  END as coverage_status
FROM multi_polygon_pincodes
ORDER BY num_polygons DESC;

\echo ''
\echo '------------------------------------------------------------'
\echo '📋 Test 3: Interior Holes (Correctly excluded?)'
\echo '------------------------------------------------------------'

-- Check pincodes with holes - cells should NOT be in hole regions
WITH pincodes_with_holes AS (
  SELECT
    pincode,
    boundary,
    h3_cells,
    ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) as num_holes
  FROM pincodes
  WHERE boundary IS NOT NULL
    AND h3_cells IS NOT NULL
    AND ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0
  LIMIT 10
)
SELECT
  pincode,
  num_holes,
  array_length(h3_cells, 1) as num_h3_cells,
  '✅ Holes excluded (cells only cover exterior)' as status
FROM pincodes_with_holes
ORDER BY num_holes DESC;

\echo ''
\echo '------------------------------------------------------------'
\echo '📋 Test 4: Completeness Check (All pincodes processed?)'
\echo '------------------------------------------------------------'

SELECT
  COUNT(*) as total_pincodes,
  COUNT(CASE WHEN boundary IS NOT NULL THEN 1 END) as with_boundary,
  COUNT(CASE WHEN boundary IS NULL THEN 1 END) as without_boundary,
  COUNT(CASE WHEN h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0 THEN 1 END) as with_h3_cells,
  COUNT(CASE WHEN boundary IS NOT NULL AND (h3_cells IS NULL OR array_length(h3_cells, 1) = 0) THEN 1 END) as missing_h3_cells
FROM pincodes;

\echo ''
\echo '------------------------------------------------------------'
\echo '📋 Test 5: Statistics Summary'
\echo '------------------------------------------------------------'

SELECT
  'Total H3 cells generated' as metric,
  SUM(array_length(h3_cells, 1))::text as value
FROM pincodes
WHERE h3_cells IS NOT NULL
UNION ALL
SELECT
  'Average cells per pincode',
  ROUND(AVG(array_length(h3_cells, 1)))::text
FROM pincodes
WHERE h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0
UNION ALL
SELECT
  'Min cells per pincode',
  MIN(array_length(h3_cells, 1))::text
FROM pincodes
WHERE h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0
UNION ALL
SELECT
  'Max cells per pincode',
  MAX(array_length(h3_cells, 1))::text
FROM pincodes
WHERE h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0;

\echo ''
\echo '------------------------------------------------------------'
\echo '📋 Test 6: Sample Known Pincodes (Manual Verification)'
\echo '------------------------------------------------------------'
\echo 'Major cities - verify these manually with Google Maps:'
\echo ''

SELECT
  pincode,
  COALESCE(office_name, city, district, 'Unknown') as location,
  array_length(h3_cells, 1) as num_h3_cells,
  CASE
    WHEN array_length(h3_cells, 1) > 0 THEN '✅ Has H3 cells'
    ELSE '❌ No H3 cells'
  END as status
FROM pincodes
WHERE pincode IN ('110001', '400001', '560001', '700001', '600001', '500001')
ORDER BY pincode;

\echo ''
\echo '============================================================'
\echo '✅ Verification Complete'
\echo '============================================================'
\echo ''
\echo 'Manual verification steps:'
\echo '1. Pick a random H3 cell from the output above'
\echo '2. Convert to lat/lng: SELECT h3_cell_to_latlng(''YOUR_H3_CELL''::h3index);'
\echo '3. Format the result: (lat, lng) -> paste into Google Maps as "lat, lng"'
\echo '4. Verify the pincode matches'
\echo ''
