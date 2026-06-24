import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 02: CreatePostOfficesTable
 *
 * Creates the complete postoffices table with all columns, indexes, constraints, FK, and triggers.
 *
 * Schema:
 * - 165,627 post office records expected
 * - Multiple offices per pincode (HO, SO, BO types)
 * - GPS coordinates for ~92.7% of offices
 * - All text normalized to lowercase
 *
 * Relationships:
 * - Foreign key to pincodes(pincode) with ON DELETE SET NULL
 * - Unique constraint on (pincode, officename) to prevent duplicates
 *
 * Indexes:
 * - 8 B-tree indexes for efficient filtering
 * - Composite index on (latitude, longitude) for GPS queries
 *
 * Generated: 2026-06-24
 */
export class CreatePostOfficesTable1700000000002 implements MigrationInterface {
  name = 'CreatePostOfficesTable1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] CreatePostOfficesTable - Starting...');

    // Create postoffices table
    await queryRunner.query(`
      CREATE TABLE postoffices (
        id SERIAL PRIMARY KEY,
        pincode VARCHAR(6) NOT NULL,
        officename VARCHAR(200) NOT NULL,
        area VARCHAR(200) NULL,
        officetype VARCHAR(2) NOT NULL,
        delivery VARCHAR(20) NOT NULL,
        district VARCHAR(100) NULL,
        state VARCHAR(100) NULL,
        division VARCHAR(100) NULL,
        region VARCHAR(100) NULL,
        circle VARCHAR(100) NULL,
        latitude DECIMAL(10, 7) NULL,
        longitude DECIMAL(10, 7) NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migration] ✅ Table created');

    // Create B-tree indexes
    await queryRunner.query(`CREATE INDEX idx_postoffices_pincode ON postoffices(pincode);`);
    await queryRunner.query(`CREATE INDEX idx_postoffices_state ON postoffices(state);`);
    await queryRunner.query(`CREATE INDEX idx_postoffices_district ON postoffices(district);`);
    await queryRunner.query(`CREATE INDEX idx_postoffices_area ON postoffices(area);`);
    await queryRunner.query(`CREATE INDEX idx_postoffices_officetype ON postoffices(officetype);`);
    await queryRunner.query(`CREATE INDEX idx_postoffices_delivery ON postoffices(delivery);`);
    await queryRunner.query(`CREATE INDEX idx_postoffices_is_active ON postoffices(is_active);`);
    console.log('[Migration] ✅ B-tree indexes created (7)');

    // Create composite index on GPS coordinates
    await queryRunner.query(`
      CREATE INDEX idx_postoffices_coords ON postoffices(latitude, longitude);
    `);
    console.log('[Migration] ✅ Composite GPS index');

    // Add unique constraint on (pincode, officename)
    await queryRunner.query(`
      ALTER TABLE postoffices
      ADD CONSTRAINT uq_postoffices_pincode_officename
      UNIQUE (pincode, officename);
    `);
    console.log('[Migration] ✅ Unique constraint (pincode, officename)');

    // Add foreign key to pincodes table
    await queryRunner.query(`
      ALTER TABLE postoffices
      ADD CONSTRAINT fk_postoffices_pincode
      FOREIGN KEY (pincode)
      REFERENCES pincodes(pincode)
      ON DELETE SET NULL;
    `);
    console.log('[Migration] ✅ Foreign key to pincodes');

    // Create trigger for auto-updating updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_postoffices_updated_at
      BEFORE UPDATE ON postoffices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('[Migration] ✅ Trigger attached');

    // Add table comment
    await queryRunner.query(`
      COMMENT ON TABLE postoffices IS 
      'Indian post office directory (165,627 records). Includes GPS coordinates, office types, and postal hierarchy.
      All text normalized to lowercase. Area field may be null for official JSON data.';
    `);

    console.log('[Migration] CreatePostOfficesTable - Complete');
    console.log('[Migration] Summary: 1 table, 8 indexes, 1 unique constraint, 1 FK, 1 trigger');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] CreatePostOfficesTable - Rollback...');

    // Drop trigger
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_postoffices_updated_at ON postoffices;`);

    // Drop table (constraints and indexes are dropped automatically)
    await queryRunner.query(`DROP TABLE IF EXISTS postoffices;`);

    console.log('[Migration] CreatePostOfficesTable - Rollback complete');
  }
}
