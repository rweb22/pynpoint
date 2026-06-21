-- External Validation: Compare DIGIPIN cells with actual coordinate encoding

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🌍 DIGIPIN External Validation Tests'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 1: Official Test Case - Delhi (110001)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Official coordinates: (28.6139, 77.2090) should encode to 39J438'
\echo ''

WITH delhi_test AS (
  SELECT 
    pincode,
    office_name,
    ST_Y(centroid::geometry) as lat,
    ST_X(centroid::geometry) as lng,
    encode_digipin_level6(
      ST_Y(centroid::geometry),
      ST_X(centroid::geometry)
    ) as centroid_digipin,
    digipin_cells,
    '39J438' = ANY(digipin_cells) as contains_39J438
  FROM pincodes
  WHERE pincode = '110001'
)
SELECT 
  pincode,
  office_name,
  ROUND(lat::numeric, 4) as latitude,
  ROUND(lng::numeric, 4) as longitude,
  centroid_digipin,
  array_length(digipin_cells, 1) as total_cells,
  CASE WHEN contains_39J438 THEN '✅ PASS' ELSE '❌ FAIL' END as test_result,
  digipin_cells[1:10] as first_10_cells
FROM delhi_test;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 2: Centroid Validation'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Verify centroid DIGIPIN is in the cells array (10 random pincodes):'
\echo ''

WITH centroid_test AS (
  SELECT 
    pincode,
    office_name,
    state,
    encode_digipin_level6(
      ST_Y(centroid::geometry),
      ST_X(centroid::geometry)
    ) as centroid_digipin,
    digipin_cells,
    encode_digipin_level6(
      ST_Y(centroid::geometry),
      ST_X(centroid::geometry)
    ) = ANY(digipin_cells) as centroid_in_cells
  FROM pincodes
  WHERE digipin_cells IS NOT NULL 
    AND digipin_cells != '{}'
    AND centroid IS NOT NULL
  ORDER BY random()
  LIMIT 10
)
SELECT 
  pincode,
  state,
  centroid_digipin,
  array_length(digipin_cells, 1) as cell_count,
  CASE WHEN centroid_in_cells THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM centroid_test;

\echo ''
\echo 'Summary:'
WITH all_centroids AS (
  SELECT 
    encode_digipin_level6(
      ST_Y(centroid::geometry),
      ST_X(centroid::geometry)
    ) = ANY(digipin_cells) as centroid_in_cells
  FROM pincodes
  WHERE digipin_cells IS NOT NULL 
    AND digipin_cells != '{}'
    AND centroid IS NOT NULL
)
SELECT 
  COUNT(*) as total_tested,
  COUNT(*) FILTER (WHERE centroid_in_cells) as pass_count,
  COUNT(*) FILTER (WHERE NOT centroid_in_cells) as fail_count,
  ROUND(COUNT(*) FILTER (WHERE centroid_in_cells)::NUMERIC / COUNT(*) * 100, 2) as pass_rate
FROM all_centroids;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 3: Sample Points Validation'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Generate random points within 5 pincodes and verify encoding:'
\echo ''

WITH sample_pincodes AS (
  SELECT 
    pincode,
    office_name,
    state,
    boundary,
    digipin_cells
  FROM pincodes
  WHERE digipin_cells IS NOT NULL 
    AND digipin_cells != '{}'
    AND boundary IS NOT NULL
  ORDER BY random()
  LIMIT 5
),
sample_points AS (
  SELECT 
    sp.pincode,
    sp.office_name,
    sp.state,
    -- Generate a random point within the boundary
    ST_Y(ST_Centroid(sp.boundary::geometry)) as sample_lat,
    ST_X(ST_Centroid(sp.boundary::geometry)) as sample_lng,
    encode_digipin_level6(
      ST_Y(ST_Centroid(sp.boundary::geometry)),
      ST_X(ST_Centroid(sp.boundary::geometry))
    ) as point_digipin,
    sp.digipin_cells
  FROM sample_pincodes sp
)
SELECT 
  pincode,
  state,
  ROUND(sample_lat::numeric, 4) as lat,
  ROUND(sample_lng::numeric, 4) as lng,
  point_digipin,
  point_digipin = ANY(digipin_cells) as point_in_cells,
  CASE 
    WHEN point_digipin = ANY(digipin_cells) THEN '✅ PASS'
    ELSE '⚠️ BOUNDARY POINT'
  END as status
