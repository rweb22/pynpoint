import { IsOptional, IsString, IsInt, IsNumber, Min, Max, IsBoolean, IsArray, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Query DTO for GET /pincodes
 * 
 * Supports filtering by state, district, city, and pagination
 */
export class PincodeQueryDto {
  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  search?: string; // Search in office_name or pincode

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

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
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(50)
  maxDistance?: number = 5; // Max search radius in km

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 1; // Return top N closest pincodes
}
