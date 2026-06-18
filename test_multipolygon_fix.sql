-- Test the fixed query that handles MultiPolygon correctly

-- Test 1: Extract first polygon from MultiPolygon and get H3 cells
SELECT h3_polygon_to_cells(
  ST_MakePolygon(
    ST_ExteriorRing(
      ST_GeometryN(boundary::geometry, 1)
    )
  )::polygon,
  ARRAY[]::polygon[],
  9::int
)::text as h3_index
FROM pincodes
WHERE pincode = '110001'
  AND boundary IS NOT NULL
  AND ST_IsValid(boundary::geometry) = true
LIMIT 10;

-- Test 2: Count total H3 cells for this pincode
SELECT 
    pincode,
    COUNT(*) as num_h3_cells
FROM (
    SELECT 
        '110001' as pincode,
        h3_polygon_to_cells(
          ST_MakePolygon(
            ST_ExteriorRing(
              ST_GeometryN(boundary::geometry, 1)
            )
          )::polygon,
          ARRAY[]::polygon[],
          9::int
        )::text as h3_index
    FROM pincodes
    WHERE pincode = '110001'
      AND boundary IS NOT NULL
      AND ST_IsValid(boundary::geometry) = true
) as h3_cells
GROUP BY pincode;
