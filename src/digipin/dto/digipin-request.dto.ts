import { IsArray, IsNumber, IsString, Min, Max, ValidateNested, ArrayMinSize, ArrayMaxSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Coordinate DTO for encoding
 */
export class CoordinateDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

/**
 * POST /digipin/encode
 * Convert coordinates to DIGIPIN codes
 */
export class EncodeDigipinDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CoordinateDto)
  coordinates: CoordinateDto[];

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  level?: number = 6; // Default level 6
}

/**
 * POST /digipin/decode
 * Convert DIGIPIN codes to coordinates
 */
export class DecodeDigipinDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  digipinCodes: string[];
}

/**
 * GET /digipin/nearby
 * Find DIGIPIN cells within radius
 */
export class NearbyDigipinQueryDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng: number;

  @IsNumber()
  @Min(0.1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  radius?: number = 5; // Default 5km

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  @Type(() => Number)
  level?: number = 6; // Default level 6
}

/**
 * POST /digipin/validate
 * Validate DIGIPIN code format and geographic bounds
 */
export class ValidateDigipinDto {
  @IsString()
  digipinCode: string;
}
