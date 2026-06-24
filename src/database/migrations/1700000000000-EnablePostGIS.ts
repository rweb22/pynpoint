import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 00: EnablePostGIS
 *
 * Enables the PostGIS extension for spatial data support.
 *
 * PostGIS adds support for:
 * - Geographic data types (GEOGRAPHY, GEOMETRY)
 * - Spatial functions (ST_Intersects, ST_Contains, ST_Distance, etc.)
 * - Spatial indexes (GIST)
 *
 * Required for:
 * - Pincode boundary polygons
 * - Centroid points
 * - Coordinate-based queries
 * - Point-in-polygon lookups
 *
 * Note: This extension must be enabled BEFORE creating tables with spatial columns.
 *
 * Generated: 2026-06-24
 */
export class EnablePostGIS1700000000000 implements MigrationInterface {
  name = 'EnablePostGIS1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] EnablePostGIS - Starting...');

    // Enable PostGIS extension (requires superuser or extension privileges)
    try {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
      console.log('[Migration] ✅ PostGIS extension enabled');
    } catch (error) {
      // Check if PostGIS is already available (might be pre-installed)
      const result = await queryRunner.query(
        `SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'postgis' AND installed_version IS NOT NULL;`,
      );

      if (parseInt(result[0].count) === 0) {
        throw new Error(
          'PostGIS extension is not available. Please enable PostGIS in your PostgreSQL database. ' +
            'In Railway dashboard: Database > Settings > Enable PostGIS Extension',
        );
      }
      
      console.log('[Migration] ✅ PostGIS extension already enabled');
    }

    // Verify PostGIS version
    const versionResult = await queryRunner.query(`SELECT PostGIS_Version();`);
    console.log(`[Migration] PostGIS version: ${versionResult[0].postgis_version}`);

    console.log('[Migration] EnablePostGIS - Complete');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] EnablePostGIS - Rollback...');
    
    // Note: We don't drop PostGIS extension as other databases might use it
    // and it's safe to leave enabled
    console.log('[Migration] ⚠️  PostGIS extension NOT dropped (safe to leave enabled)');
    
    console.log('[Migration] EnablePostGIS - Rollback complete');
  }
}
