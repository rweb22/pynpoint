-- Verify regional prefixes are geographically accurate

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 Deep Verification: Regional Prefix Accuracy'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Test pincodes
CREATE TEMP TABLE test_pincodes AS
SELECT unnest(ARRAY[
  '124508', '387520', '333702', '641003', '587113', 
  '604305', '442904', '249146', '515621', '531085',
  '423117', '784101', '341512', '277303', '147105',
  '444901', '521156', '382045', '607101', '518360'
]) as pincode;

-- Get cells for test pincodes
CREATE TEMP TABLE test_cells AS
SELECT 
  p.pincode,
  p.state,
  p.district,
  p.office_name,
  ST_Y(ST_Centroid(p.boundary::geometry)) as latitude,
  ST_X(ST_Centroid(p.boundary::geometry)) as longitude,
  UNNEST(polygon_to_digipin_cells_level6(p.boundary, 200.0)) as cell
FROM test_pincodes tp
JOIN pincodes p ON tp.pincode = p.pincode;

\echo '1️⃣  Maharashtra pincodes - detailed analysis:'
\echo ''

SELECT 
  pincode,
  office_name,
  ROUND(latitude::numeric, 4) as lat,
  ROUND(longitude::numeric, 4) as lon,
  COUNT(*) as total_cells,
  COUNT(DISTINCT SUBSTRING(cell, 1, 2)) as unique_prefixes,
  STRING_AGG(DISTINCT SUBSTRING(cell, 1, 2), ', ' ORDER BY SUBSTRING(cell, 1, 2)) as prefixes
FROM test_cells
WHERE state = 'maharashtra'
GROUP BY pincode, office_name, latitude, longitude
ORDER BY pincode;

\echo ''
\echo '2️⃣  Pincode 442904 (Neri) - cell breakdown by prefix (spans 2 prefixes):'
\echo ''

SELECT
  SUBSTRING(cell, 1, 2) as prefix,
  COUNT(*) as cell_count,
  (ARRAY_AGG(cell ORDER BY cell))[1:5] as sample_cells
FROM test_cells
WHERE pincode = '442904'
GROUP BY SUBSTRING(cell, 1, 2)
ORDER BY prefix;

\echo ''
\echo '3️⃣  Verify 442904 centroid vs boundary cells:'
\echo ''

SELECT
  '442904' as pincode,
  'Centroid DIGIPIN' as type,
  encode_digipin_level6(20.4384, 79.5075) as digipin,
  SUBSTRING(encode_digipin_level6(20.4384, 79.5075), 1, 2) as prefix
UNION ALL
SELECT
  '442904' as pincode,
  'Boundary cells' as type,
  NULL as digipin,
  STRING_AGG(DISTINCT SUBSTRING(cell, 1, 2), ', ' ORDER BY SUBSTRING(cell, 1, 2)) as prefix
FROM test_cells
WHERE pincode = '442904';

\echo ''
\echo '4️⃣  All states - prefix summary:'
\echo ''

SELECT 
  state,
  COUNT(DISTINCT pincode) as pincodes,
  COUNT(*) as total_cells,
  COUNT(DISTINCT SUBSTRING(cell, 1, 2)) as unique_prefixes,
  STRING_AGG(DISTINCT SUBSTRING(cell, 1, 2), ', ' ORDER BY SUBSTRING(cell, 1, 2)) as prefixes
FROM test_cells
GROUP BY state
ORDER BY state;

\echo ''
\echo '5️⃣  Test centroids against encode_digipin_level6 function:'
\echo ''

SELECT 
  pincode,
  state,
  office_name,
  ROUND(latitude::numeric, 4) as lat,
  ROUND(longitude::numeric, 4) as lon,
  encode_digipin_level6(latitude, longitude) as centroid_digipin,
  SUBSTRING(encode_digipin_level6(latitude, longitude), 1, 2) as centroid_prefix
FROM (
  SELECT DISTINCT 
    pincode, 
    state, 
    office_name, 
    latitude, 
    longitude
  FROM test_cells
) sub
ORDER BY state, pincode;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Verification Complete'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
