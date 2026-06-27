import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMarketplaceConfigTable1719475200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create marketplace_configs table
    await queryRunner.createTable(
      new Table({
        name: 'marketplace_configs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'marketplace_id',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'marketplace_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'secret_key',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'header_name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'user_header_name',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
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
          {
            name: 'rotated_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'marketplace_configs',
      new TableIndex({
        name: 'IDX_marketplace_configs_marketplace_id',
        columnNames: ['marketplace_id'],
      }),
    );

    await queryRunner.createIndex(
      'marketplace_configs',
      new TableIndex({
        name: 'IDX_marketplace_configs_marketplace_id_is_active',
        columnNames: ['marketplace_id', 'is_active'],
      }),
    );

    // Insert default RapidAPI config (placeholder - update with real secret later)
    await queryRunner.query(`
      INSERT INTO marketplace_configs (
        marketplace_id,
        marketplace_name,
        secret_key,
        is_active,
        header_name,
        user_header_name,
        notes
      ) VALUES (
        'rapidapi',
        'RapidAPI',
        'PLACEHOLDER_SECRET_UPDATE_ME',
        false,
        'x-rapidapi-proxy-secret',
        'x-rapidapi-user',
        'Update secret_key and set is_active=true after getting secret from RapidAPI dashboard'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('marketplace_configs');
  }
}
