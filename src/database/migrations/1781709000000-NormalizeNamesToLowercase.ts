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

    // ========================================
    // Step 1: Drop unique constraint on postoffices
    // ========================================
    console.log('[Migration] Step 1: Checking for unique constraint...');

    // Check if constraint exists first
    const constraintCheck = await queryRunner.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'postoffices'
        AND constraint_name = 'uq_postoffices_pincode_officename'
    `);

    if (constraintCheck && constraintCheck.length > 0) {
      console.log('[Migration] Constraint exists, dropping it...');
      await queryRunner.query(`
        ALTER TABLE postoffices DROP CONSTRAINT uq_postoffices_pincode_officename
      `);
      console.log('[Migration] Constraint dropped successfully');
    } else {
      console.log('[Migration] Constraint does not exist, skipping drop');
    }

    // ========================================
    // Step 2: Normalize pincodes table (simple, no unique constraints)
    // ========================================

    console.log('[Migration] Step 2: Normalizing pincodes table (~19k rows)...');
    console.log('[Migration] Processing state field...');
    const pincodesStart = Date.now();

    await queryRunner.query(`UPDATE pincodes SET state = LOWER(state)`);
    console.log('[Migration] State complete. Processing district field...');

    await queryRunner.query(`UPDATE pincodes SET district = LOWER(district)`);
    console.log('[Migration] District complete. Processing city field...');

    await queryRunner.query(`UPDATE pincodes SET city = LOWER(city)`);
    console.log('[Migration] City complete. Processing office_name field...');

    await queryRunner.query(`UPDATE pincodes SET office_name = LOWER(office_name)`);
    console.log('[Migration] Office_name complete.');

    console.log(`[Migration] Pincodes COMPLETE in ${Date.now() - pincodesStart}ms`);

    // ========================================
    // Step 3: Normalize postoffices table
    // ========================================

    console.log('[Migration] Step 3: Normalizing postoffices table (~165k rows)...');
    const postofficesStart = Date.now();

    console.log('[Migration] 3.1: Updating officename field...');
    await queryRunner.query(`UPDATE postoffices SET officename = LOWER(officename)`);
    console.log(`[Migration] 3.1: Officename complete (${Date.now() - postofficesStart}ms)`);

    console.log('[Migration] 3.2: Updating area field...');
    let fieldStart = Date.now();
    await queryRunner.query(`UPDATE postoffices SET area = LOWER(area)`);
    console.log(`[Migration] 3.2: Area complete (${Date.now() - fieldStart}ms)`);

    console.log('[Migration] 3.3: Updating district field...');
    fieldStart = Date.now();
    await queryRunner.query(`UPDATE postoffices SET district = LOWER(district)`);
    console.log(`[Migration] 3.3: District complete (${Date.now() - fieldStart}ms)`);

    console.log('[Migration] 3.4: Updating state field...');
    fieldStart = Date.now();
    await queryRunner.query(`UPDATE postoffices SET state = LOWER(state)`);
    console.log(`[Migration] 3.4: State complete (${Date.now() - fieldStart}ms)`);

    console.log('[Migration] 3.5: Updating division field...');
    fieldStart = Date.now();
    await queryRunner.query(`UPDATE postoffices SET division = LOWER(division)`);
    console.log(`[Migration] 3.5: Division complete (${Date.now() - fieldStart}ms)`);

    console.log('[Migration] 3.6: Updating region field...');
    fieldStart = Date.now();
    await queryRunner.query(`UPDATE postoffices SET region = LOWER(region)`);
    console.log(`[Migration] 3.6: Region complete (${Date.now() - fieldStart}ms)`);

    console.log('[Migration] 3.7: Updating circle field...');
    fieldStart = Date.now();
    await queryRunner.query(`UPDATE postoffices SET circle = LOWER(circle)`);
    console.log(`[Migration] 3.7: Circle complete (${Date.now() - fieldStart}ms)`);

    console.log(`[Migration] Postoffices normalized in ${Date.now() - postofficesStart}ms`);

    // ========================================
    // Step 4: Deduplicate postoffices (keep oldest row per pincode+officename)
    // ========================================

    console.log('[Migration] Step 4: Deduplicating postoffices...');
    const dedupeStart = Date.now();

    const dedupeResult = await queryRunner.query(`
      DELETE FROM postoffices
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM postoffices
        GROUP BY pincode, officename
      )
    `);

    const deletedCount = dedupeResult[1] || 0;
    console.log(`[Migration] Deleted ${deletedCount} duplicate rows in ${Date.now() - dedupeStart}ms`);

    // ========================================
    // Step 5: Re-add unique constraint
    // ========================================

    console.log('[Migration] Step 5: Re-adding unique constraint...');
    await queryRunner.query(`
      ALTER TABLE postoffices
      ADD CONSTRAINT uq_postoffices_pincode_officename
      UNIQUE (pincode, officename)
    `);
    console.log('[Migration] Constraint re-added successfully');

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
