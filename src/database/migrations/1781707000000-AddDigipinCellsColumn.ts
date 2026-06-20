import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddDigipinCellsColumn Migration
 *
 * Adds digipin_cells column to pincodes table to store pre-computed DIGIPIN Level 6 codes.
 *
 * Benefits:
 * - Single source of truth for pincode → DIGIPIN mapping
 * - Enables fast reverse lookups (DIGIPIN → Pincode) via GIN index
 * - ~200m resolution grid cells for precise location matching
 * - Complements H3 hexagons with official India Post standard
 *
 * Column: digipin_cells text[]
 * - Stores array of 6-character DIGIPIN codes (e.g., '39J438', '39J49L')
 * - NULL or empty array for pincodes without boundaries
 * - Grid spacing: 200m for balance between coverage and performance
 * - Character set: F,C,9,8,3,2,J,K,L,M,P,T,4,5,6,7 (official India Post)
 *
 * Performance:
 * - Estimated 82M total cells across 19,312 pincodes
 * - Avg ~4,244 cells per pincode
 * - Small pincodes: 0-100 cells
 * - Medium pincodes: 24-250 cells
 * - Large pincodes: up to 1M cells (safety limit)
 */
export class AddDigipinCellsColumn1781707000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Adding digipin_cells column...');

    // Add digipin_cells column
    await queryRunner.query(`
      ALTER TABLE pincodes
      ADD COLUMN IF NOT EXISTS digipin_cells text[] DEFAULT '{}'
    `);

    // Create GIN index for fast reverse lookups (DIGIPIN → Pincode)
    // Enables queries like: SELECT pincode FROM pincodes WHERE '39J438' = ANY(digipin_cells)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pincodes_digipin_cells_gin 
      ON pincodes USING GIN (digipin_cells)
    `);

    console.log('✅ Added digipin_cells column with GIN index');
    console.log(
      '⏳ Note: Column is empty. Run population script separately to fill cells.',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Dropping digipin_cells column...');

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_pincodes_digipin_cells_gin
    `);

    await queryRunner.query(`
      ALTER TABLE pincodes 
      DROP COLUMN IF EXISTS digipin_cells
    `);

    console.log('Removed digipin_cells column and index');
  }
}
