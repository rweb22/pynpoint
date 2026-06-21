-- =====================================================================
-- DIGIPIN PostgreSQL Functions (Modular Design)
-- =====================================================================
--
-- Purpose: Encode geographic coordinates to DIGIPIN codes
-- Strategy: Split into smaller, testable functions
-- Source: Official India Post Technical Document Annexure 1
--
-- DIGIPIN Spec:
-- - 16-character grid: [['F','C','9','8'],['J','3','2','7'],['K','4','5','6'],['L','M','P','T']]
-- - 4×4 hierarchical grid subdivision
-- - Level 6: ~200m × 200m cell size
-- - India bbox: lat[2.5, 38.5], lng[63.5, 99.5] (OFFICIAL SPEC)
-- - Latitude: TOP-to-BOTTOM (row=0 is maxLat)
-- - Longitude: LEFT-to-RIGHT (col=0 is minLng)
-- =====================================================================

-- Helper Function 1: Get character from grid position
-- =====================================================================
CREATE OR REPLACE FUNCTION digipin_grid_char(row_idx INTEGER, col_idx INTEGER)
RETURNS TEXT AS $$
DECLARE
  grid TEXT[][] := ARRAY[
    ARRAY['F', 'C', '9', '8'],  -- row 0 (TOP latitude band)
    ARRAY['J', '3', '2', '7'],  -- row 1
    ARRAY['K', '4', '5', '6'],  -- row 2
    ARRAY['L', 'M', 'P', 'T']   -- row 3 (BOTTOM latitude band)
  ];
BEGIN
  -- PostgreSQL arrays are 1-indexed
  RETURN grid[row_idx + 1][col_idx + 1];
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION digipin_grid_char(INTEGER, INTEGER) IS
'Get DIGIPIN character from grid position (0-3, 0-3).
Official 2D grid from India Post Technical Document Annexure 1.';


-- Helper Function 2: Calculate grid indices for a point
-- =====================================================================
CREATE OR REPLACE FUNCTION digipin_calc_indices(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  box_min_lat DOUBLE PRECISION,
  box_max_lat DOUBLE PRECISION,
  box_min_lng DOUBLE PRECISION,
  box_max_lng DOUBLE PRECISION,
  OUT lat_index INTEGER,
  OUT lng_index INTEGER
) AS $$
DECLARE
  lat_step DOUBLE PRECISION;
  lng_step DOUBLE PRECISION;
