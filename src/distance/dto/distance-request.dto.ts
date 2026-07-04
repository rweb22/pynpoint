import { IsOptional, IsString, IsNumber, IsEnum, ValidateNested, IsArray, ArrayMaxSize, ArrayMinSize, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Coordinate DTO - defined first to avoid circular dependency
 */
export class CoordinateDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 28.6139,
    type: Number,
  })
  @IsNumber()
  lat: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 77.2090,
    type: Number,
  })
  @IsNumber()
  lng: number;
}

/**
 * Location can be one of: pincode, digipin, or coordinate
 */
export class LocationDto {
  @ApiPropertyOptional({
    description: 'Indian postal code (6 digits)',
    example: '110001',
    type: String,
  })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({
    description: 'DIGIPIN code (10 characters)',
    example: 'C4P8K63M4M',
    type: String,
  })
  @IsOptional()
  @IsString()
  digipin?: string;

  @ApiPropertyOptional({
    description: 'GPS coordinates (lat/lng)',
    type: CoordinateDto,
  })
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
  @ApiProperty({
    description: 'Starting location (pincode, digipin, or coordinates)',
    example: { pincode: '110001' },
    type: LocationDto,
  })
  @IsDefined({ message: 'from location is required' })
  @ValidateNested()
  @Type(() => LocationDto)
  from: LocationDto;

  @ApiProperty({
    description: 'Destination location (pincode, digipin, or coordinates)',
    example: { pincode: '400001' },
    type: LocationDto,
  })
  @IsDefined({ message: 'to location is required' })
  @ValidateNested()
  @Type(() => LocationDto)
  to: LocationDto;

  @ApiPropertyOptional({
    description: 'Distance unit (km=kilometers, mi=miles, m=meters)',
    example: 'km',
    enum: DistanceUnit,
    default: DistanceUnit.KM,
  })
  @IsOptional()
  @IsEnum(DistanceUnit)
  unit?: DistanceUnit = DistanceUnit.KM;
}

/**
 * POST /distance/batch
 */
export class DistancePairDto {
  @IsDefined({ message: 'from location is required in each pair' })
  @ValidateNested()
  @Type(() => LocationDto)
  from: LocationDto;

  @IsDefined({ message: 'to location is required in each pair' })
  @ValidateNested()
  @Type(() => LocationDto)
  to: LocationDto;
}

export class BatchDistanceDto {
  @IsDefined({ message: 'pairs array is required' })
  @IsArray({ message: 'pairs must be an array' })
  @ArrayMinSize(1, { message: 'At least one location pair is required' })
  @ArrayMaxSize(100, { message: 'Maximum 100 location pairs allowed per request' })
  @ValidateNested({ each: true })
  @Type(() => DistancePairDto)
  pairs: DistancePairDto[];

  @IsOptional()
  @IsEnum(DistanceUnit)
  unit?: DistanceUnit = DistanceUnit.KM;
}
