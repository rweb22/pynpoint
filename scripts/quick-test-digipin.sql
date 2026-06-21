-- Quick DIGIPIN Testing (Run after population completes)

-- 1. Check population status
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE digipin_cells != '{}') as populated,
  ROUND((COUNT(*) FILTER (WHERE digipin_cells != '{}')::NUMERIC / COUNT(*) * 100)::NUMERIC, 2) as percent
FROM pincodes WHERE boundary IS NOT NULL;

-- 2. Update statistics (CRITICAL!)
ANALYZE pincodes;

-- 3. Test Delhi case (should use index and return in <1ms)
EXPLAIN ANALYZE
SELECT pincode, office_name 
FROM pincodes 
WHERE digipin_cells @> ARRAY['39J438'];

-- 4. Verify it's using Bitmap Index Scan (not Seq Scan)
-- Look for: "Bitmap Index Scan on idx_pincodes_digipin_cells_gin"
