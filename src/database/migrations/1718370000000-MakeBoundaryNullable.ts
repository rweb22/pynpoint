import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Make boundary column nullable in pincodes table
 * 
 * Reason:
 * - CSV has 19,586 unique pincodes
 * - GeoJSON has only 19,312 pincodes with boundaries
 * - 274 pincodes exist in CSV but not in GeoJSON (no boundary data)
 * - These 274 pincodes should still be inserted for metadata purposes
 *   (state, district, city, office_name from CSV)
 * 
 * Solution:
 * - Change boundary column from NOT NULL to NULLABLE
 * - Change centroid column to NULLABLE (already nullable in entity, but ensuring DB matches)
 * - Allows inserting pincodes with metadata but without spatial data
 * - Queries can filter: WHERE boundary IS NOT NULL for spatial operations
 */
export class MakeBoundaryNullable1718370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make boundary column nullable
    await queryRunner.query(`
      ALTER TABLE pincodes 
      ALTER COLUMN boundary DROP NOT NULL;
    `);

    // Ensure centroid is also nullable (should already be, but being explicit)
    await queryRunner.query(`
      ALTER TABLE pincodes 
      ALTER COLUMN centroid DROP NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // WARNING: This will fail if there are any NULL boundaries in the database
    await queryRunner.query(`
      ALTER TABLE pincodes 
      ALTER COLUMN boundary SET NOT NULL;
    `);

    // Note: We don't restore centroid to NOT NULL since it was already nullable
  }
}
