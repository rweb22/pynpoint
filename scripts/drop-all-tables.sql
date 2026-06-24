-- Drop All Tables and Functions - Clean Slate
-- WARNING: This will delete ALL data in the database
-- Use this to test consolidated migrations on existing database

-- Drop triggers first (prevent errors)
DROP TRIGGER IF EXISTS update_api_usage_updated_at ON api_usage;
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
DROP TRIGGER IF EXISTS update_postoffices_updated_at ON postoffices;
DROP TRIGGER IF EXISTS update_pincodes_updated_at ON pincodes;

-- Drop tables (indexes drop automatically)
DROP TABLE IF EXISTS api_usage CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS postoffices CASCADE;
DROP TABLE IF EXISTS pincodes CASCADE;

-- Drop DIGIPIN functions
DROP FUNCTION IF EXISTS polygon_to_digipin_cells_level6(GEOGRAPHY, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS polygon_to_digipin_cells_level6(GEOMETRY, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS encode_digipin_level6(DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS digipin_update_box CASCADE;
DROP FUNCTION IF EXISTS digipin_grid_char(INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS digipin_calc_indices CASCADE;

-- Drop trigger function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Clear TypeORM migrations table (force re-run)
DELETE FROM migrations;

-- Verify cleanup
SELECT 
  'Tables' as type, 
  COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name NOT IN ('migrations', 'spatial_ref_sys');

SELECT 
  'Functions' as type, 
  COUNT(*) as count 
FROM pg_proc 
WHERE proname LIKE '%digipin%' 
  OR proname = 'update_updated_at_column';

-- Expected output: 0 tables, 0 functions
-- PostGIS and migrations table will remain (safe)
