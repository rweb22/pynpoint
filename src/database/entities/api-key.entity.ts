import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  Index, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm';

/**
 * ApiKey Entity
 * 
 * Stores API keys for authentication and authorization.
 * 
 * Architecture: Decoupled (no Customer entity)
 * - external_customer_id: Customer ID from main website (e.g., Stripe customer ID)
 * - No foreign key relationship (customer managed externally)
 * - Tier stored locally for fast lookup (avoids external calls on every request)
 * 
 * Security:
 * - Only SHA-256 hash is stored (never plaintext)
 * - Prefix stored for display purposes (e.g., "ppk_live_sk_a8f")
 * - Full key returned ONCE during generation
 * 
 * Key Format: ppk_{env}_{type}_{random}_{checksum}
 * - ppk: Prefix for leak detection (GitHub scanning)
 * - env: live | test
 * - type: sk (secret key) | pk (public key)
 * - random: 24 random alphanumeric characters
 * - checksum: 4-char Luhn checksum
 * 
 * Example: ppk_live_sk_a8f2c1d4e5f6g7h8i9j0k1l2_c4f9
 */
@Entity('api_keys')
@Index(['prefix'])
@Index(['external_customer_id'])
@Index(['is_active', 'expires_at'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Customer ID from main website (Stripe customer ID, user UUID, etc.)
   * No foreign key relationship - customer managed externally
   */
  @Column({ type: 'varchar', length: 255 })
  external_customer_id: string;

  /**
   * Key prefix for display (e.g., "ppk_live_sk_a8f")
   * Shown in developer portal, never reveals full key
   */
  @Column({ type: 'varchar', length: 20 })
  prefix: string;

  /**
   * SHA-256 hash of full API key
   * Never store plaintext keys
   */
  @Column({ type: 'varchar', length: 64 })
  key_hash: string;

  /**
   * Environment: live or test
   * Test keys can only access test data
   */
  @Column({ type: 'enum', enum: ['live', 'test'], default: 'live' })
  environment: 'live' | 'test';

  /**
   * Subscription tier
   * Stored locally to avoid external lookups on every request
   * Updated via Admin API when customer upgrades/downgrades
   */
  @Column({ type: 'enum', enum: ['free', 'pro', 'business', 'enterprise'], default: 'free' })
  tier: 'free' | 'pro' | 'business' | 'enterprise';

  /**
   * Active status
   * Set to false when key is revoked
   */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /**
   * Creation timestamp
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Last update timestamp
   */
  @UpdateDateColumn()
  updated_at: Date;

  /**
   * Optional expiration date
   * NULL = no expiration
   * Used for temporary keys or trial periods
   */
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  /**
   * Last time this key was used for a request
   * Updated asynchronously (not on every request to avoid DB load)
   */
  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date | null;

  /**
   * Optional per-key rate limit overrides
   * Used for enterprise customers with custom limits
   * NULL = use tier defaults
   */
  @Column({ type: 'jsonb', nullable: true })
  rate_limit_overrides: {
    requests_per_minute?: number;
    requests_per_day?: number;
    requests_per_second?: number;
  } | null;

  /**
   * Additional metadata (JSONB)
   * - name: User-friendly key name
   * - description: What this key is used for
   * - allowed_ips: IP whitelist (array of CIDR ranges)
   * - scopes: Permissions (e.g., ["read:pincodes", "read:digipin"])
   * - provisioned_by: User ID who created this key (for audit)
   * - notes: Internal notes
   */
  @Column({ type: 'jsonb', default: {} })
  metadata: {
    name?: string;
    description?: string;
    allowed_ips?: string[];
    scopes?: string[];
    provisioned_by?: string;
    notes?: string;
  };
}
