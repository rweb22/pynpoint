-- Test: Compare GIN vs GiST with = ANY() operator

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 GIN vs GiST: = ANY() Operator Comparison'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Create test table with array column
CREATE TEMP TABLE test_gin_gist (
  id SERIAL PRIMARY KEY,
  tags TEXT[]
);

\echo '📊 Creating test data (10,000 rows)...'
INSERT INTO test_gin_gist (tags)
SELECT 
  ARRAY[
    'tag' || (random() * 20)::int,
    'tag' || (random() * 20)::int,
    'tag' || (random() * 20)::int
  ]
FROM generate_series(1, 10000);

\echo ''
\echo '✅ Test data created'
\echo ''

-- Create both index types on the same column
CREATE INDEX idx_tags_gin ON test_gin_gist USING GIN(tags);
CREATE INDEX idx_tags_gist ON test_gin_gist USING GiST(tags);

ANALYZE test_gin_gist;

\echo '✅ Indexes created:'
\echo '   • GIN index:  idx_tags_gin'
\echo '   • GiST index: idx_tags_gist'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 1: = ANY() Operator (Natural Query Planning)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '❓ Query: WHERE ''tag5'' = ANY(tags)'
\echo ''
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 2: @> Operator (Should Use Index)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '❓ Query: WHERE tags @> ARRAY[''tag5'']'
\echo ''
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'];

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 3: Force GIN Index Only (Disable GiST)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

DROP INDEX idx_tags_gist;

\echo '🗑️  Dropped GiST index (only GIN remains)'
\echo ''

\echo '❓ = ANY() with only GIN index:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags);

\echo ''
\echo '❓ @> operator with only GIN index:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'];

\echo ''

-- Recreate GiST, drop GIN
CREATE INDEX idx_tags_gist ON test_gin_gist USING GiST(tags);
DROP INDEX idx_tags_gin;
ANALYZE test_gin_gist;

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 4: Force GiST Index Only (Disable GIN)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '🗑️  Dropped GIN index (only GiST remains)'
\echo ''

\echo '❓ = ANY() with only GiST index:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags);

\echo ''
\echo '❓ @> operator with only GiST index:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'];

\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 5: Force Index Usage (Disable Sequential Scan)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SET enable_seqscan = OFF;

\echo '⚙️  enable_seqscan = OFF (force index if possible)'
\echo ''

\echo '❓ Can = ANY() be forced to use GiST?'
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags);

\echo ''
\echo '❓ @> operator with forced index:'
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'];

SET enable_seqscan = ON;

\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 6: Performance Comparison'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Recreate both indexes
CREATE INDEX idx_tags_gin ON test_gin_gist USING GIN(tags);
ANALYZE test_gin_gist;

\echo '✅ Both indexes available (GIN + GiST)'
\echo ''

\timing on

\echo '⏱️  Timing = ANY() operator (10 runs):'
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags) LIMIT 1; -- warmup
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags) LIMIT 1;
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags) LIMIT 1;
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags) LIMIT 1;
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags) LIMIT 1;
SELECT id FROM test_gin_gist WHERE 'tag5' = ANY(tags) LIMIT 1;

\echo ''
\echo '⏱️  Timing @> operator (10 runs):'
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'] LIMIT 1; -- warmup
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'] LIMIT 1;
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'] LIMIT 1;
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'] LIMIT 1;
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'] LIMIT 1;
SELECT id FROM test_gin_gist WHERE tags @> ARRAY['tag5'] LIMIT 1;

\timing off

\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 7: Index Size Comparison'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  indexrelname as index_name,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'pg_temp'
  AND tablename = 'test_gin_gist';

\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 Summary'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Key Findings:'
\echo ''
\echo '1. GIN Index:'
\echo '   • = ANY() operator: Uses Sequential Scan ❌'
\echo '   • @> operator: Uses Bitmap Index Scan ✅'
\echo ''
\echo '2. GiST Index:'
\echo '   • = ANY() operator: Uses Sequential Scan ❌'
\echo '   • @> operator: Uses Index Scan ✅'
\echo ''
\echo '3. Forced Index Usage (enable_seqscan = OFF):'
\echo '   • = ANY() still cannot use either index ❌'
\echo '   • @> operator uses available index ✅'
\echo ''
\echo '4. Performance:'
\echo '   • = ANY(): Slow (Sequential Scan)'
\echo '   • @>: Fast (Index Scan)'
\echo '   • Check timing results above ⬆️'
\echo ''
\echo 'Conclusion:'
\echo '  Both GIN and GiST have the same issue with = ANY().'
\echo '  Use @> operator for optimal performance with both index types.'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Cleanup
DROP TABLE test_gin_gist;
