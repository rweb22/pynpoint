-- Quick Manual Validation Tests

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 Quick DIGIPIN Validation Tests'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Test 1: Delhi Test Case
\echo '1️⃣  Delhi Test (110001 → 39J438):'
SELECT 
  pincode,
  '39J438' = ANY(digipin_cells) as contains_39J438,
  array_length(digipin_cells, 1) as total_cells,
  digipin_cells[1:5] as sample_cells
FROM pincodes
WHERE pincode = '110001';

\echo ''

-- Test 2: Reverse Lookup
\echo '2️⃣  Reverse Lookup (39J438 → 110001):'
SELECT pincode, office_name, state
FROM pincodes
WHERE digipin_cells @> ARRAY['39J438'];

\echo ''

-- Test 3: Round-trip for 5 random pincodes
\echo '3️⃣  Round-trip Test (5 random pincodes):'
WITH test_set AS (
  SELECT 
    pincode,
    state,
    digipin_cells[1] as sample_cell
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  ORDER BY random()
  LIMIT 5
)
SELECT 
  ts.pincode as original,
  ts.state,
  ts.sample_cell,
  (SELECT COUNT(*) FROM pincodes p WHERE p.digipin_cells @> ARRAY[ts.sample_cell]) as matches,
  EXISTS(
    SELECT 1 FROM pincodes p 
    WHERE p.digipin_cells @> ARRAY[ts.sample_cell] 
      AND p.pincode = ts.pincode
  ) as round_trip_ok
FROM test_set ts;

\echo ''

-- Test 4: Centroid validation
\echo '4️⃣  Centroid Validation (10 random):'
SELECT 
  pincode,
  state,
  encode_digipin_level6(ST_Y(centroid::geometry), ST_X(centroid::geometry)) as centroid_cell,
  encode_digipin_level6(ST_Y(centroid::geometry), ST_X(centroid::geometry)) = ANY(digipin_cells) as in_array
FROM pincodes
WHERE digipin_cells IS NOT NULL 
  AND digipin_cells != '{}'
  AND centroid IS NOT NULL
ORDER BY random()
LIMIT 10;

\echo ''

-- Test 5: Format validation
\echo '5️⃣  Cell Format Validation:'
WITH all_cells AS (
  SELECT unnest(digipin_cells) as cell
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  LIMIT 1000
)
SELECT 
  COUNT(*) as total_sampled,
  COUNT(*) FILTER (WHERE length(cell) = 6) as correct_length,
  COUNT(*) FILTER (WHERE cell ~ '^[FC9832JKLMPT4567]{6}$') as valid_chars
FROM all_cells;

\echo ''
\echo '✅ Quick tests complete!'
