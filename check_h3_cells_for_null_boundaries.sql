-- Check h3_cells column for all pincodes without boundaries

-- Count what's in h3_cells for pincodes without boundaries
SELECT 
    COUNT(*) as total_without_boundary,
    COUNT(CASE WHEN h3_cells IS NULL THEN 1 END) as h3_cells_is_null,
    COUNT(CASE WHEN h3_cells = '{}' THEN 1 END) as h3_cells_empty_array,
    COUNT(CASE WHEN h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0 THEN 1 END) as h3_cells_has_data,
    SUM(array_length(h3_cells, 1)) as total_h3_cells
FROM pincodes
WHERE boundary IS NULL;

-- Sample the actual values
\echo ''
\echo 'Sample h3_cells values for pincodes without boundaries:'
SELECT 
    pincode,
    h3_cells,
    array_length(h3_cells, 1) as array_length,
    h3_cells IS NULL as is_null,
    h3_cells = '{}' as is_empty_array
FROM pincodes
WHERE boundary IS NULL
LIMIT 20;

-- Check specific pincodes that should have been processed already
\echo ''
\echo 'Check pincodes without boundaries that should have been processed (ID < 18000):'
SELECT 
    id,
    pincode,
    h3_cells,
    array_length(h3_cells, 1) as array_length
FROM pincodes
WHERE boundary IS NULL
  AND id <= 18000
ORDER BY id;
