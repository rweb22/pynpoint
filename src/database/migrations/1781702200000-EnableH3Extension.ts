import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable H3 Extension Migration
 * 
 * This migration enables the H3 PostgreSQL extension for native H3 spatial operations.
 * 
 * The H3 extension provides:
 * - h3_lat_lng_to_cell: Convert coordinates to H3 cell
 * - h3_cell_to_boundary: Get H3 cell polygon
 * - h3_polygon_to_cells: Fill polygon with H3 cells (native, accurate)
 * - h3_cell_to_lat_lng: Get H3 cell center
 * - And many more H3 functions
 * 
 * Benefits over JavaScript h3-js:
 * - 100% accurate spatial intersection using PostGIS
 * - Faster execution (native C extension)
 * - Consistent with database geometry operations
 * - No buffer approximation needed
 * 
 * Generated: 2026-06-17
 */
export class EnableH3Extension1781702200000 implements MigrationInterface {
  name = 'EnableH3Extension1781702200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable H3 extension
    try {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS h3;`);
      console.log('✅ H3 extension installed successfully');
    } catch (error) {
      // Check if H3 is available but installation failed
      const available = await queryRunner.query(
        `SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'h3';`
      );

      if (parseInt(available[0].count) > 0) {
        console.warn(
          '⚠️  H3 extension is available but installation failed. ' +
          'This might be a permissions issue. Error: ' + error.message
        );
        // Don't throw - H3 is optional, we can fall back to JavaScript approach
      } else {
        console.warn(
          '⚠️  H3 extension is not available on this PostgreSQL instance. ' +
          'Will use JavaScript h3-js + PostGIS ST_Intersects approach instead.'
        );
        // Don't throw - H3 is optional
      }
    }

    // Try to enable H3 PostGIS integration (optional, provides additional conveniences)
    try {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS h3_postgis;`);
      console.log('✅ H3 PostGIS integration installed successfully');
    } catch (error) {
      console.warn(
        '⚠️  H3 PostGIS integration not available (optional). ' +
        'H3 extension alone is sufficient.'
      );
      // Don't throw - h3_postgis is optional
    }

    // Verify H3 installation
    const h3Installed = await queryRunner.query(
      `SELECT COUNT(*) FROM pg_extension WHERE extname = 'h3';`
    );

    if (parseInt(h3Installed[0].count) > 0) {
      // Log available H3 functions
      const functionCount = await queryRunner.query(
        `SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'h3_%';`
      );
      console.log(`✅ H3 extension verified: ${functionCount[0].count} functions available`);
    } else {
      console.warn(
        '⚠️  H3 extension not installed. System will use JavaScript h3-js library instead.'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop H3 PostGIS integration first (if it exists)
    try {
      await queryRunner.query(`DROP EXTENSION IF EXISTS h3_postgis;`);
    } catch (error) {
      console.warn('Could not drop h3_postgis extension:', error.message);
    }

    // Drop H3 extension
    try {
      await queryRunner.query(`DROP EXTENSION IF EXISTS h3 CASCADE;`);
    } catch (error) {
      console.warn('Could not drop h3 extension:', error.message);
    }
  }
}
