import { IsOptional, IsInt, Min, Max, IsArray, ArrayMaxSize, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Stack 1: Pincode ↔ H3 DTOs
 * 
 * Request/Response DTOs for Pincode-H3 conversion operations
 */

// ==================== REQUEST DTOs ====================

/**
 * Query parameters for pincode-to-h3 conversion
 * Resolution is fixed at 9 (not configurable)
 */
export class PincodeToH3QueryDto {
  @IsOptional()
  @IsEnum(['overlaps', 'contains'])
  relationship?: 'overlaps' | 'contains' = 'overlaps';
}

/**
 * Query parameters for h3-to-pincode conversion
 * Only accepts H3 resolution 9 cells
 */
export class H3ToPincodeQueryDto {
  @IsOptional()
  @IsEnum(['overlaps', 'contains'])
  relationship?: 'overlaps' | 'contains' = 'overlaps';
}

/**
 * Bulk pincode-to-h3 conversion
 * Resolution is fixed at 9 (not configurable)
 */
export class BulkPincodeToH3Dto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  pincodes: string[];

  @IsOptional()
  @IsEnum(['overlaps', 'contains'])
  relationship?: 'overlaps' | 'contains' = 'overlaps';
}

/**
 * Bulk h3-to-pincode conversion
 * Only accepts H3 resolution 9 cells
 */
export class BulkH3ToPincodeDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  h3Indexes: string[];

  @IsOptional()
  @IsEnum(['overlaps', 'contains'])
  relationship?: 'overlaps' | 'contains' = 'overlaps';
}

// ==================== RESPONSE DTOs ====================

/**
 * Response for pincode-to-h3 conversion
 */
export class PincodeToH3Response {
  pincode: string;
  resolution: 9; // Always 9
  h3Cells: string[];
  totalCells: number;
  relationship: 'overlaps' | 'contains';
  note?: string;
}

/**
 * Response for h3-to-pincode conversion
 */
export class H3ToPincodeResponse {
  h3Index: string;
  resolution: 9; // Validated to be 9
  pincodes: string[];
  totalPincodes: number;
  relationship: 'overlaps' | 'contains';
  center: {
    latitude: number;
    longitude: number;
  };
  note?: string;
}

/**
 * Response for bulk pincode-to-h3 conversion
 */
export class BulkPincodeToH3Response {
  resolution: 9; // Always 9
  relationship: 'overlaps' | 'contains';
  results: Array<{
    pincode: string;
    h3Cells: string[];
    totalCells: number;
    note?: string;
  }>;
  totalProcessed: number;
  totalCells: number;
}

/**
 * Response for bulk h3-to-pincode conversion
 */
export class BulkH3ToPincodeResponse {
  relationship: 'overlaps' | 'contains';
  results: Array<{
    h3Index: string;
    resolution: 9; // Validated to be 9
    pincodes: string[];
    totalPincodes: number;
    note?: string;
  }>;
  totalProcessed: number;
  uniquePincodes: number;
}
