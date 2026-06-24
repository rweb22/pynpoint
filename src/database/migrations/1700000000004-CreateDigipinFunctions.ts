import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 04: CreateDigipinFunctions
 *
 * Creates PL/pgSQL functions for DIGIPIN Level 6 encoding.
 * Implements the official India Post DIGIPIN specification.
 *
 * Functions created (6 total):
 * 1. digipin_calc_indices() - Calculate grid indices for bounding box
 * 2. digipin_grid_char() - Convert indices to DIGIPIN character
 * 3. digipin_update_box() - Update bounding box for next iteration
 * 4. encode_digipin_level6() - Encode coordinates to 6-char DIGIPIN
 * 5. polygon_to_digipin_cells_level6() (GEOMETRY) - Generate cells for polygon
 * 6. polygon_to_digipin_cells_level6() (GEOGRAPHY) - Overload for geography type
 *
 * DIGIPIN Grid (4x4):
 *    Lng →
 * Lat  F  C  9  8
 *  ↓   J  3  2  7
 *      K  4  5  6
 *      L  M  P  T
 *
 * India bounds: Lat [2.5, 38.5], Lng [63.5, 99.5]
 * Cell size at Level 6: ~300m x 300m
 *
 * All functions: IMMUTABLE PARALLEL SAFE for query optimization
 *
 * Generated: 2026-06-24
 */
