-- Diagnose why pincodes might be skipped

-- 1. Count pincodes without boundaries
SELECT 
    'No boundary' as reason,
    COUNT(*) as count
FROM pincodes
WHERE boundary IS NULL

UNION ALL

-- 2. Count pincodes with invalid geometries
SELECT 
    'Invalid geometry' as reason,
    COUNT(*) as count
FROM pincodes
WHERE boundary IS NOT NULL
  AND ST_IsValid(boundary::geometry) = false

UNION ALL

-- 3. Count pincodes with valid boundaries
SELECT 
    'Valid boundary' as reason,
    COUNT(*) as count
FROM pincodes
WHERE boundary IS NOT NULL
  AND ST_IsValid(boundary::geometry) = true

UNION ALL

-- 4. Total pincodes
SELECT 
    'TOTAL' as reason,
    COUNT(*) as count
FROM pincodes;

-- 5. Sample some pincodes without boundaries
\echo ''
\echo 'Sample pincodes without boundaries:'
SELECT pincode, officename, districtname, statename
FROM pincodes
WHERE boundary IS NULL
LIMIT 10;

-- 6. Sample pincodes with invalid geometries (if any)
\echo ''
\echo 'Pincodes with invalid geometries (if any):'
SELECT pincode, ST_GeometryType(boundary::geometry) as geom_type
FROM pincodes
WHERE boundary IS NOT NULL
  AND ST_IsValid(boundary::geometry) = false
LIMIT 10;

-- 7. Test if our complex query would fail on any valid boundary
\echo ''
\echo 'Testing query on sample of valid boundaries:'
WITH boundary_info AS (
  SELECT 
    pincode,
    boundary::geometry as geom,
    ST_NumGeometries(boundary::geometry) as num_geoms
  FROM pincodes
  WHERE boundary IS NOT NULL
    AND ST_IsValid(boundary::geometry) = true
  LIMIT 5
),
all_polygons AS (
  SELECT 
    pincode,
    generate_series(1, num_geoms) as geom_idx,
    geom
  FROM boundary_info
),
polygon_rings AS (
  SELECT 
    pincode,
    geom_idx,
    ST_GeometryN(geom, geom_idx) as polygon,
    ST_ExteriorRing(ST_GeometryN(geom, geom_idx)) as exterior_ring,
    ST_NumInteriorRings(ST_GeometryN(geom, geom_idx)) as num_holes
  FROM all_polygons
),
polygon_with_holes AS (
  SELECT 
    pincode,
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
  pincode,
  COUNT(*) as h3_cells_generated
FROM (
  SELECT 
    pincode,
    h3_polygon_to_cells(
      ST_MakePolygon(exterior_ring)::polygon,
      holes,
      9::int
    )::text as h3_index
  FROM polygon_with_holes
) as cells
GROUP BY pincode;
