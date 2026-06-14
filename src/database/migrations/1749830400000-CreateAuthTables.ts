import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Auth Tables Migration
 * 
 * This migration:
 * 1. Creates api_keys table for API authentication
 * 2. Creates api_usage table for usage tracking
 * 3. Creates indexes for performance
 * 
 * Architecture: Decoupled (no Customer table)
 * - API keys reference external_customer_id (string, no FK)
 * - Tier stored locally for fast lookup
 * - Usage tracked per customer per day per endpoint
 * 
 * Generated: 2026-06-14
 */
export class CreateAuthTables1749830400000 implements MigrationInterface {
  name = 'CreateAuthTables1749830400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create api_keys table
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_customer_id" VARCHAR(255) NOT NULL,
        "prefix" VARCHAR(20) NOT NULL,
        "key_hash" VARCHAR(64) NOT NULL,
        "environment" VARCHAR(10) NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
        "tier" VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business', 'enterprise')),
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expires_at" TIMESTAMP NULL,
        "last_used_at" TIMESTAMP NULL,
        "rate_limit_overrides" JSONB NULL,
        "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);

    // Create indexes on api_keys
    await queryRunner.query(`CREATE INDEX "idx_api_keys_prefix" ON "api_keys" ("prefix");`);
    await queryRunner.query(`CREATE INDEX "idx_api_keys_external_customer_id" ON "api_keys" ("external_customer_id");`);
    await queryRunner.query(`CREATE INDEX "idx_api_keys_active_expires" ON "api_keys" ("is_active", "expires_at");`);
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_api_keys_key_hash" ON "api_keys" ("key_hash");`);

    // Create api_usage table
    await queryRunner.query(`
      CREATE TABLE "api_usage" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_customer_id" VARCHAR(255) NOT NULL,
        "date" DATE NOT NULL,
        "endpoint" VARCHAR(255) NOT NULL,
        "request_count" INTEGER NOT NULL DEFAULT 0,
        "success_count" INTEGER NOT NULL DEFAULT 0,
        "error_count" INTEGER NOT NULL DEFAULT 0,
        "avg_response_time_ms" DECIMAL(10, 2) NOT NULL DEFAULT 0,
        "status_codes" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "metadata" JSONB NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes on api_usage
    await queryRunner.query(`CREATE INDEX "idx_api_usage_customer_date" ON "api_usage" ("external_customer_id", "date");`);
    await queryRunner.query(`CREATE INDEX "idx_api_usage_date" ON "api_usage" ("date");`);
    await queryRunner.query(`CREATE INDEX "idx_api_usage_endpoint" ON "api_usage" ("endpoint");`);
    
    // Create unique constraint to prevent duplicate entries
    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_api_usage_unique" 
      ON "api_usage" ("external_customer_id", "date", "endpoint");
    `);

    // Create trigger to update updated_at column on api_keys
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_api_keys_updated_at
      BEFORE UPDATE ON api_keys
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_api_usage_updated_at
      BEFORE UPDATE ON api_usage
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create partial index for active keys (most common query)
    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_active_only" 
      ON "api_keys" ("external_customer_id", "is_active") 
      WHERE "is_active" = true;
    `);

    // Create index for expired keys cleanup
    await queryRunner.query(`
      CREATE INDEX "idx_api_keys_expired" 
      ON "api_keys" ("expires_at") 
      WHERE "expires_at" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_api_usage_updated_at ON api_usage;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS update_updated_at_column();`);

    // Drop tables (indexes are dropped automatically)
    await queryRunner.query(`DROP TABLE IF EXISTS "api_usage";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys";`);
  }
}
