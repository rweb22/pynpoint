-- Populate DIGIPIN cells for all pincodes
-- This is a separate script to avoid timeout during migrations
-- Run this AFTER the migration has added the digipin_cells column

-- Safety check: Ensure functions exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'polygon_to_digipin_cells_level6'
  ) THEN
    RAISE EXCEPTION 'DIGIPIN functions not found. Run migrations first!';
  END IF;
END $$;

-- Show progress
\echo ''
\echo '🚀 Starting DIGIPIN cell population...'
\echo ''

-- Check how many are already done
DO $$
DECLARE
  total_count INTEGER;
  completed_count INTEGER;
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM pincodes WHERE boundary IS NOT NULL;
  SELECT COUNT(*) INTO completed_count FROM pincodes
    WHERE boundary IS NOT NULL
      AND digipin_cells IS NOT NULL
      AND digipin_cells != '{}';
  remaining_count := total_count - completed_count;

  RAISE NOTICE 'Total pincodes: %', total_count;
  RAISE NOTICE 'Already completed: %', completed_count;
  RAISE NOTICE 'Remaining: %', remaining_count;

  IF remaining_count = 0 THEN
    RAISE NOTICE '✅ All pincodes already have DIGIPIN cells!';
  ELSE
    RAISE NOTICE 'Estimated time: % hours (at ~50 pincodes/min)',
      ROUND((remaining_count::NUMERIC / 50 / 60)::NUMERIC, 1);
  END IF;
END $$;

\echo ''
\echo 'Grid spacing: 200m (for performance)'
\echo ''

-- Create a progress tracking table
CREATE TEMP TABLE digipin_progress (
  batch_num INTEGER,
  pincodes_processed INTEGER,
  cells_generated INTEGER,
  avg_cells_per_pincode NUMERIC,
  batch_duration_seconds NUMERIC,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Process in batches with explicit COMMIT after each batch
-- We CANNOT use DO $$ blocks because they prevent commits

\echo ''
\echo 'Starting batch processing with auto-commit...'
\echo 'Press Ctrl+C to safely interrupt - progress is saved after each batch'
\echo ''

-- Helper function to process one batch and return count
CREATE OR REPLACE FUNCTION process_digipin_batch() RETURNS INTEGER AS $$
DECLARE
  processed INTEGER;
BEGIN
  WITH batch AS (
    SELECT pincode, boundary
    FROM pincodes
    WHERE boundary IS NOT NULL
      AND (digipin_cells IS NULL OR digipin_cells = '{}')
    ORDER BY pincode  -- Deterministic ordering for resume
    LIMIT 100
  )
  UPDATE pincodes p
  SET digipin_cells = polygon_to_digipin_cells_level6(b.boundary, 200.0)
  FROM batch b
  WHERE p.pincode = b.pincode;

  GET DIAGNOSTICS processed = ROW_COUNT;
  RETURN processed;
END;
$$ LANGUAGE plpgsql;

-- Process batches using psql \gexec to allow commits
-- This is a workaround since we can't use DO blocks

\echo 'Processing batches...'

-- We'll use a simple approach: generate and execute statements
WITH RECURSIVE batch_loop AS (
  -- Base case: batch 1
  SELECT
    1 as batch_num,
    (SELECT COUNT(*) FROM pincodes WHERE boundary IS NOT NULL AND (digipin_cells IS NULL OR digipin_cells = '{}')) as remaining

  UNION ALL

  -- Recursive case: continue while there are unpopulated pincodes
  SELECT
    batch_num + 1,
    (SELECT COUNT(*) FROM pincodes WHERE boundary IS NOT NULL AND (digipin_cells IS NULL OR digipin_cells = '{}'))
  FROM batch_loop
  WHERE remaining > 0 AND batch_num < 200  -- Max 200 batches (20,000 pincodes)
)
SELECT
  format(
    E'\\echo ''🔄 Batch %s/%s (remaining: %s)'';\n' ||
    'SELECT process_digipin_batch();\n' ||
    'COMMIT;',
    batch_num,
    (SELECT CEIL(COUNT(*)::NUMERIC / 100) FROM pincodes WHERE boundary IS NOT NULL),
    remaining
  ) as command
FROM batch_loop
\gexec

-- Show final statistics
\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 DIGIPIN Population Summary'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  COUNT(*) AS total_pincodes,
  COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') AS pincodes_with_cells,
  COUNT(*) FILTER (WHERE digipin_cells IS NULL OR digipin_cells = '{}') AS pincodes_without_cells,
  SUM(cardinality(digipin_cells)) AS total_cells,
  ROUND(AVG(cardinality(digipin_cells))::numeric, 2) AS avg_cells_per_pincode,
  MAX(cardinality(digipin_cells)) AS max_cells_in_pincode
FROM pincodes;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '⏱️  Batch Performance'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

SELECT 
  batch_num,
  pincodes_processed,
  cells_generated,
  ROUND(avg_cells_per_pincode, 2) AS avg_cells,
  ROUND(batch_duration_seconds, 2) AS seconds
FROM digipin_progress
ORDER BY batch_num DESC
LIMIT 10;

\echo ''
\echo '✅ DIGIPIN cell population complete!'
\echo ''
