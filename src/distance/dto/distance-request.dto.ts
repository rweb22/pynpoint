import { IsOptional, IsString, IsNumber, IsEnum, ValidateNested, IsArray, ArrayMaxSize, ArrayMinSize, IsNotEmpty } from 'class-validator';
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
  @IsNotEmpty({ message: 'from location is required' })
  @ValidateNested()
  @Type(() => LocationDto)
  from: LocationDto;

  @IsNotEmpty({ message: 'to location is required' })
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
  @IsNotEmpty({ message: 'from location is required in each pair' })
  @ValidateNested()
  @Type(() => LocationDto)
  from: LocationDto;

  @IsNotEmpty({ message: 'to location is required in each pair' })
  @ValidateNested()
  @Type(() => LocationDto)
  to: LocationDto;
}

export class BatchDistanceDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one location pair is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 location pairs allowed per request' })
  @ValidateNested({ each: true })
  @Type(() => DistancePairDto)
  pairs: DistancePairDto[];

  @IsOptional()
  @IsEnum(DistanceUnit)
  unit?: DistanceUnit = DistanceUnit.KM;
}
