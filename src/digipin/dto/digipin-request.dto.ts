import { IsArray, IsNumber, IsString, Min, Max, ValidateNested, ArrayMinSize, ArrayMaxSize, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Coordinate DTO for encoding
 */
export class CoordinateDto {
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

/**
 * POST /digipin/encode
 * Convert coordinates to DIGIPIN codes
 */
export class EncodeDigipinDto {
  @ApiProperty({
    description: 'Array of coordinates to encode (1-100 items)',
    example: [{ latitude: 28.6139, longitude: 77.2090 }],
    type: [CoordinateDto],
    minItems: 1,
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CoordinateDto)
  coordinates: CoordinateDto[];

  @ApiPropertyOptional({
    description: 'DIGIPIN precision level (1-10). Level 10 = ~4m×4m accuracy',
    example: 6,
    minimum: 1,
    maximum: 10,
    default: 6,
    type: Number,
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  level?: number = 6;
}

/**
 * POST /digipin/decode
 * Convert DIGIPIN codes to coordinates
 */
export class DecodeDigipinDto {
  @ApiProperty({
    description: 'Array of DIGIPIN codes to decode (1-100 items)',
    example: ['C4P8K63M4M'],
    type: [String],
    minItems: 1,
    maxItems: 100,
  })
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

/**
 * POST /digipin/to-pincode
 * Convert DIGIPIN code to pincode (reverse geocode)
 */
export class DigipinToPincodeDto {
  @IsString()
  digipinCode: string;
}
