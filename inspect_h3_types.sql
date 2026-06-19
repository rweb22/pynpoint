-- Get all H3 function signatures
\df h3*

-- Check what h3index type is
SELECT typname, typtype, typelem, typlen 
FROM pg_type 
WHERE typname = 'h3index';

-- Check if there's a custom unnest for h3index
\df unnest

-- See what h3_polygon_to_cells actually returns
SELECT 
    p.proname as function_name,
    pg_catalog.pg_get_function_arguments(p.oid) as arguments,
    pg_catalog.pg_get_function_result(p.oid) as return_type,
    t.typname as return_type_name
FROM pg_catalog.pg_proc p
    LEFT JOIN pg_catalog.pg_type t ON t.oid = p.prorettype
WHERE p.proname = 'h3_polygon_to_cells';

-- Test the actual query to see what it returns
SELECT h3_polygon_to_cells(
    ST_MakePolygon(ST_ExteriorRing(boundary::geometry))::polygon,
    ARRAY[]::polygon[],
    9
) as cells
FROM pincodes
WHERE pincode = '110001'
LIMIT 1;
