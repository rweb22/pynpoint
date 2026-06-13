import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial Schema Migration
 * 
 * This migration:
 * 1. Enables PostGIS extension
 * 2. Creates pincodes table with geographic boundaries
 * 3. Creates spatial indexes for fast queries
 * 
 * Generated: 2024-06-13
 */
export class InitialSchema1718260800000 implements MigrationInterface {
  name = 'InitialSchema1718260800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable PostGIS extension (requires superuser or extension privileges)
    // Try to create the extension, but don't fail if it's not available
    try {
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`);
    } catch (error) {
      // Check if PostGIS is already available (might be pre-installed)
      const result = await queryRunner.query(
        `SELECT COUNT(*) FROM pg_available_extensions WHERE name = 'postgis' AND installed_version IS NOT NULL;`
      );

      if (parseInt(result[0].count) === 0) {
        throw new Error(
          'PostGIS extension is not available. Please enable PostGIS in your Railway PostgreSQL database. ' +
          'In Railway dashboard: Database > Settings > Enable PostGIS Extension'
        );
      }
      // PostGIS is already installed, continue
    }

    // Create pincodes table
    await queryRunner.query(`
      CREATE TABLE "pincodes" (
        "id" SERIAL PRIMARY KEY,
        "pincode" VARCHAR(6) NOT NULL UNIQUE,
        "boundary" geography(MultiPolygon, 4326) NOT NULL,
        "state" VARCHAR(100),
        "district" VARCHAR(100),
        "city" VARCHAR(100),
        "office_name" VARCHAR(200),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_pincode" ON "pincodes" ("pincode");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_boundary" ON "pincodes" USING GIST ("boundary");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_state" ON "pincodes" ("state");
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_pincodes_is_active" ON "pincodes" ("is_active");
    `);

    // Create updated_at trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_pincodes_updated_at
      BEFORE UPDATE ON "pincodes"
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_pincodes_updated_at ON "pincodes";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column();`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_is_active";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_state";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_boundary";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_pincodes_pincode";`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "pincodes";`);

    // Note: We don't drop PostGIS extension as other databases might use it
    // await queryRunner.query(`DROP EXTENSION IF EXISTS postgis;`);
  }
}
