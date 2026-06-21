-- Verify that batches are being stored correctly

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 Verifying DIGIPIN Population Progress'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '1️⃣  Overall Statistics:'
\echo ''

SELECT 
  COUNT(*) as total_pincodes,
  COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') as populated,
  COUNT(*) FILTER (WHERE digipin_cells = '{}') as empty,
  ROUND((COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}')::NUMERIC / COUNT(*) * 100)::NUMERIC, 2) as percent_complete,
  SUM(cardinality(digipin_cells)) as total_cells,
  ROUND(AVG(cardinality(digipin_cells)) FILTER (WHERE digipin_cells != '{}')::NUMERIC, 2) as avg_cells_per_pincode
FROM pincodes
WHERE boundary IS NOT NULL;

\echo ''
\echo '2️⃣  Sample of populated pincodes (first 10 alphabetically):'
\echo ''

SELECT 
  pincode,
  office_name,
  state,
  cardinality(digipin_cells) as cell_count,
  SUBSTRING((digipin_cells)[1], 1, 2) as first_cell_prefix,
  (digipin_cells)[1:3] as sample_cells
FROM pincodes
WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
ORDER BY pincode
LIMIT 10;

\echo ''
\echo '3️⃣  Verify cell format (should all be 6 characters):'
\echo ''

SELECT 
  CASE 
    WHEN MIN(LENGTH(cell)) = 6 AND MAX(LENGTH(cell)) = 6 THEN '✅ All cells are 6 characters'
    ELSE '❌ INVALID - Some cells are not 6 characters!'
  END as format_check,
  MIN(LENGTH(cell)) as min_length,
  MAX(LENGTH(cell)) as max_length,
  COUNT(*) as total_cells_checked
FROM (
  SELECT unnest(digipin_cells) as cell
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  LIMIT 1000
) sub;

\echo ''
\echo '4️⃣  Verify regional prefix consistency (sample by state):'
\echo ''

SELECT 
  state,
  COUNT(DISTINCT pincode) as pincodes,
  SUM(cardinality(digipin_cells)) as total_cells,
  COUNT(DISTINCT SUBSTRING(unnest_cell, 1, 2)) as unique_prefixes,
  ARRAY_AGG(DISTINCT SUBSTRING(unnest_cell, 1, 2) ORDER BY SUBSTRING(unnest_cell, 1, 2)) FILTER (WHERE SUBSTRING(unnest_cell, 1, 2) IS NOT NULL) as prefixes
FROM (
  SELECT 
    p.pincode,
    p.state,
    p.digipin_cells,
    unnest(p.digipin_cells) as unnest_cell
  FROM pincodes p
  WHERE p.digipin_cells IS NOT NULL AND p.digipin_cells != '{}'
) sub
GROUP BY state
ORDER BY pincodes DESC
LIMIT 10;

\echo ''
\echo '5️⃣  Verify centroids match their cells:'
\echo ''

WITH centroid_check AS (
  SELECT 
    pincode,
    office_name,
    state,
    ST_Y(ST_Centroid(boundary::geometry)) as lat,
    ST_X(ST_Centroid(boundary::geometry)) as lng,
    encode_digipin_level6(
      ST_Y(ST_Centroid(boundary::geometry)), 
      ST_X(ST_Centroid(boundary::geometry))
    ) as centroid_digipin,
    digipin_cells
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  LIMIT 10
)
SELECT 
  pincode,
  office_name,
  state,
  centroid_digipin,
  CASE 
    WHEN centroid_digipin = ANY(digipin_cells) THEN '✅ Centroid in cells'
    ELSE '⚠️  Centroid not in cells (may be near edge)'
  END as validation
FROM centroid_check
ORDER BY pincode;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Verification Complete'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
