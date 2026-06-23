import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * AddSpatialIndexToPincodes Migration
 *
 * Creates a PostGIS GIST spatial index on the pincodes.boundary column
 * for fast spatial queries (ST_Intersects, ST_Contains, ST_Within, etc.).
 *
 * GIST (Generalized Search Tree) is PostgreSQL's index type optimized
 * for spatial data. This index is critical for:
 * - Coordinate ↔ Pincode conversion (reverse geocoding)
 * - DIGIPIN ↔ Pincode conversion (spatial validation)
 * - Polygon intersection queries
 * - Point-in-polygon lookups
 * - Distance calculations
 *
 * Performance impact:
 * - Without index: Sequential scan (~1-5 seconds per query on 19K pincodes)
 * - With index: Index scan (~1-10ms per query)
 *
 * Index size: ~10-20MB for 19K polygons
 * Build time: ~5-10 seconds
 */
export class AddSpatialIndexToPincodes1781695686582 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Check if index already exists (idempotent migration)
        const indexExists = await queryRunner.query(`
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'pincodes'
              AND indexname = 'idx_pincode_boundary'
        `);

        if (indexExists.length === 0) {
            console.log('Creating GIST spatial index on pincodes.boundary...');

            // Create GIST index on the geometry column
            // GIST is optimized for 2D spatial queries on PostGIS geometry types
            await queryRunner.query(`
                CREATE INDEX idx_pincode_boundary
                ON pincodes
                USING GIST (boundary)
            `);

            console.log('✅ GIST spatial index created successfully');

            // Analyze the table to update query planner statistics
            await queryRunner.query(`ANALYZE pincodes`);

            console.log('✅ Table statistics updated');
        } else {
            console.log('⏭️  GIST spatial index already exists, skipping');
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the spatial index
        const indexExists = await queryRunner.query(`
            SELECT 1
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND tablename = 'pincodes'
              AND indexname = 'idx_pincode_boundary'
        `);

        if (indexExists.length > 0) {
            console.log('Dropping GIST spatial index...');
            await queryRunner.query(`DROP INDEX IF EXISTS idx_pincode_boundary`);
            console.log('✅ GIST spatial index dropped');
        } else {
            console.log('⏭️  GIST spatial index does not exist, skipping');
        }
    }

}
