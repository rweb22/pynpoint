-- Debug: Test the exact query being used in processPincode()
-- Let's see what's actually being returned

-- Test 1: Check a single pincode without any filters
SELECT 
    pincode,
    boundary IS NOT NULL as has_boundary,
    ST_IsValid(boundary::geometry) as is_valid,
    ST_NPoints(boundary::geometry) as num_points,
    ST_GeometryType(boundary::geometry) as geom_type
FROM pincodes
WHERE pincode = '110001'
  AND boundary IS NOT NULL;

-- Test 2: Try to run the actual h3_polygon_to_cells query for one pincode
SELECT h3_polygon_to_cells(
  ST_MakePolygon(ST_ExteriorRing(boundary::geometry))::polygon,
  ARRAY[]::polygon[],
  9::int
)::text as h3_index
FROM pincodes
WHERE pincode = '110001'
  AND boundary IS NOT NULL;

-- Test 3: Same query but WITH the validation filters
SELECT h3_polygon_to_cells(
  ST_MakePolygon(ST_ExteriorRing(boundary::geometry))::polygon,
  ARRAY[]::polygon[],
  9::int
)::text as h3_index
FROM pincodes
WHERE pincode = '110001'
  AND boundary IS NOT NULL
  AND ST_IsValid(boundary::geometry) = true
  AND ST_NPoints(boundary::geometry) >= 4;

-- Test 4: Count how many pincodes pass each filter
SELECT 
    COUNT(*) as total_pincodes,
    COUNT(CASE WHEN boundary IS NOT NULL THEN 1 END) as has_boundary,
    COUNT(CASE WHEN boundary IS NOT NULL AND ST_IsValid(boundary::geometry) THEN 1 END) as valid_geometry,
    COUNT(CASE WHEN boundary IS NOT NULL AND ST_NPoints(boundary::geometry) >= 4 THEN 1 END) as enough_points,
    COUNT(CASE WHEN boundary IS NOT NULL AND ST_IsValid(boundary::geometry) AND ST_NPoints(boundary::geometry) >= 4 THEN 1 END) as passes_all_filters
FROM pincodes;

-- Test 5: Check a few pincodes that are failing
SELECT 
    pincode,
    ST_GeometryType(boundary::geometry) as geom_type,
    ST_IsValid(boundary::geometry) as is_valid,
    ST_NPoints(boundary::geometry) as num_points,
    CASE 
        WHEN NOT ST_IsValid(boundary::geometry) THEN 'Invalid geometry'
        WHEN ST_NPoints(boundary::geometry) < 4 THEN 'Too few points'
        ELSE 'OK'
    END as issue
FROM pincodes
WHERE boundary IS NOT NULL
LIMIT 10;
