import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddH3CellsColumn Migration
 *
 * Adds h3_cells column to pincodes table to store pre-computed H3 hexagons.
 *
 * Benefits:
 * - Single source of truth for pincode → H3 mapping
 * - Eliminates need to recompute H3 cells on every rebuild
 * - Faster rebuilds: just copy from PostgreSQL to Redis
 * - Data consistency between PostgreSQL and Redis
 * - GIN index enables fast reverse lookups (H3 → Pincode)
 *
 * Column: h3_cells text[]
 * - Stores array of H3 hexagon indices as text strings
 * - NULL or empty array for pincodes without boundaries
 * - Computed once during initial index build
 * - Updated only when boundaries change
 * - Using text[] instead of h3index[] for TypeORM compatibility
 */
export class AddH3CellsColumn1781703000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add h3_cells column to store array of H3 indices
    // Use text[] instead of h3index[] for TypeORM compatibility
    // H3 indices are stored as text strings (e.g., '891f1d48817ffff')
    await queryRunner.query(`
      ALTER TABLE pincodes
      ADD COLUMN IF NOT EXISTS h3_cells text[] DEFAULT '{}'
    `);

    // Create GIN index for fast reverse lookups (H3 → Pincode)
    // This enables queries like: SELECT pincode FROM pincodes WHERE '891f...' = ANY(h3_cells)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pincodes_h3_cells_gin 
      ON pincodes USING GIN (h3_cells)
    `);

    console.log('✅ Added h3_cells column with GIN index');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index first
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_pincodes_h3_cells_gin
    `);

    // Drop column
    await queryRunner.query(`
      ALTER TABLE pincodes 
      DROP COLUMN IF EXISTS h3_cells
    `);

    console.log('Removed h3_cells column and index');
  }
}
