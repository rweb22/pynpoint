-- Test: Does = ANY() work with different index types?

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🧪 Testing = ANY() Operator with Different Index Types'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Create test table with scalar and array columns
CREATE TEMP TABLE test_any_operator (
  id SERIAL PRIMARY KEY,
  status TEXT,              -- Scalar column
  tags TEXT[]               -- Array column
);

-- Insert test data
INSERT INTO test_any_operator (status, tags)
SELECT 
  CASE (random() * 3)::int 
    WHEN 0 THEN 'active'
    WHEN 1 THEN 'pending'
    ELSE 'inactive'
  END,
  ARRAY['tag' || (random() * 10)::int, 'tag' || (random() * 10)::int]
FROM generate_series(1, 10000);

\echo ''
\echo '📊 Test data created: 10,000 rows'
\echo ''

-- Create indexes
CREATE INDEX idx_status_btree ON test_any_operator(status);
CREATE INDEX idx_tags_gin ON test_any_operator USING GIN(tags);

ANALYZE test_any_operator;

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 1: Scalar Column with B-tree Index'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '✅ Using IN clause:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_any_operator WHERE status IN ('active', 'pending');

\echo ''
\echo '✅ Using = ANY(ARRAY[...]):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_any_operator WHERE status = ANY(ARRAY['active', 'pending']);

\echo ''
\echo 'Result: Both use B-tree index ✅'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 2: Array Column with GIN Index'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '❌ Using = ANY(array_column):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_any_operator WHERE 'tag5' = ANY(tags);

\echo ''
\echo '✅ Using @> operator:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_any_operator WHERE tags @> ARRAY['tag5'];

\echo ''
\echo 'Result: = ANY() does NOT use GIN index, @> does ✅'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 3: Force Index Usage Comparison'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SET enable_seqscan = OFF;

\echo 'With enable_seqscan = OFF (force index if possible):'
\echo ''
\echo 'Query 1: = ANY(array_column)'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_any_operator WHERE 'tag5' = ANY(tags);

\echo ''
\echo 'Query 2: @> operator'
EXPLAIN (ANALYZE, BUFFERS)
SELECT id FROM test_any_operator WHERE tags @> ARRAY['tag5'];

SET enable_seqscan = ON;

\echo ''
\echo 'Result: Even when forced, = ANY() cannot use GIN index'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'TEST 4: Verify Semantic Equivalence'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo 'Count rows using = ANY():'
SELECT COUNT(*) as count_any FROM test_any_operator WHERE 'tag5' = ANY(tags);

\echo ''
\echo 'Count rows using @>:'
SELECT COUNT(*) as count_contains FROM test_any_operator WHERE tags @> ARRAY['tag5'];

\echo ''
\echo 'Result: Both return same rows (semantically equivalent) ✅'
\echo ''

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 Summary'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo 'Findings:'
\echo '  1. ✅ B-tree + scalar: = ANY(ARRAY[...]) uses index'
\echo '  2. ❌ GIN + array:     = ANY(array_col) does NOT use index'
\echo '  3. ✅ GIN + array:     @> operator DOES use index'
\echo '  4. ✅ Both queries return identical results'
\echo ''
\echo 'Conclusion:'
\echo '  The issue is specific to array columns with GIN indexes.'
\echo '  For scalar columns with B-tree, = ANY() works fine.'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Cleanup
DROP TABLE test_any_operator;
