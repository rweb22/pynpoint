-- Verify GIN Index is Working

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 GIN Index Verification'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '1️⃣  Check if GIN index exists:'
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'pincodes' 
  AND indexname = 'idx_pincodes_digipin_cells_gin';

\echo ''
\echo '2️⃣  Check index size and usage stats:'
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexrelname = 'idx_pincodes_digipin_cells_gin';

\echo ''
\echo '3️⃣  Test query on a populated pincode (110001):'
EXPLAIN ANALYZE
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '4️⃣  Why might Sequential Scan be used instead of Index Scan?'
\echo ''
\echo 'Possible reasons:'
\echo '  • Most digipin_cells are empty {} - Seq Scan is faster for mostly empty data'
\echo '  • Query planner estimates Seq Scan is cheaper (check after population)'
\echo '  • Index statistics need updating (run ANALYZE)'
\echo ''
\echo 'Run ANALYZE to update statistics:'
ANALYZE pincodes;

\echo ''
\echo '5️⃣  After ANALYZE, test again:'
EXPLAIN ANALYZE
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '6️⃣  Force index usage (for testing):'
SET enable_seqscan = off;
EXPLAIN ANALYZE
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);
SET enable_seqscan = on;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '7️⃣  Check population progress:'
SELECT 
  COUNT(*) as total_pincodes,
  COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') as populated,
  COUNT(*) FILTER (WHERE digipin_cells = '{}') as empty,
  ROUND((COUNT(*) FILTER (WHERE digipin_cells != '{}')::NUMERIC / COUNT(*) * 100)::NUMERIC, 1) as percent_populated
FROM pincodes
WHERE boundary IS NOT NULL;

\echo ''
\echo '📝 Notes:'
\echo '  • GIN index will be used when selectivity is good (few matching rows)'
\echo '  • Sequential Scan is used when many rows match or data is mostly empty'
\echo '  • After population completes (100%), index should be used'
\echo '  • Current progress shown above'
\echo ''
\echo '✅ Verification Complete'
\echo ''
