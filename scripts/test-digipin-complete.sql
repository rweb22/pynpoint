-- Comprehensive DIGIPIN Testing Suite (Post-Population)

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 DIGIPIN Complete Testing Suite'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '1️⃣  POPULATION STATUS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  COUNT(*) as total_pincodes,
  COUNT(*) FILTER (WHERE boundary IS NOT NULL) as has_boundary,
  COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') as populated,
  COUNT(*) FILTER (WHERE digipin_cells = '{}' OR digipin_cells IS NULL) as empty,
  ROUND((COUNT(*) FILTER (WHERE digipin_cells != '{}')::NUMERIC / 
         COUNT(*) FILTER (WHERE boundary IS NOT NULL) * 100)::NUMERIC, 2) as percent_populated,
  SUM(array_length(digipin_cells, 1)) FILTER (WHERE digipin_cells IS NOT NULL) as total_cells,
  ROUND(AVG(array_length(digipin_cells, 1)) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'), 1) as avg_cells_per_pincode,
  MIN(array_length(digipin_cells, 1)) FILTER (WHERE digipin_cells != '{}') as min_cells,
  MAX(array_length(digipin_cells, 1)) as max_cells
FROM pincodes;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '2️⃣  GIN INDEX STATUS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexrelname = 'idx_pincodes_digipin_cells_gin';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '3️⃣  UPDATE STATISTICS (Critical for Index Usage)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

ANALYZE pincodes;

\echo '✅ Statistics updated'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '4️⃣  TEST: Delhi (110001) - Official Test Case'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '📍 Pincode → DIGIPIN (should contain 39J438):'
SELECT 
  pincode,
  office_name,
  array_length(digipin_cells, 1) as cell_count,
  '39J438' = ANY(digipin_cells) as contains_39J438,
  digipin_cells[1:5] as first_5_cells
FROM pincodes
WHERE pincode = '110001';

\echo ''
\echo '📍 DIGIPIN → Pincode (39J438 should return 110001):'
EXPLAIN ANALYZE
SELECT pincode, office_name, state
FROM pincodes
WHERE digipin_cells @> ARRAY['39J438'];

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '5️⃣  TEST: Boundary Cell (Shared Between Pincodes)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo 'Find a cell shared by multiple pincodes:'
WITH cell_counts AS (
  SELECT 
    unnest(digipin_cells) as cell,
    COUNT(*) as pincode_count
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
  GROUP BY cell
  HAVING COUNT(*) > 1
  LIMIT 1
)
SELECT 
  cell,
  pincode_count,
  ARRAY(
    SELECT p.pincode 
    FROM pincodes p 
    WHERE p.digipin_cells @> ARRAY[cell_counts.cell]
    LIMIT 5
  ) as pincodes
FROM cell_counts;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '6️⃣  TEST: Index Usage Verification'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo 'Using @> operator (should use Bitmap Index Scan):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pincode, office_name
FROM pincodes
WHERE digipin_cells @> ARRAY['39J438'];

\echo ''
\echo 'Compare with = ANY() operator (should use Sequential Scan):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pincode, office_name
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '7️⃣  TEST: Random Samples Across India'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo 'Test 10 random pincodes:'
SELECT 
  pincode,
  state,
  office_name,
  array_length(digipin_cells, 1) as cell_count,
  digipin_cells[1] as first_cell,
  substring(digipin_cells[1] from 1 for 2) as regional_prefix
FROM pincodes
WHERE digipin_cells IS NOT NULL 
  AND digipin_cells != '{}'
  AND boundary IS NOT NULL
ORDER BY random()
LIMIT 10;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '8️⃣  TEST: Regional Prefix Consistency'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo 'Count unique regional prefixes by state (top 10):'
WITH prefix_counts AS (
  SELECT 
    state,
    substring(unnest(digipin_cells) from 1 for 2) as prefix
  FROM pincodes
  WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
)
SELECT 
  state,
  COUNT(DISTINCT prefix) as unique_prefixes,
  array_agg(DISTINCT prefix ORDER BY prefix) as prefixes
FROM prefix_counts
GROUP BY state
ORDER BY unique_prefixes DESC
LIMIT 10;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '9️⃣  TEST: Performance Benchmark'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\timing on

\echo 'Warmup queries:'
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'] LIMIT 1;
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'] LIMIT 1;

\echo ''
\echo 'Benchmark: 5 queries with @> operator:'
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'];
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['MC8T2L'];
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['4TK62F'];
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['CP55PC'];
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['23K9K7'];

\timing off

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔟  TEST: Edge Cases'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo 'Pincode with most cells:'
SELECT 
  pincode,
  office_name,
  state,
  array_length(digipin_cells, 1) as cell_count
FROM pincodes
WHERE digipin_cells IS NOT NULL
ORDER BY array_length(digipin_cells, 1) DESC
LIMIT 3;

\echo ''
\echo 'Pincode with fewest cells:'
SELECT 
  pincode,
  office_name,
  state,
  array_length(digipin_cells, 1) as cell_count
FROM pincodes
WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'
ORDER BY array_length(digipin_cells, 1) ASC
LIMIT 3;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Testing Complete!'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Summary:'
\echo '  ✓ Population status verified'
\echo '  ✓ GIN index confirmed'
\echo '  ✓ Statistics updated'
\echo '  ✓ Delhi test case validated'
\echo '  ✓ Index usage verified'
\echo '  ✓ Performance benchmarked'
\echo '  ✓ Edge cases tested'
\echo ''
