import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * Pincode Entity
 * 
 * Represents Indian postal codes (PINCODEs) with geographic boundaries.
 * 
 * Schema:
 * - id: Auto-incrementing primary key
 * - pincode: 6-digit postal code (indexed)
 * - boundary: PostGIS geometry (MultiPolygon)
 * - state: State name
 * - district: District name
 * - is_active: Soft delete flag
 * - created_at: Timestamp
 * - updated_at: Timestamp
 * 
 * Spatial Index: boundary column uses PostGIS GIST index for fast queries
 */
@Entity('pincodes')
@Index('idx_pincode_boundary', { synchronize: false }) // Created manually for PostGIS GIST
export class Pincode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 6, unique: true })
  @Index()
  pincode: string;

  /**
   * PostGIS geometry column
   * 
   * Type: geography(MultiPolygon, 4326)
   * SRID: 4326 (WGS 84 - standard GPS coordinates)
   * 
   * Stored as geography type (not geometry) for accurate distance calculations
   * on Earth's surface.
   * 
   * Note: TypeORM doesn't have native PostGIS types, so we use 'text' type
   * and handle conversion in the repository layer.
   */
  @Column({
    type: 'geography',
    spatialFeatureType: 'MultiPolygon',
    srid: 4326,
    nullable: false,
  })
  boundary: string; // Will store GeoJSON or WKT format

  @Column({ length: 100, nullable: true })
  state: string;

  @Column({ length: 100, nullable: true })
  district: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 200, nullable: true })
  office_name: string;

  @Column({ default: true })
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