export class CreateDigipinFunctions1700000000004 implements MigrationInterface {
  name = 'CreateDigipinFunctions1700000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] CreateDigipinFunctions - Starting...');

    // Function 1: Calculate grid indices
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION digipin_calc_indices(
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        box_min_lat DOUBLE PRECISION,
        box_max_lat DOUBLE PRECISION,
        box_min_lng DOUBLE PRECISION,
        box_max_lng DOUBLE PRECISION,
        OUT lat_idx INTEGER,
        OUT lng_idx INTEGER
      ) AS $$
      DECLARE
        lat_step DOUBLE PRECISION;
        lng_step DOUBLE PRECISION;
      BEGIN
        lat_step := (box_max_lat - box_min_lat) / 4.0;
        lng_step := (box_max_lng - box_min_lng) / 4.0;

        lat_idx := FLOOR((box_max_lat - lat) / lat_step)::INTEGER;
        lng_idx := FLOOR((lng - box_min_lng) / lng_step)::INTEGER;

        lat_idx := GREATEST(0, LEAST(3, lat_idx));
        lng_idx := GREATEST(0, LEAST(3, lng_idx));
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `);
    console.log('[Migration] ✅ Function: digipin_calc_indices');

    // Function 2: Grid character lookup
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION digipin_grid_char(
        lat_idx INTEGER,
        lng_idx INTEGER
      )
      RETURNS TEXT AS $$
      DECLARE
        grid TEXT[][] := ARRAY[
          ARRAY['F', 'C', '9', '8'],
          ARRAY['J', '3', '2', '7'],
          ARRAY['K', '4', '5', '6'],
          ARRAY['L', 'M', 'P', 'T']
        ];
      BEGIN
        IF lat_idx < 0 OR lat_idx > 3 OR lng_idx < 0 OR lng_idx > 3 THEN
          RETURN NULL;
        END IF;
        RETURN grid[lat_idx + 1][lng_idx + 1];
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `);
    console.log('[Migration] ✅ Function: digipin_grid_char');

    // Function 3: Update bounding box
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION digipin_update_box(
        lat_idx INTEGER,
        lng_idx INTEGER,
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

        new_max_lat := box_max_lat - lat_idx * lat_step;
        new_min_lat := new_max_lat - lat_step;
        new_min_lng := box_min_lng + lng_idx * lng_step;
        new_max_lng := new_min_lng + lng_step;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `);
    console.log('[Migration] ✅ Function: digipin_update_box');



    // Function 4: Encode to DIGIPIN Level 6
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION encode_digipin_level6(
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION
      )
      RETURNS TEXT AS $$
      DECLARE
        min_lat CONSTANT DOUBLE PRECISION := 2.5;
        max_lat CONSTANT DOUBLE PRECISION := 38.5;
        min_lng CONSTANT DOUBLE PRECISION := 63.5;
        max_lng CONSTANT DOUBLE PRECISION := 99.5;

        current_min_lat DOUBLE PRECISION;
        current_max_lat DOUBLE PRECISION;
        current_min_lng DOUBLE PRECISION;
        current_max_lng DOUBLE PRECISION;

        lat_idx INTEGER;
        lng_idx INTEGER;
        digipin TEXT := '';
        i INTEGER;
      BEGIN
        IF lat < min_lat OR lat > max_lat OR lng < min_lng OR lng > max_lng THEN
          RETURN NULL;
        END IF;

        current_min_lat := min_lat;
        current_max_lat := max_lat;
        current_min_lng := min_lng;
        current_max_lng := max_lng;

        FOR i IN 1..6 LOOP
          SELECT * INTO lat_idx, lng_idx
          FROM digipin_calc_indices(lat, lng, current_min_lat, current_max_lat, current_min_lng, current_max_lng);

          digipin := digipin || digipin_grid_char(lat_idx, lng_idx);

          SELECT * INTO current_min_lat, current_max_lat, current_min_lng, current_max_lng
          FROM digipin_update_box(lat_idx, lng_idx, current_min_lat, current_max_lat, current_min_lng, current_max_lng);
        END LOOP;

        RETURN digipin;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `);
    console.log('[Migration] ✅ Function: encode_digipin_level6');

    // Function 5: Polygon to DIGIPIN cells (GEOMETRY)
    await queryRunner.query(`
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
        lat_step DOUBLE PRECISION;
        lng_step DOUBLE PRECISION;
        max_cells CONSTANT INTEGER := 1000000;
      BEGIN
        IF ST_SRID(geom) != 4326 THEN
          geom := ST_Transform(geom, 4326);
        END IF;

        bbox := ST_Envelope(geom);
        min_x := ST_XMin(bbox);
        max_x := ST_XMax(bbox);
        min_y := ST_YMin(bbox);
        max_y := ST_YMax(bbox);

        lat_step := grid_spacing_meters / 111000.0;
        lng_step := grid_spacing_meters / (111000.0 * COS(RADIANS((min_y + max_y) / 2.0)));

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

        digipin_set := COALESCE(digipin_set, '{}');

        RETURN digipin_set;
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `);
    console.log('[Migration] ✅ Function: polygon_to_digipin_cells_level6 (GEOMETRY)');

    // Function 6: Polygon to DIGIPIN cells (GEOGRAPHY overload)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION polygon_to_digipin_cells_level6(
        geog GEOGRAPHY,
        grid_spacing_meters DOUBLE PRECISION DEFAULT 100.0
      )
      RETURNS TEXT[] AS $$
      BEGIN
        RETURN polygon_to_digipin_cells_level6(geog::GEOMETRY, grid_spacing_meters);
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE;
    `);
    console.log('[Migration] ✅ Function: polygon_to_digipin_cells_level6 (GEOGRAPHY)');

    console.log('[Migration] CreateDigipinFunctions - Complete');
    console.log('[Migration] Summary: 6 PL/pgSQL functions for DIGIPIN encoding');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] CreateDigipinFunctions - Rollback...');

    // Drop functions in reverse order
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_to_digipin_cells_level6(GEOGRAPHY, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS polygon_to_digipin_cells_level6(GEOMETRY, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS encode_digipin_level6(DOUBLE PRECISION, DOUBLE PRECISION);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_update_box;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_grid_char(INTEGER, INTEGER);`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_calc_indices;`);

    console.log('[Migration] CreateDigipinFunctions - Rollback complete');
  }
}
