-- Reset h3_cells column to empty arrays so the rebuild will recompute everything

-- Before reset: Check current state
SELECT 
    COUNT(*) as total_pincodes,
    COUNT(CASE WHEN h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0 THEN 1 END) as pincodes_with_h3_cells,
    SUM(array_length(h3_cells, 1)) as total_h3_cells_stored
FROM pincodes;

-- Reset all h3_cells to empty array
UPDATE pincodes
SET h3_cells = '{}';

-- After reset: Verify all are empty
SELECT 
    COUNT(*) as total_pincodes,
    COUNT(CASE WHEN h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0 THEN 1 END) as pincodes_with_h3_cells,
    SUM(array_length(h3_cells, 1)) as total_h3_cells_stored
FROM pincodes;

\echo 'Successfully reset all h3_cells to empty arrays'
