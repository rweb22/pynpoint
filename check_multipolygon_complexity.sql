-- Check how many pincodes have complex MultiPolygon geometries

-- Test 1: Count pincodes with multiple polygons in MultiPolygon
SELECT 
    COUNT(*) as total_with_boundaries,
    COUNT(CASE WHEN ST_NumGeometries(boundary::geometry) > 1 THEN 1 END) as has_multiple_polygons,
    COUNT(CASE WHEN ST_NumGeometries(boundary::geometry) > 1 THEN 1 END) * 100.0 / COUNT(*) as pct_multiple_polygons
FROM pincodes
WHERE boundary IS NOT NULL;

-- Test 2: Check for interior rings (holes)
SELECT 
    COUNT(*) as total_with_boundaries,
    COUNT(CASE WHEN ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0 THEN 1 END) as has_holes,
    COUNT(CASE WHEN ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0 THEN 1 END) * 100.0 / COUNT(*) as pct_with_holes
FROM pincodes
WHERE boundary IS NOT NULL;

-- Test 3: Sample pincodes with complex geometries
SELECT 
    pincode,
    ST_NumGeometries(boundary::geometry) as num_polygons,
    ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) as num_holes_in_first_polygon,
    CASE 
        WHEN ST_NumGeometries(boundary::geometry) > 1 THEN 'Multiple disconnected regions'
        WHEN ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0 THEN 'Has holes/enclaves'
        ELSE 'Simple polygon'
    END as complexity
FROM pincodes
WHERE boundary IS NOT NULL
  AND (
    ST_NumGeometries(boundary::geometry) > 1 
    OR ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0
  )
LIMIT 10;

-- Test 4: Distribution of complexity
SELECT 
    CASE 
        WHEN ST_NumGeometries(boundary::geometry) > 1 AND ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0 
            THEN 'Both: Multiple polygons + holes'
        WHEN ST_NumGeometries(boundary::geometry) > 1 
            THEN 'Multiple disconnected polygons'
        WHEN ST_NumInteriorRings(ST_GeometryN(boundary::geometry, 1)) > 0 
            THEN 'Single polygon with holes'
        ELSE 'Simple: Single polygon, no holes'
    END as geometry_type,
    COUNT(*) as count,
    COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM pincodes
WHERE boundary IS NOT NULL
GROUP BY geometry_type
ORDER BY count DESC;
