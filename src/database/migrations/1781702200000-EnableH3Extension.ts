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
    // Install H3 extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS h3;`);
    console.log('✅ H3 extension installed successfully');

    // Verify H3 installation and count functions
    const functionCount = await queryRunner.query(
      `SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'h3_%';`
    );
    console.log(`✅ H3 extension verified: ${functionCount[0].count} functions available`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop H3 extension (CASCADE will drop dependent extensions)
    await queryRunner.query(`DROP EXTENSION IF EXISTS h3 CASCADE;`);
    console.log('H3 extension removed');
  }
}
