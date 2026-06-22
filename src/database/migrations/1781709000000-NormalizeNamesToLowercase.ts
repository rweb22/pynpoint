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
    const overallStart = Date.now();

    // Process in batches with progress logging to avoid Railway log limits
    // and provide visibility into migration progress

    // ========================================
    // Normalize pincodes table in batches
    // ========================================

    console.log('[Migration] Step 1/2: Normalizing pincodes table...');

    // Get total count
    const pincodesCountResult = await queryRunner.query('SELECT COUNT(*) as count FROM pincodes');
    const totalPincodes = parseInt(pincodesCountResult[0].count);
    console.log(`[Migration] Total pincodes to process: ${totalPincodes}`);

    const pincodesBatchSize = 5000;
    let pincodesProcessed = 0;
    const pincodesStart = Date.now();

    while (pincodesProcessed < totalPincodes) {
      const batchStart = Date.now();

      await queryRunner.query(`
        UPDATE pincodes
        SET
          state = LOWER(state),
          district = LOWER(district),
          city = LOWER(city),
          office_name = LOWER(office_name)
        WHERE id IN (
          SELECT id FROM pincodes
          ORDER BY id
          LIMIT ${pincodesBatchSize}
          OFFSET ${pincodesProcessed}
        )
      `);

      pincodesProcessed += pincodesBatchSize;
      const progress = Math.min(100, Math.round((pincodesProcessed / totalPincodes) * 100));
      console.log(`[Migration] Pincodes: ${Math.min(pincodesProcessed, totalPincodes)}/${totalPincodes} (${progress}%) - batch took ${Date.now() - batchStart}ms`);
    }

    console.log(`[Migration] Pincodes COMPLETE in ${Date.now() - pincodesStart}ms`);

    // ========================================
    // Normalize postoffices table in batches
    // ========================================

    console.log('[Migration] Step 2/2: Normalizing postoffices table...');

    // Get total count
    const postofficesCountResult = await queryRunner.query('SELECT COUNT(*) as count FROM postoffices');
    const totalPostoffices = parseInt(postofficesCountResult[0].count);
    console.log(`[Migration] Total postoffices to process: ${totalPostoffices}`);

    const postofficesBatchSize = 10000;
    let postofficesProcessed = 0;
    const postofficesStart = Date.now();

    while (postofficesProcessed < totalPostoffices) {
      const batchStart = Date.now();

      await queryRunner.query(`
        UPDATE postoffices
        SET
          officename = LOWER(officename),
          area = LOWER(area),
          district = LOWER(district),
          state = LOWER(state),
          division = LOWER(division),
          region = LOWER(region),
          circle = LOWER(circle)
        WHERE id IN (
          SELECT id FROM postoffices
          ORDER BY id
          LIMIT ${postofficesBatchSize}
          OFFSET ${postofficesProcessed}
        )
      `);

      postofficesProcessed += postofficesBatchSize;
      const progress = Math.min(100, Math.round((postofficesProcessed / totalPostoffices) * 100));
      console.log(`[Migration] Postoffices: ${Math.min(postofficesProcessed, totalPostoffices)}/${totalPostoffices} (${progress}%) - batch took ${Date.now() - batchStart}ms`);
    }

    console.log(`[Migration] Postoffices COMPLETE in ${Date.now() - postofficesStart}ms`);
    console.log(`[Migration] NormalizeNamesToLowercase - COMPLETE ✓ (total: ${Date.now() - overallStart}ms)`);
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
