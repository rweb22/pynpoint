import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * MarketplaceConfig Entity
 * 
 * Stores configuration for API marketplace integrations (RapidAPI, AWS, Azure, etc.)
 * 
 * Each marketplace can have multiple secrets for rotation.
 * Secrets are loaded into memory on application startup and cached.
 * 
 * Example records:
 * - marketplace_id: 'rapidapi', secret_key: 'prod-secret-abc123', is_active: true
 * - marketplace_id: 'aws-marketplace', secret_key: 'aws-token-xyz789', is_active: true
 * - marketplace_id: 'rapidapi', secret_key: 'old-secret-def456', is_active: false (rotated)
 */
@Entity('marketplace_configs')
@Index(['marketplace_id', 'is_active'])
export class MarketplaceConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Marketplace identifier
   * Values: 'rapidapi', 'aws-marketplace', 'azure-marketplace', 'apigee', etc.
   */
  @Column({ type: 'varchar', length: 50 })
  @Index()
  marketplace_id: string;

  /**
   * Display name for admin UI
   */
  @Column({ type: 'varchar', length: 100 })
  marketplace_name: string;

  /**
   * Secret key/token for validating requests from this marketplace
   * This is the value sent in the marketplace's proxy header
   */
  @Column({ type: 'varchar', length: 500 })
  secret_key: string;

  /**
   * Whether this secret is currently active
   * Use this to rotate secrets without deleting old ones
   */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /**
   * HTTP header name to look for
   * Examples: 'x-rapidapi-proxy-secret', 'x-aws-marketplace-token'
   */
  @Column({ type: 'varchar', length: 100 })
  header_name: string;

  /**
   * HTTP header name for user/customer ID
   * Examples: 'x-rapidapi-user', 'x-aws-marketplace-customer-id'
   */
  @Column({ type: 'varchar', length: 100, nullable: true })
  user_header_name: string;

  /**
   * Additional metadata (JSON)
   * Can store marketplace-specific config like API endpoints, documentation URLs, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  /**
   * Notes for admin reference
   */
  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /**
   * When this secret was last rotated (if applicable)
   */
  @Column({ type: 'timestamp', nullable: true })
  rotated_at: Date;

  /**
   * When this secret expires (optional)
   */
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;
}
