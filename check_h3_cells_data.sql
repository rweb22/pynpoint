-- Check what's actually stored in h3_cells
SELECT 
    pincode,
    h3_cells,
    pg_typeof(h3_cells) as type,
    array_length(h3_cells, 1) as array_length,
    h3_cells[1] as first_element,
    h3_cells[2] as second_element
FROM pincodes
WHERE h3_cells IS NOT NULL 
  AND array_length(h3_cells, 1) > 0
LIMIT 5;
