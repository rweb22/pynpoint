import { IsOptional, IsString, IsInt, IsNumber, Min, Max, IsBoolean, IsArray, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Query DTO for GET /pincodes
 *
 * Supports filtering by state, district, and pagination
 */
export class PincodeQueryDto {
  @ApiPropertyOptional({
    description: 'Filter pincodes by state name',
    example: 'Delhi',
    type: String,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Filter pincodes by district name',
    example: 'Central Delhi',
    type: String,
  })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({
    description: 'Search in office name or pincode',
    example: 'Connaught',
    type: String,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Number of results per page',
    example: 25,
    minimum: 1,
    maximum: 100,
    default: 25,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Include post offices in the response',
    example: false,
    default: false,
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includePostOffices?: boolean = false;
}

/**
 * Query DTO for GET /administrative/districts
 */
export class DistrictQueryDto {
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}

/**
 * Query DTO for GET /administrative/regions
 */
export class RegionQueryDto {
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  circle?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}

/**
 * Request body for POST /pincodes/bulk/lookup
 */
export class BulkPincodeLookupDto {
  @IsArray()
  @IsString({ each: true })
  pincodes: string[];

  @IsOptional()
  @IsBoolean()
  includePostOffices?: boolean = false;
}

/**
 * Query DTO for GET /pincodes/:pincode/nearby
 *
 * Find pincodes within a specified radius
 */
export class NearbyPincodeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(500)
  radius?: number = 50; // Default 50km

  @IsOptional()
  @IsString()
  @IsIn(['km', 'm'])
  unit?: 'km' | 'm' = 'km'; // Default kilometers

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50; // Max results

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDistance?: boolean = true; // Include distance in results
}

/**
 * Request body for POST /pincodes/reverse-geocode
 *
 * Convert coordinates to nearest pincode
 */
export class ReverseGeocodeDto {
  @ApiProperty({
    description: 'Latitude coordinate (-90 to 90)',
    example: 28.6139,
    minimum: -90,
    maximum: 90,
    type: Number,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate (-180 to 180)',
    example: 77.2090,
    minimum: -180,
    maximum: 180,
    type: Number,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Maximum search radius in kilometers',
    example: 5,
    minimum: 0.1,
    maximum: 50,
    default: 5,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  maxDistance?: number = 5;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return',
    example: 1,
    minimum: 1,
    maximum: 10,
    default: 1,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 1;
}

/**
 * Request body for POST /pincodes/locate
 *
 * Find the pincode that contains the given coordinates (point-in-polygon)
 */
export class LocatePincodeDto {
  @ApiProperty({
    description: 'Latitude coordinate (-90 to 90)',
    example: 28.6139,
    minimum: -90,
    maximum: 90,
    type: Number,
  })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate (-180 to 180)',
    example: 77.2090,
    minimum: -180,
    maximum: 180,
    type: Number,
  })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
