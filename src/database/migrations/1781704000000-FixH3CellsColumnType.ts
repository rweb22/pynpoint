import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FixH3CellsColumnType Migration
 *
 * Fixes h3_cells column type from h3index[] to text[] for TypeORM compatibility.
 *
 * Problem:
 * - Previous migration created h3index[] column
 * - TypeORM doesn't understand custom h3index type
 * - When reading h3index[], TypeORM returns PostgreSQL array literal string
 * - Result: "{891f...,891f...}" string instead of ['891f...', '891f...'] array
 * - Iteration over string gives individual characters: '{', ',', '}', etc.
 * - Redis gets malformed keys like "h3:{" and "h3:}"
 *
 * Solution:
 * - Drop existing h3_cells column
 * - Recreate as text[] (TypeORM compatible)
 * - Data will be repopulated by H3IndexService on next rebuild
 */
export class FixH3CellsColumnType1781704000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the malformed h3index[] column
    await queryRunner.query(`
      ALTER TABLE pincodes 
      DROP COLUMN IF EXISTS h3_cells
    `);

    // Recreate as text[] for TypeORM compatibility
    await queryRunner.query(`
      ALTER TABLE pincodes 
      ADD COLUMN h3_cells text[] DEFAULT '{}'
    `);

    // Recreate GIN index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pincodes_h3_cells_gin 
      ON pincodes USING GIN (h3_cells)
    `);

    console.log('✅ Fixed h3_cells column type to text[]');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to h3index[] (not recommended)
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_pincodes_h3_cells_gin
    `);

    await queryRunner.query(`
      ALTER TABLE pincodes 
      DROP COLUMN IF EXISTS h3_cells
    `);

    await queryRunner.query(`
      ALTER TABLE pincodes 
      ADD COLUMN h3_cells h3index[] DEFAULT '{}'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pincodes_h3_cells_gin 
      ON pincodes USING GIN (h3_cells)
    `);

    console.log('Reverted h3_cells to h3index[]');
  }
}
