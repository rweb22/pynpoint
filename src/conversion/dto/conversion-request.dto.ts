import { IsString, IsArray, IsNumber, IsOptional, IsBoolean, Min, Max, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * Query DTO for pincode-to-h3 conversion
 */
export class PincodeToH3QueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  resolution?: number = 9;
}

/**
 * Query DTO for pincode-to-digipin conversion
 */
export class PincodeToDigipinQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Type(() => Number)
  @Transform(({ value }) => parseInt(value, 10))
  level?: number = 6;
}

/**
 * Query DTO for h3-to-digipin conversion
 */
export class H3ToDigipinQueryDto {
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
export class DigipinToH3QueryDto {
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
