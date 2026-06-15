import { IsOptional, IsString, IsInt, Min, Max, IsBoolean, IsArray } from 'class-validator';
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

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeBoundary?: boolean = false;
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
 * Request body for POST /pincodes/bulk/lookup
 */
export class BulkPincodeLookupDto {
  @IsArray()
  @IsString({ each: true })
  pincodes: string[];

  @IsOptional()
  @IsBoolean()
  includePostOffices?: boolean = false;

  @IsOptional()
  @IsBoolean()
  includeBoundary?: boolean = false;
}
