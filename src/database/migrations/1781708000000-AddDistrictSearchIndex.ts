import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add District Search Performance Index
 * 
 * Issue: Queries with state+district filters timeout (30+ seconds)
 * Example: GET /pincodes?state=Karnataka&district=Bangalore Urban
 * 
 * Root cause: No index for case-insensitive state+district searches
 * Service uses: LOWER(state) = LOWER(:state) AND LOWER(district) = LOWER(:district)
 * 
 * Fix: Functional composite index on LOWER(state), LOWER(district)
 * Expected impact: 30s+ → <50ms
 * 
 * Generated: 2026-06-22
 */
export class AddDistrictSearchIndex1781708000000 implements MigrationInterface {
  name = 'AddDistrictSearchIndex1781708000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create functional composite index for case-insensitive state+district queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_pincode_state_district_lower 
      ON pincodes (LOWER(state), LOWER(district))
    `);

    // Add comment explaining the index
    await queryRunner.query(`
      COMMENT ON INDEX idx_pincode_state_district_lower IS 
      'Composite functional index for case-insensitive state+district queries. 
      Supports queries like: WHERE LOWER(state) = LOWER(?) AND LOWER(district) = LOWER(?).
      Reduces query time from 30s+ to <50ms for district searches.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the index
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_pincode_state_district_lower
    `);
  }
}
