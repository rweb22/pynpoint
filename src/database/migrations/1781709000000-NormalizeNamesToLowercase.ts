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
    console.log('[Migration] NormalizeNamesToLowercase - Starting migration...');

    // Normalize all text fields to lowercase in a single UPDATE per table
    // This is more efficient than multiple UPDATE statements

    // ========================================
    // Normalize pincodes table - Single UPDATE
    // ========================================

    console.log('[Migration] Normalizing pincodes table...');
    const startPincodes = Date.now();

    const pincodesResult = await queryRunner.query(`
      UPDATE pincodes
      SET
        state = LOWER(state),
        district = LOWER(district),
        city = LOWER(city),
        office_name = LOWER(office_name)
      WHERE
        state IS NOT NULL
        OR district IS NOT NULL
        OR city IS NOT NULL
        OR office_name IS NOT NULL
    `);

    console.log(`[Migration] Pincodes normalized in ${Date.now() - startPincodes}ms`);

    // ========================================
    // Normalize postoffices table - Single UPDATE
    // ========================================

    console.log('[Migration] Normalizing postoffices table...');
    const startPostoffices = Date.now();

    const postofficesResult = await queryRunner.query(`
      UPDATE postoffices
      SET
        officename = LOWER(officename),
        area = LOWER(area),
        district = LOWER(district),
        state = LOWER(state),
        division = LOWER(division),
        region = LOWER(region),
        circle = LOWER(circle)
      WHERE
        officename IS NOT NULL
        OR area IS NOT NULL
        OR district IS NOT NULL
        OR state IS NOT NULL
        OR division IS NOT NULL
        OR region IS NOT NULL
        OR circle IS NOT NULL
    `);

    console.log(`[Migration] Postoffices normalized in ${Date.now() - startPostoffices}ms`);
    console.log('[Migration] NormalizeNamesToLowercase - COMPLETE');
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
