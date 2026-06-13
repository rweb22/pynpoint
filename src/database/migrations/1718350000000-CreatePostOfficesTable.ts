import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Migration: CreatePostOfficesTable
 *
 * Creates the postoffices table for storing individual post office records.
 *
 * Schema:
 * - 165,627 post offices from BharatPin 2026 dataset
 * - Multiple offices per pincode (HO, SO, BO types)
 * - GPS coordinates for ~92.7% of offices
 * - Foreign key to pincodes table (nullable - some pincodes in CSV may not have boundaries)
 *
 * Indexes:
 * - pincode (B-tree)
 * - state (B-tree)
 * - district (B-tree)
 * - area (B-tree)
 * - officetype (B-tree)
 * - delivery (B-tree)
 * - is_active (B-tree)
 */
export class CreatePostOfficesTable1718350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create postoffices table
    await queryRunner.createTable(
      new Table({
        name: 'postoffices',
        columns: [
          {
            name: 'id',
            type: 'serial',
            isPrimary: true,
          },
          {
            name: 'pincode',
            type: 'varchar',
            length: '6',
            isNullable: false,
          },
          {
            name: 'officename',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'area',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'officetype',
            type: 'varchar',
            length: '2',
            isNullable: false,
          },
          {
            name: 'delivery',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'district',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'state',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'division',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'region',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'circle',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'latitude',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          {
            name: 'longitude',
            type: 'decimal',
            precision: 10,
            scale: 7,
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_pincode',
        columnNames: ['pincode'],
      }),
    );

    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_state',
        columnNames: ['state'],
      }),
    );

    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_district',
        columnNames: ['district'],
      }),
    );

    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_area',
        columnNames: ['area'],
      }),
    );

    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_officetype',
        columnNames: ['officetype'],
      }),
    );

    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_delivery',
        columnNames: ['delivery'],
      }),
    );

    await queryRunner.createIndex(
      'postoffices',
      new TableIndex({
        name: 'idx_postoffices_is_active',
        columnNames: ['is_active'],
      }),
    );

    // Create foreign key to pincodes table (optional - nullable)
    await queryRunner.createForeignKey(
      'postoffices',
      new TableForeignKey({
        columnNames: ['pincode'],
        referencedColumnNames: ['pincode'],
        referencedTableName: 'pincodes',
        onDelete: 'SET NULL',
      }),
    );

    // Create trigger to auto-update updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_postoffices_updated_at
      BEFORE UPDATE ON postoffices
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop trigger
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_postoffices_updated_at ON postoffices;`);

    // Drop foreign key
    const table = await queryRunner.getTable('postoffices');
    const foreignKey = table?.foreignKeys.find((fk) => fk.columnNames.indexOf('pincode') !== -1);
    if (foreignKey) {
      await queryRunner.dropForeignKey('postoffices', foreignKey);
    }

    // Drop table (indexes will be dropped automatically)
    await queryRunner.dropTable('postoffices');
  }
}