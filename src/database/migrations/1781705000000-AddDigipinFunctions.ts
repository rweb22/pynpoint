import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddDigipinFunctions Migration
 *
 * Creates PL/pgSQL functions for DIGIPIN Level 6 encoding.
 * These functions implement the official India Post DIGIPIN specification.
 *
 * Functions created:
 * - digipin_calc_indices(lat, lng) → Calculate grid indices
 * - digipin_grid_char(idx) → Convert index to DIGIPIN character
 * - encode_digipin_level6(lat, lng) → Encode coordinates to 6-char code
 * - polygon_to_digipin_cells_level6(geom, spacing) → Generate cells for polygon
 *
 * Safe to run multiple times (uses CREATE OR REPLACE).
 */
export class AddDigipinFunctions1781705000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Creating DIGIPIN functions...');

    // Function 1: Calculate grid indices for current bounding box
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
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    // Function 2: Grid character lookup (2D)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION digipin_grid_char(
        lat_idx INTEGER,
        lng_idx INTEGER
      )
      RETURNS TEXT AS $$
      DECLARE
        grid TEXT[][] := ARRAY[
          ARRAY['F', 'C', '9', '8'],
          ARRAY['3', '2', 'J', 'K'],
          ARRAY['L', 'M', 'P', 'T'],
          ARRAY['4', '5', '6', '7']
        ];
      BEGIN
        IF lat_idx < 0 OR lat_idx > 3 OR lng_idx < 0 OR lng_idx > 3 THEN
          RETURN NULL;
        END IF;
        RETURN grid[lat_idx + 1][lng_idx + 1];
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    // Function 3: Update bounding box helper
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
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

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
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    console.log('✅ Created DIGIPIN core functions');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Dropping DIGIPIN functions...');

    await queryRunner.query(`DROP FUNCTION IF EXISTS encode_digipin_level6`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_update_box`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_grid_char`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_calc_indices`);

    console.log('Removed DIGIPIN functions');
  }
}
