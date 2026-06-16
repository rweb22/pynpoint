import { IsString, IsArray, IsNumber, IsOptional, IsBoolean, IsEnum, Min, Max, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Spatial Relationship Types
 *
 * Defines how two spatial objects relate to each other.
 */
export enum SpatialRelationship {
  /**
   * A completely contains B (B is fully inside A)
   * Example: Pincode contains H3 cell
   */
  CONTAINS = 'contains',

  /**
   * A is completely contained by B (A is fully inside B)
   * Example: H3 cell is contained by pincode
   */
  CONTAINED_BY = 'contained_by',

  /**
   * A and B share any area (includes contains, contained_by, and partial overlaps)
   * This is the default and matches current API behavior.
   */
  INTERSECTS = 'intersects',

  /**
   * A and B partially overlap (excludes contains and contained_by)
   * Example: H3 cell on pincode boundary
   */
  OVERLAPS = 'overlaps',
}

/**
 * Base query DTO for spatial operations
 */
export class BaseSpatialQueryDto {
  @IsOptional()
  @IsEnum(SpatialRelationship)
  relationship?: SpatialRelationship = SpatialRelationship.INTERSECTS;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeMetadata?: boolean = false;
}

/**
 * Query DTO for pincode-to-h3 conversion
 */
export class PincodeToH3QueryDto extends BaseSpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number = 9;
}

/**
 * Query DTO for h3-to-pincode conversion
 */
export class H3ToPincodeQueryDto extends BaseSpatialQueryDto {
  // No additional params - resolution derived from h3Index
}

/**
 * Query DTO for pincode-to-digipin conversion
 */
export class PincodeToDigipinQueryDto extends BaseSpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  level?: number = 6;
}

/**
 * Query DTO for digipin-to-pincode conversion
 */
export class DigipinToPincodeQueryDto extends BaseSpatialQueryDto {
  // No additional params - level derived from digipinCode
}

/**
 * Query DTO for h3-to-digipin conversion
 */
export class H3ToDigipinQueryDto extends BaseSpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  level?: number = 6;
}

/**
 * Query DTO for digipin-to-h3 conversion
 */
export class DigipinToH3QueryDto extends BaseSpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number = 9;
}

/**
 * Body DTO for bulk pincode-to-h3 conversion
 */
export class BulkPincodeToH3Dto {
  @IsArray()
  @ArrayMaxSize(50, { message: 'Maximum 50 pincodes allowed per request' })
  @IsString({ each: true })
  pincodes: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  resolution?: number = 9;
}

/**
 * Body DTO for bulk h3-to-pincode conversion
 */
export class BulkH3ToPincodeDto {
  @IsArray()
  @ArrayMaxSize(100, { message: 'Maximum 100 H3 indexes allowed per request' })
  @IsString({ each: true })
  h3Indexes: string[];
}

/**
 * Query DTO for spatial intersection check
 */
export class SpatialIntersectionQueryDto {
  @IsString()
  pincode: string;

  @IsNumber()
  @Type(() => Number)
  @Transform(({ value }) => parseFloat(value))
  lat: number;

  @IsNumber()
  @Type(() => Number)
  @Transform(({ value }) => parseFloat(value))
  lng: number;
}

/**
 * GeoJSON Polygon for polygon search
 */
class GeoJSONCoordinates {
  @IsArray()
  coordinates: number[][][];

  @IsString()
  type: 'Polygon';
}

/**
 * Body DTO for polygon search
 */
export class PolygonSearchDto {
  @ValidateNested()
  @Type(() => GeoJSONCoordinates)
  polygon: GeoJSONCoordinates;

  @IsOptional()
  @IsBoolean()
  includeH3?: boolean = false;

  @IsOptional()
  @IsBoolean()
  includeDigipin?: boolean = false;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  h3Resolution?: number = 9;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  digipinLevel?: number = 6;
}