BEGIN
  -- Calculate cell dimensions (4×4 grid)
  lat_step := (box_max_lat - box_min_lat) / 4.0;
  lng_step := (box_max_lng - box_min_lng) / 4.0;

  -- CRITICAL: Official spec subdivides latitude from TOP to BOTTOM
  -- row=0 is the topmost band (maxLat down), row=3 is bottommost
  lat_index := LEAST(3, FLOOR((box_max_lat - lat) / lat_step)::INTEGER);

  -- Longitude subdivides normally from LEFT to RIGHT
  lng_index := LEAST(3, FLOOR((lng - box_min_lng) / lng_step)::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION digipin_calc_indices IS
'Calculate grid indices (row, col) for a point within a bounding box.
Uses official India Post algorithm: latitude TOP-to-BOTTOM, longitude LEFT-to-RIGHT.';


-- Helper Function 3: Update bounding box to selected cell
-- =====================================================================
CREATE OR REPLACE FUNCTION digipin_update_box(
  lat_index INTEGER,
  lng_index INTEGER,
  box_min_lat DOUBLE PRECISION,
  box_max_lat DOUBLE PRECISION,
  box_min_lng DOUBLE PRECISION,
  box_max_lng DOUBLE PRECISION,
  OUT new_min_lat DOUBLE PRECISION,
  OUT new_max_lat DOUBLE PRECISION,
  OUT new_min_lng DOUBLE PRECISION,
  OUT new_max_lng DOUBLE PRECISION
) AS $$
DECLARE
  lat_step DOUBLE PRECISION;
  lng_step DOUBLE PRECISION;
BEGIN
  lat_step := (box_max_lat - box_min_lat) / 4.0;
  lng_step := (box_max_lng - box_min_lng) / 4.0;

  -- For latitude: move DOWN from maxLat (top-to-bottom)
  new_max_lat := box_max_lat - lat_index * lat_step;
  new_min_lat := new_max_lat - lat_step;

  -- For longitude: move RIGHT from minLng (left-to-right)
  new_min_lng := box_min_lng + lng_index * lng_step;
  new_max_lng := new_min_lng + lng_step;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION digipin_update_box IS
'Update bounding box to the selected cell at current level.
Uses official algorithm: latitude descends from top, longitude ascends from left.';


-- Main Function: Encode single point to DIGIPIN level-6
-- =====================================================================
CREATE OR REPLACE FUNCTION encode_digipin_level6(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
RETURNS TEXT AS $$
DECLARE
  -- India bounding box (OFFICIAL SPEC)
  min_lat CONSTANT DOUBLE PRECISION := 2.5;   -- Official: 2.5°N
  max_lat CONSTANT DOUBLE PRECISION := 38.5;  -- Official: 38.5°N
  min_lng CONSTANT DOUBLE PRECISION := 63.5;  -- Official: 63.5°E
  max_lng CONSTANT DOUBLE PRECISION := 99.5;  -- Official: 99.5°E

  -- Working variables
  current_min_lat DOUBLE PRECISION;
  current_max_lat DOUBLE PRECISION;
  current_min_lng DOUBLE PRECISION;
  current_max_lng DOUBLE PRECISION;

  lat_index INTEGER;
  lng_index INTEGER;

  digipin TEXT := '';
  i INTEGER;
BEGIN
  -- Validate coordinates are within India
  IF lat < min_lat OR lat > max_lat OR lng < min_lng OR lng > max_lng THEN
    RETURN NULL; -- Outside India
  END IF;

  -- Initialize bounding box
  current_min_lat := min_lat;
  current_max_lat := max_lat;
  current_min_lng := min_lng;

  current_max_lng := max_lng;

  -- Iterate through 6 levels using helper functions
  FOR i IN 1..6 LOOP
    -- Calculate indices
    SELECT * INTO lat_index, lng_index
    FROM digipin_calc_indices(lat, lng, current_min_lat, current_max_lat, current_min_lng, current_max_lng);

    -- Append character from grid
    digipin := digipin || digipin_grid_char(lat_index, lng_index);

    -- Update bounding box
    SELECT * INTO current_min_lat, current_max_lat, current_min_lng, current_max_lng
    FROM digipin_update_box(lat_index, lng_index, current_min_lat, current_max_lat, current_min_lng, current_max_lng);
  END LOOP;

  RETURN digipin;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION encode_digipin_level6(DOUBLE PRECISION, DOUBLE PRECISION) IS
'Encode geographic coordinates to DIGIPIN level-6 code.
Returns 6-character alphanumeric code (e.g., "39J438").
Returns NULL if coordinates are outside India.
Uses modular helper functions for testability.
Official India Post algorithm implementation.';


-- Test Helper: Encode and compare with expected
-- =====================================================================
CREATE OR REPLACE FUNCTION test_digipin_encode(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  expected TEXT DEFAULT NULL
)
RETURNS TABLE(
  location TEXT,
  generated TEXT,
  expected_val TEXT,
  match BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    format('(%s, %s)', lat, lng)::TEXT,
    encode_digipin_level6(lat, lng),
    expected,
    CASE
      WHEN expected IS NULL THEN TRUE
      ELSE encode_digipin_level6(lat, lng) = expected
    END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION test_digipin_encode IS
'Test helper function to verify DIGIPIN encoding.
Returns comparison between generated and expected codes.';



-- Polygon Coverage Function: Generate DIGIPIN cells for polygon
-- =====================================================================
-- Overload 1: Accept GEOGRAPHY type (convert to GEOMETRY)
CREATE OR REPLACE FUNCTION polygon_to_digipin_cells_level6(
  geog GEOGRAPHY,
  grid_spacing_meters DOUBLE PRECISION DEFAULT 100.0
)
RETURNS TEXT[] AS $$
BEGIN
  -- Convert geography to geometry and call the geometry version
  RETURN polygon_to_digipin_cells_level6(geog::geometry, grid_spacing_meters);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

-- Overload 2: Accept GEOMETRY type (main implementation - OPTIMIZED)
CREATE OR REPLACE FUNCTION polygon_to_digipin_cells_level6(
  geom GEOMETRY,
  grid_spacing_meters DOUBLE PRECISION DEFAULT 100.0
)
RETURNS TEXT[] AS $$
DECLARE
  digipin_set TEXT[] := '{}';
  bbox GEOMETRY;
  min_x DOUBLE PRECISION;
  max_x DOUBLE PRECISION;
  min_y DOUBLE PRECISION;
  max_y DOUBLE PRECISION;
  grid_step_deg DOUBLE PRECISION;
  lat_step DOUBLE PRECISION;
  lng_step DOUBLE PRECISION;

  -- For batch processing
  point_batch GEOMETRY[];
  batch_size CONSTANT INTEGER := 1000;
  batch_count INTEGER := 0;

  -- Safety limit
  max_cells CONSTANT INTEGER := 1000000; -- 1M cells max
  cell_count INTEGER := 0;
BEGIN
  -- Convert geom to 4326 if needed
  IF ST_SRID(geom) != 4326 THEN
    geom := ST_Transform(geom, 4326);
  END IF;

  -- Get bounding box
  bbox := ST_Envelope(geom);
  min_x := ST_XMin(bbox);
  max_x := ST_XMax(bbox);
  min_y := ST_YMin(bbox);
  max_y := ST_YMax(bbox);

  -- Calculate grid step in degrees
  -- Account for latitude variation: 1 degree longitude varies with latitude
  -- At equator: ~111km, at 30°: ~96km
  -- Use average latitude for calculation
  lat_step := grid_spacing_meters / 111000.0;
  lng_step := grid_spacing_meters / (111000.0 * COS(RADIANS((min_y + max_y) / 2.0)));

  -- Generate grid and process
  WITH grid_y AS (
    SELECT generate_series(0, FLOOR((max_y - min_y) / lat_step)::int) AS y_idx
  ),
  grid_x AS (
    SELECT generate_series(0, FLOOR((max_x - min_x) / lng_step)::int) AS x_idx
  ),
  grid_points AS (
    SELECT
      min_x + (x_idx * lng_step) AS x,
      min_y + (y_idx * lat_step) AS y
    FROM grid_x CROSS JOIN grid_y
  ),
  sample_points AS (
    SELECT
      y AS lat,
      x AS lng
    FROM grid_points
    WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(x, y), 4326))
    LIMIT max_cells
  )
  SELECT array_agg(DISTINCT encode_digipin_level6(lat, lng))
  INTO digipin_set
  FROM sample_points
  WHERE encode_digipin_level6(lat, lng) IS NOT NULL;

  -- Remove any NULL values
  digipin_set := COALESCE(digipin_set, '{}');

  RETURN digipin_set;
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION polygon_to_digipin_cells_level6(GEOGRAPHY, DOUBLE PRECISION) IS
'Generate DIGIPIN level-6 cells for a polygon using grid sampling.
Accepts GEOGRAPHY type (converted to GEOMETRY internally).
Grid spacing controls coverage density (default: 100m for complete coverage).
Returns array of unique DIGIPIN codes that cover the polygon.';

COMMENT ON FUNCTION polygon_to_digipin_cells_level6(GEOMETRY, DOUBLE PRECISION) IS
'Generate DIGIPIN level-6 cells for a polygon using optimized grid sampling.
Accepts GEOMETRY type.
Grid spacing controls coverage density (default: 100m for complete coverage).
Uses set-based operations for better performance with large polygons.
Accounts for latitude variation in longitude degree spacing.
Safety limit: max 1M cells to prevent timeout.
Returns array of unique DIGIPIN codes that cover the polygon.';
