import { IsArray, IsNumber, IsOptional, IsString, Min, Max, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Coordinate DTO for H3 encoding
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
 * POST /h3/encode
 * Encode coordinates to H3 indices
 */
export class EncodeH3Dto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CoordinateDto)
  coordinates: CoordinateDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number;
}

/**
 * POST /h3/decode
 * Decode H3 indices to coordinates
 */
export class DecodeH3Dto {
  @IsArray()
  @ArrayMinSize(1)
  h3Indices: string[];
}

/**
 * GET /h3/nearby
 * Find H3 cells within radius
 */
export class NearbyH3QueryDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Transform(({ value }) => parseFloat(value))
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  @Transform(({ value }) => parseFloat(value))
  lng: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  radius?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number;
}

/**
 * POST /h3/validate
 * Validate H3 index format and geographic bounds
 */
export class ValidateH3Dto {
  @IsString()
  h3Index: string;
}
