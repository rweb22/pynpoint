import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  Index,
  CreateDateColumn,
  UpdateDateColumn
} from 'typeorm';

/**
 * ApiUsage Entity
 * 
 * Tracks API usage statistics per customer per day per endpoint.
 * 
 * Architecture: Decoupled (no Customer entity)
 * - external_customer_id: Customer ID from main website
 * - No foreign key relationship
 * 
 * Aggregation:
 * - Daily aggregation (one row per customer per endpoint per day)
 * - Updated via upsert (INSERT ... ON CONFLICT UPDATE)
 * - Enables efficient analytics and billing
 * 
 * Usage:
 * - Main website fetches usage via Admin API
 * - Used for billing (Stripe metered usage)
 * - Displayed in developer portal dashboard
 * - Tracks quota consumption
 */
@Entity('api_usage')
@Index(['external_customer_id', 'date'])
@Index(['date'])
@Index(['endpoint'])
export class ApiUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Customer ID from main website
   * No foreign key relationship
   */
  @Column({ type: 'varchar', length: 255 })
  external_customer_id: string;

  /**
   * Date of usage (YYYY-MM-DD)
   * Aggregated daily
   */
  @Column({ type: 'date' })
  date: Date;

  /**
   * API endpoint path
   * e.g., "/api/v1/pincodes/:pincode"
   */
  @Column({ type: 'varchar', length: 255 })
  endpoint: string;

  /**
   * Total number of requests to this endpoint on this date
   */
  @Column({ type: 'integer', default: 0 })
  request_count: number;

  /**
   * Number of successful requests (2xx status codes)
   */
  @Column({ type: 'integer', default: 0 })
  success_count: number;

  /**
   * Number of failed requests (4xx, 5xx status codes)
   */
  @Column({ type: 'integer', default: 0 })
  error_count: number;

  /**
   * Average response time in milliseconds
   * Calculated as running average
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avg_response_time_ms: number;

  /**
   * HTTP status code distribution
   * e.g., { "200": 950, "404": 30, "429": 20 }
   */
  @Column({ type: 'jsonb', default: {} })
  status_codes: Record<string, number>;

  /**
   * Additional metadata (optional)
   * - user_agent_distribution: Top user agents
   * - country_distribution: Requests by country (from IP)
   * - peak_hour: Hour with most requests
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    user_agent_distribution?: Record<string, number>;
    country_distribution?: Record<string, number>;
    peak_hour?: number;
  } | null;

  /**
   * Record creation timestamp
   */
  @CreateDateColumn()
  created_at: Date;

  /**
   * Last update timestamp
   * Updated on every request aggregation
   */
  @UpdateDateColumn()
  updated_at: Date;
}
