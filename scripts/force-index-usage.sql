-- Force PostgreSQL to reconsider the query plan

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 Investigating Why Index Is Not Being Used'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '1️⃣  Clear cached plans and set cost parameters:'
DISCARD PLANS;
SET random_page_cost = 1.1;
SET enable_seqscan = ON;

\echo ''
\echo '2️⃣  Check index validity:'
SELECT 
  i.indexrelid::regclass as index_name,
  i.indisvalid as is_valid,
  i.indisready as is_ready,
  pg_size_pretty(pg_relation_size(i.indexrelid)) as index_size,
  i.indnatts as num_columns
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname = 'idx_pincodes_digipin_cells_gin';

\echo ''
\echo '3️⃣  Check actual selectivity of the query:'
SELECT 
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE '39J438' = ANY(digipin_cells)) as matching_rows,
  ROUND((COUNT(*) FILTER (WHERE '39J438' = ANY(digipin_cells))::numeric / COUNT(*) * 100), 4) as selectivity_percent
FROM pincodes;

\echo ''
\echo '4️⃣  Test with fresh plan (added OFFSET 0 to prevent plan caching):'
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, COSTS, SETTINGS)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells)
OFFSET 0;

\echo ''
\echo '5️⃣  Force index usage to see what cost PostgreSQL estimates:'
SET enable_seqscan = OFF;
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, COSTS)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);
SET enable_seqscan = ON;

\echo ''
\echo '6️⃣  Check if the GIN index has correct operator class:'
SELECT 
  am.amname as index_method,
  opc.opcname as operator_class,
  opc.opcdefault as is_default
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_am am ON am.oid = c.relam
JOIN pg_opclass opc ON opc.oid = i.indclass[0]
WHERE c.relname = 'idx_pincodes_digipin_cells_gin';

\echo ''
\echo '7️⃣  Try with array overlap operator instead of ANY:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pincode, office_name, state
FROM pincodes
WHERE digipin_cells @> ARRAY['39J438']::text[];

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 Analysis Complete'
\echo ''
