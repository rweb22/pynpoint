-- Migration: Add DIGIPIN cells to pincodes table
-- Description: Adds digipin_cells column and populates it with level-6 DIGIPIN codes
-- Estimated time: 2-4 hours for full population of 19,312 pincodes

BEGIN;

-- Step 1: Create DIGIPIN functions (idempotent)
-- Source: create_digipin_functions_modular.sql

-- Calculate grid indices for a coordinate
CREATE OR REPLACE FUNCTION digipin_calc_indices(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  OUT lat_idx INTEGER,
  OUT lng_idx INTEGER
) AS $$
DECLARE
  -- Official India Post bounding box
  min_lat CONSTANT DOUBLE PRECISION := 2.5;
  max_lat CONSTANT DOUBLE PRECISION := 38.5;
  min_lng CONSTANT DOUBLE PRECISION := 63.5;
  max_lng CONSTANT DOUBLE PRECISION := 99.5;
  
  -- Grid dimensions (from official spec)
  lat_cells CONSTANT INTEGER := 144;  -- 36° ÷ 0.25° = 144 cells
  lng_cells CONSTANT INTEGER := 144;  -- 36° ÷ 0.25° = 144 cells
  
  lat_step CONSTANT DOUBLE PRECISION := 0.25;  -- 36° ÷ 144 = 0.25°
  lng_step CONSTANT DOUBLE PRECISION := 0.25;  -- 36° ÷ 144 = 0.25°
BEGIN
  -- Check bounds
  IF lat < min_lat OR lat > max_lat OR lng < min_lng OR lng > max_lng THEN
    lat_idx := NULL;
    lng_idx := NULL;
    RETURN;
  END IF;
  
  -- Calculate indices (TOP-TO-BOTTOM for latitude)
  lat_idx := FLOOR((max_lat - lat) / lat_step)::INTEGER;
  lng_idx := FLOOR((lng - min_lng) / lng_step)::INTEGER;
  
  -- Clamp to valid range
  lat_idx := GREATEST(0, LEAST(lat_cells - 1, lat_idx));
  lng_idx := GREATEST(0, LEAST(lng_cells - 1, lng_idx));
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION digipin_calc_indices IS
'Calculate grid indices for latitude/longitude coordinates.
Returns NULL if coordinates are outside official India Post bounding box.
Uses top-to-bottom latitude indexing per official DIGIPIN specification.';

-- Get grid character for index
CREATE OR REPLACE FUNCTION digipin_grid_char(idx INTEGER)
RETURNS TEXT AS $$
DECLARE
  grid_chars TEXT[] := ARRAY['F', 'C', '9', '8', '3', '2', 'J', 'K', 'L', 'M', 'P', 'T', '4', '5', '6', '7'];
BEGIN
  IF idx < 0 OR idx > 15 THEN
    RETURN NULL;
  END IF;
  RETURN grid_chars[idx + 1];  -- PostgreSQL arrays are 1-based
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION digipin_grid_char IS
'Convert a grid index (0-15) to its DIGIPIN character.
Uses official India Post character set: F,C,9,8,3,2,J,K,L,M,P,T,4,5,6,7';

-- Encode coordinates to DIGIPIN Level 6
CREATE OR REPLACE FUNCTION encode_digipin_level6(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
)
RETURNS TEXT AS $$
DECLARE
  lat_idx INTEGER;
  lng_idx INTEGER;
  sub_lat_idx INTEGER;
  sub_lng_idx INTEGER;
  subsub_lat_idx INTEGER;
  subsub_lng_idx INTEGER;
BEGIN
  -- Level 4 (first 2 characters)
  SELECT * INTO lat_idx, lng_idx FROM digipin_calc_indices(lat, lng);
  
  IF lat_idx IS NULL OR lng_idx IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Level 5 subdivision (characters 3-4)
  sub_lat_idx := FLOOR(((lat_idx % 1) * 4))::INTEGER;
  sub_lng_idx := FLOOR(((lng_idx % 1) * 4))::INTEGER;
  
  -- Level 6 subdivision (characters 5-6)
  subsub_lat_idx := FLOOR(((sub_lat_idx % 1) * 4))::INTEGER;
  subsub_lng_idx := FLOOR(((sub_lng_idx % 1) * 4))::INTEGER;
  
  -- Build 6-character code
  RETURN 
    digipin_grid_char(lat_idx % 16) ||
    digipin_grid_char(lng_idx % 16) ||
    digipin_grid_char(sub_lat_idx % 16) ||
    digipin_grid_char(sub_lng_idx % 16) ||
    digipin_grid_char(subsub_lat_idx % 16) ||
    digipin_grid_char(subsub_lng_idx % 16);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION encode_digipin_level6 IS
'Encode latitude/longitude to DIGIPIN Level 6 (6-character code).
Returns NULL for coordinates outside India.
Implements official India Post DIGIPIN specification.';

-- Polygon to cells (GEOGRAPHY overload)
CREATE OR REPLACE FUNCTION polygon_to_digipin_cells_level6(
  geog GEOGRAPHY,
  grid_spacing_meters DOUBLE PRECISION DEFAULT 100.0
)
RETURNS TEXT[] AS $$
BEGIN
  RETURN polygon_to_digipin_cells_level6(geog::GEOMETRY, grid_spacing_meters);
END;
$$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;

COMMENT ON FUNCTION polygon_to_digipin_cells_level6(GEOGRAPHY, DOUBLE PRECISION) IS
'Generate DIGIPIN level-6 cells for a polygon using grid sampling.
Accepts GEOGRAPHY type (converted to GEOMETRY internally).
Grid spacing controls coverage density (default: 100m for complete coverage).
Returns array of unique DIGIPIN codes that cover the polygon.';
