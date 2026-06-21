-- Fix GIN index usage by adjusting cost parameters for SSD storage

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔧 Fixing GIN Index Cost Parameters'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '1️⃣  Current cost settings (BEFORE):'
SELECT name, setting, unit, short_desc 
FROM pg_settings 
WHERE name IN ('random_page_cost', 'seq_page_cost');

\echo ''
\echo '2️⃣  Test query BEFORE adjustment:'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔧 Applying Fix: Setting random_page_cost = 1.1 (SSD optimized)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Set random_page_cost to 1.1 (optimal for SSDs)
-- This tells PostgreSQL that random I/O is only slightly more expensive than sequential
ALTER DATABASE railway SET random_page_cost = 1.1;

\echo 'Applied: random_page_cost = 1.1'
\echo ''
\echo '⚠️  You need to reconnect for this to take effect!'
\echo ''
\echo 'To apply immediately for this session, run:'
\echo '  SET random_page_cost = 1.1;'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

-- Apply for current session
SET random_page_cost = 1.1;

\echo '3️⃣  Test query AFTER adjustment (same session):'
EXPLAIN (ANALYZE, BUFFERS)
SELECT pincode, office_name, state
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ Fix Applied!'
\echo ''
\echo 'Summary:'
\echo '  • random_page_cost changed from 4 → 1.1'
\echo '  • This is optimal for SSD storage (Railway uses SSDs)'
\echo '  • PostgreSQL will now prefer index scans for selective queries'
\echo ''
\echo 'Why this matters:'
\echo '  • Old setting: "Random access is 4x slower than sequential"'
\echo '  • New setting: "Random access is 1.1x slower than sequential"'
\echo '  • Reality: On SSDs, random access is nearly as fast as sequential'
\echo ''
\echo 'Expected behavior:'
\echo '  • GIN index should now be used for DIGIPIN lookups'
\echo '  • Query time should drop from ~280ms to ~2-10ms'
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
