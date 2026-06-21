-- Debug why GIN index isn't being used at 88% population

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 Debugging GIN Index Usage'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '1️⃣  Check if index exists and is valid:'
SELECT 
  indexname,
  indexdef,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE tablename = 'pincodes' 
  AND indexname = 'idx_pincodes_digipin_cells_gin';

\echo ''
\echo '2️⃣  Check actual data distribution:'
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE digipin_cells IS NULL) as null_arrays,
  COUNT(*) FILTER (WHERE digipin_cells = '{}') as empty_arrays,
  COUNT(*) FILTER (WHERE array_length(digipin_cells, 1) > 0) as populated_arrays,
  AVG(array_length(digipin_cells, 1)) FILTER (WHERE array_length(digipin_cells, 1) > 0) as avg_cells_per_pincode,
  MAX(array_length(digipin_cells, 1)) as max_cells
FROM pincodes
WHERE boundary IS NOT NULL;

\echo ''
\echo '3️⃣  Test query with EXPLAIN (current behavior):'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '4️⃣  Force GIN index usage and compare:'
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);
SET enable_seqscan = on;

\echo ''
\echo '5️⃣  Check if statistics are stale:'
SELECT 
  schemaname,
  tablename,
  last_analyze,
  last_autoanalyze,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
WHERE tablename = 'pincodes';

\echo ''
\echo '6️⃣  Update statistics and retest:'
ANALYZE pincodes;

\echo ''
\echo '7️⃣  After ANALYZE - test again:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '8️⃣  Check planner cost estimates:'
SELECT name, setting, unit, short_desc 
FROM pg_settings 
WHERE name IN (
  'random_page_cost',
  'seq_page_cost',
  'cpu_tuple_cost',
  'cpu_index_tuple_cost',
  'cpu_operator_cost',
  'effective_cache_size'
);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Debug Complete'
\echo ''
\echo 'Key things to check:'
\echo '  • Are statistics up to date? (last_analyze should be recent)'
\echo '  • What is the actual cost difference between Seq Scan and Index Scan?'
\echo '  • After ANALYZE, does it switch to using the index?'
\echo ''
