import { Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Pincode } from './pincode.entity';

/**
 * PostOffice Entity
 * 
 * Represents individual post offices in India with their details.
 * Multiple post offices can share the same pincode.
 * 
 * Schema:
 * - id: Auto-incrementing primary key
 * - pincode: 6-digit postal code (foreign key to pincodes table)
 * - officename: Official post office name
 * - area: Locality/area name
 * - officetype: HO (Head Office), SO (Sub Office), BO (Branch Office)
 * - delivery: Whether the office delivers mail ("Delivery" or "Non Delivery")
 * - district: District name (normalized)
 * - state: State/UT name (normalized)
 * - division: Postal division
 * - region: Postal region
 * - circle: Postal circle
 * - latitude: GPS latitude (nullable - not all offices have coordinates)
 * - longitude: GPS longitude (nullable)
 * - is_active: Soft delete flag
 * - created_at: Timestamp
 * - updated_at: Timestamp
 * 
 * Data Source: BharatPin 2026 dataset (165,627 post offices)
 */
@Entity('postoffices')
export class PostOffice {
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 6-digit postal code
   * Multiple post offices can have the same pincode
   */
  @Column({ length: 6 })
  @Index()
  pincode: string;

  /**
   * Foreign key relationship to pincodes table
   * Note: This is optional - some pincodes in CSV may not have boundaries in GeoJSON
   */
  @ManyToOne(() => Pincode, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pincode', referencedColumnName: 'pincode' })
  pincodeEntity?: Pincode;

  /**
   * Official post office name (e.g., "Kothimir B.O", "New Delhi GPO")
   */
  @Column({ length: 200 })
  officename: string;

  /**
   * Locality/area name (normalized: lowercase, trimmed)
   */
  @Column({ length: 200 })
  @Index()
  area: string;

  /**
   * Office type: HO, SO, or BO
   * - HO: Head Office (main post office for the pincode)
   * - SO: Sub Office
   * - BO: Branch Office
   */
  @Column({ length: 2 })
  @Index()
  officetype: string;

  /**
   * Delivery status: "delivery" or "non delivery"
   * Normalized to lowercase for consistency
   */
  @Column({ length: 20 })
  @Index()
  delivery: string;

  /**
   * District name (normalized: lowercase, trimmed)
   * Nullable: Some post offices have "NA" in source data
   */
  @Column({ length: 100, nullable: true })
  @Index()
  district: string;

  /**
   * State/UT name (normalized: lowercase, trimmed)
   * Nullable: Some post offices have "NA" in source data
   */
  @Column({ length: 100, nullable: true })
  @Index()
  state: string;

  /**
   * Postal division
   */
  @Column({ length: 100, nullable: true })
  division: string;

  /**
   * Postal region
   */
  @Column({ length: 100, nullable: true })
  region: string;

  /**
   * Postal circle
   */
  @Column({ length: 100, nullable: true })
  circle: string;

  /**
   * GPS latitude (WGS 84)
   * Nullable - ~7.3% of offices don't have coordinates
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  /**
   * GPS longitude (WGS 84)
   * Nullable - ~7.3% of offices don't have coordinates
   */
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  /**
   * Soft delete flag
   */
  @Column({ default: true })
  @Index()
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}
