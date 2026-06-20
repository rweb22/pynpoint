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
\echo 'Total pincodes: 19,312'
\echo 'Estimated time: 2-4 hours'
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

-- Process in batches of 100 pincodes
DO $$
DECLARE
  batch_size CONSTANT INTEGER := 100;
  total_pincodes INTEGER;
  processed INTEGER := 0;
  batch_num INTEGER := 0;
  batch_start TIMESTAMP;
  batch_cells INTEGER;
  v_pincode TEXT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO total_pincodes FROM pincodes WHERE boundary IS NOT NULL;
  
  RAISE NOTICE 'Processing % pincodes in batches of %', total_pincodes, batch_size;
  
  -- Process each batch
  FOR batch_num IN 1..CEIL(total_pincodes::NUMERIC / batch_size) LOOP
    batch_start := clock_timestamp();
    
    -- Update batch
    WITH batch AS (
      SELECT pincode, boundary
      FROM pincodes
      WHERE boundary IS NOT NULL
        AND (digipin_cells IS NULL OR digipin_cells = '{}')
      LIMIT batch_size
    )
    UPDATE pincodes p
    SET digipin_cells = polygon_to_digipin_cells_level6(b.boundary, 200.0)
    FROM batch b
    WHERE p.pincode = b.pincode;
    
    GET DIAGNOSTICS processed = ROW_COUNT;
    
    -- Calculate cells in this batch
    SELECT COALESCE(SUM(cardinality(digipin_cells)), 0)
    INTO batch_cells
    FROM pincodes
    WHERE digipin_cells IS NOT NULL 
      AND digipin_cells != '{}';
    
    -- Log progress
    INSERT INTO digipin_progress (
      batch_num,
      pincodes_processed,
      cells_generated,
      avg_cells_per_pincode,
      batch_duration_seconds
    ) VALUES (
      batch_num,
      processed,
      batch_cells,
      CASE WHEN batch_num * batch_size > 0 
        THEN batch_cells::NUMERIC / (batch_num * batch_size)
        ELSE 0
      END,
      EXTRACT(EPOCH FROM (clock_timestamp() - batch_start))
    );
    
    -- Show progress every 10 batches
    IF batch_num % 10 = 0 THEN
      RAISE NOTICE 'Batch % complete. Processed ~% pincodes so far...', 
        batch_num, batch_num * batch_size;
    END IF;
    
    -- Exit if no more rows to process
    EXIT WHEN processed = 0;
  END LOOP;
  
  RAISE NOTICE 'Population complete!';
END $$;

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
