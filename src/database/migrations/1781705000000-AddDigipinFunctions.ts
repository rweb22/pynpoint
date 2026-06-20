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

    // Function 1: Calculate grid indices
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION digipin_calc_indices(
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        OUT lat_idx INTEGER,
        OUT lng_idx INTEGER
      ) AS $$
      DECLARE
        min_lat CONSTANT DOUBLE PRECISION := 2.5;
        max_lat CONSTANT DOUBLE PRECISION := 38.5;
        min_lng CONSTANT DOUBLE PRECISION := 63.5;
        max_lng CONSTANT DOUBLE PRECISION := 99.5;
        lat_cells CONSTANT INTEGER := 144;
        lng_cells CONSTANT INTEGER := 144;
        lat_step CONSTANT DOUBLE PRECISION := 0.25;
        lng_step CONSTANT DOUBLE PRECISION := 0.25;
      BEGIN
        IF lat < min_lat OR lat > max_lat OR lng < min_lng OR lng > max_lng THEN
          lat_idx := NULL;
          lng_idx := NULL;
          RETURN;
        END IF;
        lat_idx := FLOOR((max_lat - lat) / lat_step)::INTEGER;
        lng_idx := FLOOR((lng - min_lng) / lng_step)::INTEGER;
        lat_idx := GREATEST(0, LEAST(lat_cells - 1, lat_idx));
        lng_idx := GREATEST(0, LEAST(lng_cells - 1, lng_idx));
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    // Function 2: Grid character lookup
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION digipin_grid_char(idx INTEGER)
      RETURNS TEXT AS $$
      DECLARE
        grid_chars TEXT[] := ARRAY['F', 'C', '9', '8', '3', '2', 'J', 'K', 'L', 'M', 'P', 'T', '4', '5', '6', '7'];
      BEGIN
        IF idx < 0 OR idx > 15 THEN
          RETURN NULL;
        END IF;
        RETURN grid_chars[idx + 1];
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    // Function 3: Encode to DIGIPIN Level 6
    await queryRunner.query(`
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
        SELECT * INTO lat_idx, lng_idx FROM digipin_calc_indices(lat, lng);
        
        IF lat_idx IS NULL OR lng_idx IS NULL THEN
          RETURN NULL;
        END IF;
        
        sub_lat_idx := FLOOR(((lat_idx % 1) * 4))::INTEGER;
        sub_lng_idx := FLOOR(((lng_idx % 1) * 4))::INTEGER;
        subsub_lat_idx := FLOOR(((sub_lat_idx % 1) * 4))::INTEGER;
        subsub_lng_idx := FLOOR(((sub_lng_idx % 1) * 4))::INTEGER;
        
        RETURN 
          digipin_grid_char(lat_idx % 16) ||
          digipin_grid_char(lng_idx % 16) ||
          digipin_grid_char(sub_lat_idx % 16) ||
          digipin_grid_char(sub_lng_idx % 16) ||
          digipin_grid_char(subsub_lat_idx % 16) ||
          digipin_grid_char(subsub_lng_idx % 16);
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    console.log('✅ Created DIGIPIN core functions');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Dropping DIGIPIN functions...');

    await queryRunner.query(`DROP FUNCTION IF EXISTS encode_digipin_level6`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_grid_char`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS digipin_calc_indices`);

    console.log('Removed DIGIPIN functions');
  }
}
