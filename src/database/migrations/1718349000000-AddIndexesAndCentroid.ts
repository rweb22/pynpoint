import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add Indexes and Centroid Column
 * 
 * This migration:
 * 1. Adds indexes on district and city for faster filtering
 * 2. Adds a computed centroid column (geometric center of boundary)
 * 3. Adds a spatial index on the centroid for point-based queries
 * 
 * The centroid is useful for:
 * - Displaying pincode markers on a map
 * - Distance calculations from pincode centers
 * - Finding nearest pincodes
 */
export class AddIndexesAndCentroid1718349000000 implements MigrationInterface {
  name = 'AddIndexesAndCentroid1718349000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add indexes on district and city
    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_district" ON "pincodes" ("district");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_city" ON "pincodes" ("city");
    `);

    // Add centroid column (computed from boundary)
    await queryRunner.query(`
      ALTER TABLE "pincodes" 
      ADD COLUMN "centroid" geography(Point, 4326);
    `);

    // Populate centroid for existing pincodes
    await queryRunner.query(`
      UPDATE "pincodes" 
      SET centroid = ST_Centroid(boundary::geometry)::geography;
    `);

    // Create spatial index on centroid
    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_centroid" ON "pincodes" USING GIST ("centroid");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop spatial index
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_centroid";`);

    // Drop centroid column
    await queryRunner.query(`ALTER TABLE "pincodes" DROP COLUMN IF EXISTS "centroid";`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_city";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_district";`);
  }
}
