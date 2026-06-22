import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalize All Names To Lowercase
 * 
 * Issue: Mixed-case state/district/city names cause duplicates in administrative endpoints
 * Example: "Andhra Pradesh" and "andhra pradesh" appear as separate states
 * 
 * Fix: Normalize all administrative names to lowercase for consistency
 * 
 * Affected tables:
 * - pincodes: state, district, city, office_name
 * - postoffices: state, district, area, officename, division, region, circle
 * 
 * Performance: ~1-2 seconds (19k pincodes + 165k postoffices)
 * Breaking: No (all queries already use LOWER() for case-insensitive search)
 * 
 * Generated: 2026-06-22
 */
export class NormalizeNamesToLowercase1781709000000 implements MigrationInterface {
  name = 'NormalizeNamesToLowercase1781709000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========================================
    // Normalize pincodes table
    // ========================================
    
    await queryRunner.query(`
      UPDATE pincodes 
      SET state = LOWER(state) 
      WHERE state IS NOT NULL 
        AND state != LOWER(state)
    `);

    await queryRunner.query(`
      UPDATE pincodes 
      SET district = LOWER(district) 
      WHERE district IS NOT NULL 
        AND district != LOWER(district)
    `);

    await queryRunner.query(`
      UPDATE pincodes 
      SET city = LOWER(city) 
      WHERE city IS NOT NULL 
        AND city != LOWER(city)
    `);

    await queryRunner.query(`
      UPDATE pincodes 
      SET office_name = LOWER(office_name) 
      WHERE office_name IS NOT NULL 
        AND office_name != LOWER(office_name)
    `);

    // ========================================
    // Normalize postoffices table
    // ========================================

    await queryRunner.query(`
      UPDATE postoffices 
      SET officename = LOWER(officename) 
      WHERE officename IS NOT NULL 
        AND officename != LOWER(officename)
    `);

    await queryRunner.query(`
      UPDATE postoffices 
      SET area = LOWER(area) 
      WHERE area IS NOT NULL 
        AND area != LOWER(area)
    `);

    await queryRunner.query(`
      UPDATE postoffices 
      SET district = LOWER(district) 
      WHERE district IS NOT NULL 
        AND district != LOWER(district)
    `);

    await queryRunner.query(`
      UPDATE postoffices 
      SET state = LOWER(state) 
      WHERE state IS NOT NULL 
        AND state != LOWER(state)
    `);

    await queryRunner.query(`
      UPDATE postoffices 
      SET division = LOWER(division) 
      WHERE division IS NOT NULL 
        AND division != LOWER(division)
    `);

    await queryRunner.query(`
      UPDATE postoffices 
      SET region = LOWER(region) 
      WHERE region IS NOT NULL 
        AND region != LOWER(region)
    `);

    await queryRunner.query(`
      UPDATE postoffices 
      SET circle = LOWER(circle) 
      WHERE circle IS NOT NULL 
        AND circle != LOWER(circle)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting this migration is not practical as we don't have the original case
    // The data was inconsistent to begin with, so there's no "correct" state to revert to
    // If needed, re-import from original data sources
    this.logger.warn(
      'NormalizeNamesToLowercase migration cannot be reverted. ' +
      'Original case information was lost. Re-import data if needed.'
    );
  }

  private logger = {
    warn: (message: string) => console.warn(`[Migration] ${message}`),
  };
}
