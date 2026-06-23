import { IsOptional, IsString, IsNumber, IsEnum, ValidateNested, IsArray, ArrayMaxSize, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Coordinate DTO - defined first to avoid circular dependency
 */
export class CoordinateDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

/**
 * Location can be one of: pincode, digipin, or coordinate
 */
export class LocationDto {
  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  digipin?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinateDto)
  coordinate?: CoordinateDto;
}

export enum DistanceUnit {
  KM = 'km',
  MI = 'mi',
  M = 'm',
}

/**
 * POST /distance/calculate
 */
export class CalculateDistanceDto {
  @ValidateNested()
  @Type(() => LocationDto)
  from: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  to: LocationDto;

  @IsOptional()
  @IsEnum(DistanceUnit)
  unit?: DistanceUnit = DistanceUnit.KM;
}

/**
 * POST /distance/batch
 */
export class DistancePairDto {
  @ValidateNested()
  @Type(() => LocationDto)
  from: LocationDto;

  @ValidateNested()
  @Type(() => LocationDto)
  to: LocationDto;
}

export class BatchDistanceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DistancePairDto)
  @ArrayMaxSize(100, { message: 'Maximum 100 location pairs allowed per request' })
  pairs: DistancePairDto[];

  @IsOptional()
  @IsEnum(DistanceUnit)
  unit?: DistanceUnit = DistanceUnit.KM;
}
