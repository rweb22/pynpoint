import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration 03: CreateAuthTables
 *
 * Creates API authentication and usage tracking tables.
 *
 * Tables:
 * 1. api_keys - API key storage (hashed), tier management, rate limits
 * 2. api_usage - Daily usage statistics per customer per endpoint
 *
 * Architecture: Decoupled
 * - No Customer table (managed externally)
 * - external_customer_id references main website
 * - Tier stored locally for fast lookup
 *
 * Security:
 * - Only SHA-256 hash stored (never plaintext)
 * - Prefix stored for display (e.g., "ppk_live_sk_a8f")
 * - Full key returned ONCE during generation
 *
 * Generated: 2026-06-24
 */
export class CreateAuthTables1700000000003 implements MigrationInterface {
  name = 'CreateAuthTables1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] CreateAuthTables - Starting...');

    // Create api_keys table
    await queryRunner.query(`
      CREATE TABLE api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_customer_id VARCHAR(255) NOT NULL,
        prefix VARCHAR(20) NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        environment VARCHAR(10) NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
        tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'business', 'enterprise')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        last_used_at TIMESTAMP NULL,
        rate_limit_overrides JSONB NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      );
    `);
    console.log('[Migration] ✅ api_keys table created');

    // Create indexes on api_keys
    await queryRunner.query(`CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);`);
    await queryRunner.query(`CREATE INDEX idx_api_keys_external_customer_id ON api_keys(external_customer_id);`);
    await queryRunner.query(`CREATE INDEX idx_api_keys_active_expires ON api_keys(is_active, expires_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_api_keys_key_hash ON api_keys(key_hash);`);
    
    // Partial index for active keys (most common query)
    await queryRunner.query(`
      CREATE INDEX idx_api_keys_active_only 
      ON api_keys(external_customer_id, is_active) 
      WHERE is_active = true;
    `);
    
    // Index for expired keys cleanup
    await queryRunner.query(`
      CREATE INDEX idx_api_keys_expired 
      ON api_keys(expires_at) 
      WHERE expires_at IS NOT NULL;
    `);
    console.log('[Migration] ✅ api_keys indexes created (6)');

    // Create api_usage table
    await queryRunner.query(`
      CREATE TABLE api_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_customer_id VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        endpoint VARCHAR(255) NOT NULL,
        request_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        avg_response_time_ms DECIMAL(10, 2) NOT NULL DEFAULT 0,
        status_codes JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[Migration] ✅ api_usage table created');

    // Create indexes on api_usage
    await queryRunner.query(`CREATE INDEX idx_api_usage_customer_date ON api_usage(external_customer_id, date);`);
    await queryRunner.query(`CREATE INDEX idx_api_usage_date ON api_usage(date);`);
    await queryRunner.query(`CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);`);
    
    // Unique constraint to prevent duplicate entries
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_api_usage_unique 
      ON api_usage(external_customer_id, date, endpoint);
    `);
    console.log('[Migration] ✅ api_usage indexes created (4)');

    // Create triggers for auto-updating updated_at
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
    console.log('[Migration] ✅ Triggers attached (2)');

    // Add table comments
    await queryRunner.query(`
      COMMENT ON TABLE api_keys IS 
      'API key authentication. Stores SHA-256 hash only. Decoupled from customer management.';
    `);

    await queryRunner.query(`
      COMMENT ON TABLE api_usage IS 
      'Daily API usage statistics per customer per endpoint. Used for billing and analytics.';
    `);

    console.log('[Migration] CreateAuthTables - Complete');
    console.log('[Migration] Summary: 2 tables, 10 indexes, 2 triggers');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('[Migration] CreateAuthTables - Rollback...');

    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_api_usage_updated_at ON api_usage;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;`);

    // Drop tables (indexes are dropped automatically)
    await queryRunner.query(`DROP TABLE IF EXISTS api_usage;`);
    await queryRunner.query(`DROP TABLE IF EXISTS api_keys;`);

    console.log('[Migration] CreateAuthTables - Rollback complete');
  }
}
