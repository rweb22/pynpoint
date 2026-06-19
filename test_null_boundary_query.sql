-- Test what the complex CTE query returns for a pincode without boundary

-- Test 1: Pincode with no boundary (141013)
\echo 'Test 1: Pincode 141013 (no boundary)'
SELECT pincode, boundary IS NULL as boundary_is_null
FROM pincodes
WHERE pincode = '141013';

-- Test 2: What does the complex query return?
\echo ''
\echo 'Test 2: Complex query result for pincode without boundary'
WITH boundary_info AS (
  SELECT 
    boundary::geometry as geom,
    ST_NumGeometries(boundary::geometry) as num_geoms
  FROM pincodes
  WHERE pincode = '141013'
    AND boundary IS NOT NULL
    AND ST_IsValid(boundary::geometry) = true
),
all_polygons AS (
  SELECT 
    generate_series(1, num_geoms) as geom_idx,
    geom
  FROM boundary_info
),
polygon_rings AS (
  SELECT 
    geom_idx,
    ST_GeometryN(geom, geom_idx) as polygon,
    ST_ExteriorRing(ST_GeometryN(geom, geom_idx)) as exterior_ring,
    ST_NumInteriorRings(ST_GeometryN(geom, geom_idx)) as num_holes
  FROM all_polygons
),
polygon_with_holes AS (
  SELECT 
    pr.geom_idx,
    pr.exterior_ring,
    CASE 
      WHEN pr.num_holes > 0 THEN
        ARRAY(
          SELECT ST_MakePolygon(ST_InteriorRingN(pr.polygon, generate_series(1, pr.num_holes)))::polygon
        )
      ELSE
        ARRAY[]::polygon[]
    END as holes
  FROM polygon_rings pr
)
SELECT COUNT(*) as result_count
FROM (
  SELECT DISTINCT h3_polygon_to_cells(
    ST_MakePolygon(exterior_ring)::polygon,
    holes,
    9::int
  )::text as h3_index
  FROM polygon_with_holes
) as cells;

-- Test 3: Check boundary_info CTE for null boundary
\echo ''
\echo 'Test 3: Check if boundary_info CTE returns any rows for null boundary'
WITH boundary_info AS (
  SELECT 
    boundary::geometry as geom,
    ST_NumGeometries(boundary::geometry) as num_geoms
  FROM pincodes
  WHERE pincode = '141013'
    AND boundary IS NOT NULL
    AND ST_IsValid(boundary::geometry) = true
)
SELECT COUNT(*) as boundary_info_rows
FROM boundary_info;
