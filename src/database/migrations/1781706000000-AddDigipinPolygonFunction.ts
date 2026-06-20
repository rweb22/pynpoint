import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddDigipinPolygonFunction Migration
 *
 * Creates the polygon_to_digipin_cells_level6() function for generating
 * DIGIPIN cells that cover a polygon geometry.
 *
 * Features:
 * - Accepts both GEOGRAPHY and GEOMETRY types
 * - Optimized set-based operations (no loops)
 * - Latitude-aware grid spacing
 * - Safety limit: 1M cells to prevent timeout
 * - Returns array of unique DIGIPIN codes
 *
 * Default grid spacing: 100m for complete coverage
 * Use 200m spacing for large polygons to improve performance
 */
export class AddDigipinPolygonFunction1781706000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Creating DIGIPIN polygon coverage function...');

    // Main implementation: GEOMETRY type
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
        grid_step_deg DOUBLE PRECISION;
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
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    // Overload for GEOGRAPHY type
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION polygon_to_digipin_cells_level6(
        geog GEOGRAPHY,
        grid_spacing_meters DOUBLE PRECISION DEFAULT 100.0
      )
      RETURNS TEXT[] AS $$
      BEGIN
        RETURN polygon_to_digipin_cells_level6(geog::GEOMETRY, grid_spacing_meters);
      END;
      $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
    `);

    console.log('✅ Created DIGIPIN polygon coverage function');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Dropping DIGIPIN polygon function...');

    await queryRunner.query(
      `DROP FUNCTION IF EXISTS polygon_to_digipin_cells_level6(GEOGRAPHY, DOUBLE PRECISION)`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS polygon_to_digipin_cells_level6(GEOMETRY, DOUBLE PRECISION)`,
    );

    console.log('Removed DIGIPIN polygon function');
  }
}
