-- Test the complete query that handles ALL polygons and holes

-- Test 1: Simple polygon (should work as before)
-- Pincode 110001: Simple polygon, no holes
\echo 'Test 1: Simple polygon (110001)'
WITH boundary_info AS (
  SELECT 
    boundary::geometry as geom,
    ST_NumGeometries(boundary::geometry) as num_geoms
  FROM pincodes
  WHERE pincode = '110001'
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
SELECT 
  COUNT(*) as total_h3_cells,
  COUNT(DISTINCT h3_index) as unique_h3_cells
FROM (
  SELECT h3_polygon_to_cells(
    ST_MakePolygon(exterior_ring)::polygon,
    holes,
    9::int
  )::text as h3_index
  FROM polygon_with_holes
) as cells;

-- Test 2: Pincode with holes
-- Pincode 244235: Has 1 hole
\echo 'Test 2: Pincode with holes (244235)'
WITH boundary_info AS (
  SELECT 
    boundary::geometry as geom,
    ST_NumGeometries(boundary::geometry) as num_geoms
  FROM pincodes
  WHERE pincode = '244235'
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
SELECT 
  COUNT(*) as total_h3_cells,
  COUNT(DISTINCT h3_index) as unique_h3_cells
FROM (
  SELECT h3_polygon_to_cells(
    ST_MakePolygon(exterior_ring)::polygon,
    holes,
    9::int
  )::text as h3_index
  FROM polygon_with_holes
) as cells;

-- Test 3: Pincode with multiple disconnected polygons
-- Pincode 180003: Has 3 separate polygons
\echo 'Test 3: Multiple disconnected polygons (180003)'
WITH boundary_info AS (
  SELECT 
    boundary::geometry as geom,
    ST_NumGeometries(boundary::geometry) as num_geoms
  FROM pincodes
  WHERE pincode = '180003'
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
SELECT 
  COUNT(*) as total_h3_cells,
  COUNT(DISTINCT h3_index) as unique_h3_cells,
  (SELECT num_geoms FROM boundary_info) as num_polygons
FROM (
  SELECT h3_polygon_to_cells(
    ST_MakePolygon(exterior_ring)::polygon,
    holes,
    9::int
  )::text as h3_index
  FROM polygon_with_holes
) as cells;
