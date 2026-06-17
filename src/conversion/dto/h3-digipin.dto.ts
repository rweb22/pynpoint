import { IsOptional, IsInt, Min, Max, IsArray, ArrayMaxSize, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Stack 3: H3 ↔ DIGIPIN DTOs
 * 
 * Request/Response DTOs for H3-DIGIPIN conversion operations
 */

// ==================== REQUEST DTOs ====================

/**
 * Query parameters for h3-to-digipin conversion
 */
export class H3ToDigipinQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number = 6;

  @IsOptional()
  @IsEnum(['contains', 'intersects', 'within', 'all'])
  relationship?: 'contains' | 'intersects' | 'within' | 'all' = 'all';
}

/**
 * Query parameters for digipin-to-h3 conversion
 */
export class DigipinToH3QueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  resolution?: number = 9;

  @IsOptional()
  @IsEnum(['contains', 'intersects', 'within', 'all'])
  relationship?: 'contains' | 'intersects' | 'within' | 'all' = 'all';
}

/**
 * Bulk h3-to-digipin conversion
 */
export class BulkH3ToDigipinDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  h3Indexes: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number = 6;
}

/**
 * Bulk digipin-to-h3 conversion
 */
export class BulkDigipinToH3Dto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  digipinCodes: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  resolution?: number = 9;
}

// ==================== RESPONSE DTOs ====================

/**
 * Response for h3-to-digipin conversion
 * Returns ALL overlapping DIGIPIN cells (not just center-point match)
 */
export class H3ToDigipinResponse {
  h3Index: string;
  h3Resolution: number;
  digipinLevel: number;
  digipinCodes: string[];
  totalCodes: number;
  center: {
    latitude: number;
    longitude: number;
  };
  note?: string; // e.g., "Returns all DIGIPIN cells that overlap with H3 hexagon"
}

/**
 * Response for digipin-to-h3 conversion
 * Returns ALL overlapping H3 cells (not just center-point match)
 */
export class DigipinToH3Response {
  digipinCode: string;
  digipinLevel: number;
  h3Resolution: number;
  h3Indexes: string[];
  totalCells: number;
  center: {
    latitude: number;
    longitude: number;
  };
  note?: string; // e.g., "Returns all H3 cells that overlap with DIGIPIN cell"
}

/**
 * Response for bulk h3-to-digipin conversion
 */
export class BulkH3ToDigipinResponse {
  digipinLevel: number;
  results: Array<{
    h3Index: string;
    h3Resolution: number;
    digipinCodes: string[];
    totalCodes: number;
  }>;
  totalProcessed: number;
  totalDigipinCodes: number;
}

/**
 * Response for bulk digipin-to-h3 conversion
 */
export class BulkDigipinToH3Response {
  h3Resolution: number;
  results: Array<{
    digipinCode: string;
    digipinLevel: number;
    h3Indexes: string[];
    totalCells: number;
  }>;
  totalProcessed: number;
  totalH3Cells: number;
}
