import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

/**
 * Migration: Add unique constraint to postoffices table
 * 
 * Reason:
 * - Multiple failed deployments caused duplicate post office records
 * - Same (pincode, officename) combination was inserted multiple times
 * - Need to prevent future duplicates during CSV re-ingestion
 * 
 * Solution:
 * - Add UNIQUE constraint on (pincode, officename) columns
 * - This ensures each post office can only be inserted once
 * - If CSV re-ingestion is attempted, duplicates will be rejected
 * 
 * Note: Run deduplication BEFORE applying this migration:
 *   DELETE FROM postoffices WHERE id NOT IN (
 *     SELECT MIN(id) FROM postoffices GROUP BY pincode, officename
 *   );
 */
export class AddPostOfficeUniqueConstraint1718380000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add unique constraint on (pincode, officename)
    await queryRunner.createUniqueConstraint(
      'postoffices',
      new TableUnique({
        name: 'uq_postoffices_pincode_officename',
        columnNames: ['pincode', 'officename'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the unique constraint
    await queryRunner.dropUniqueConstraint(
      'postoffices',
      'uq_postoffices_pincode_officename',
    );
  }
}