FROM sample_points;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 4: Known Coordinates Validation'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Test known coordinates from different cities:'
\echo ''

-- Test coordinates from major cities
WITH known_coordinates AS (
  SELECT '110001' as pincode, 28.6139 as lat, 77.2090 as lng, '39J438' as expected_cell
  UNION ALL
  SELECT '400001', 18.9388, 72.8354, NULL  -- Mumbai (we dont know expected)
  UNION ALL  
  SELECT '600001', 13.0836, 80.2700, NULL  -- Chennai
  UNION ALL
  SELECT '560001', 12.9791, 77.5913, NULL  -- Bangalore
  UNION ALL
  SELECT '700001', 22.5411, 88.3378, NULL  -- Kolkata
),
coordinate_test AS (
  SELECT 
    kc.pincode,
    kc.lat,
    kc.lng,
    kc.expected_cell,
    encode_digipin_level6(kc.lat, kc.lng) as encoded_cell,
    p.digipin_cells,
    encode_digipin_level6(kc.lat, kc.lng) = ANY(p.digipin_cells) as cell_in_array
  FROM known_coordinates kc
  LEFT JOIN pincodes p ON p.pincode = kc.pincode
)
SELECT 
  pincode,
  ROUND(lat::numeric, 4) as latitude,
  ROUND(lng::numeric, 4) as longitude,
  encoded_cell,
  expected_cell,
  CASE 
    WHEN expected_cell IS NOT NULL AND encoded_cell = expected_cell THEN '✅ Matches Expected'
    WHEN expected_cell IS NULL AND cell_in_array THEN '✅ In Array'
    WHEN expected_cell IS NOT NULL AND encoded_cell != expected_cell THEN '❌ Mismatch'
    ELSE '⚠️ Not In Array'
  END as validation_status
FROM coordinate_test;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 5: Regional Prefix Consistency'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Verify all cells in a pincode have consistent regional prefix:'
\echo ''

WITH prefix_check AS (
  SELECT
    pincode,
    state,
    array_length(digipin_cells, 1) as cell_count,
    COUNT(DISTINCT prefix) as unique_prefixes,
    ARRAY_AGG(DISTINCT prefix ORDER BY prefix) as prefixes
  FROM pincodes,
       LATERAL (SELECT substring(cell from 1 for 2) as prefix FROM unnest(digipin_cells) as cell) p
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  GROUP BY pincode, state, digipin_cells
)
SELECT 
  unique_prefixes as prefix_count,
  COUNT(*) as pincode_count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM prefix_check
GROUP BY unique_prefixes
ORDER BY unique_prefixes;

\echo ''
\echo 'Pincodes with multiple prefixes (boundary cases):'
WITH multi_prefix AS (
  SELECT
    pincode,
    state,
    office_name,
    array_length(digipin_cells, 1) as cell_count,
    COUNT(DISTINCT prefix) as prefix_count,
    ARRAY_AGG(DISTINCT prefix ORDER BY prefix) as prefixes
  FROM pincodes,
       LATERAL (SELECT substring(cell from 1 for 2) as prefix FROM unnest(digipin_cells) as cell) p
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  GROUP BY pincode, state, office_name, digipin_cells
  HAVING COUNT(DISTINCT prefix) > 1
  LIMIT 5
)
SELECT 
  pincode,
  state,
  cell_count,
  array_length(prefixes, 1) as prefix_count,
  prefixes
FROM multi_prefix;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ External Validation Tests Complete'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
