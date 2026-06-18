-- Check h3_cells column type and data
SELECT 
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'pincodes' 
  AND column_name = 'h3_cells';

-- Check if any data exists in h3_cells
SELECT 
    COUNT(*) as total_pincodes,
    COUNT(h3_cells) as pincodes_with_h3_cells,
    COUNT(CASE WHEN array_length(h3_cells, 1) > 0 THEN 1 END) as pincodes_with_nonempty_h3_cells,
    SUM(array_length(h3_cells, 1)) as total_h3_cells
FROM pincodes;

-- Sample a few pincodes to see what h3_cells looks like
SELECT 
    pincode,
    boundary IS NOT NULL as has_boundary,
    h3_cells,
    array_length(h3_cells, 1) as num_h3_cells,
    pg_typeof(h3_cells) as type
FROM pincodes
WHERE h3_cells IS NOT NULL 
  AND array_length(h3_cells, 1) > 0
LIMIT 3;

-- Check for pincodes with boundaries but no h3_cells
SELECT 
    COUNT(*) as pincodes_with_boundary_but_no_h3_cells
FROM pincodes
WHERE boundary IS NOT NULL 
  AND (h3_cells IS NULL OR array_length(h3_cells, 1) IS NULL OR array_length(h3_cells, 1) = 0);

-- Check the specific problematic pincode 531060
SELECT 
    pincode,
    boundary IS NOT NULL as has_boundary,
    ST_IsValid(boundary::geometry) as boundary_is_valid,
    ST_GeometryType(boundary::geometry) as boundary_type,
    h3_cells,
    array_length(h3_cells, 1) as num_h3_cells
FROM pincodes
WHERE pincode = '531060';
