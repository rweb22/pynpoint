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
 */
export class PincodeToH3QueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  resolution?: number = 9;

  @IsOptional()
  @IsEnum(['contains', 'intersects', 'within'])
  relationship?: 'contains' | 'intersects' | 'within' = 'intersects';
}

/**
 * Query parameters for h3-to-pincode conversion
 */
export class H3ToPincodeQueryDto {
  @IsOptional()
  @IsEnum(['contains', 'intersects', 'within'])
  relationship?: 'contains' | 'intersects' | 'within' = 'intersects';
}

/**
 * Bulk pincode-to-h3 conversion
 */
export class BulkPincodeToH3Dto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  pincodes: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  resolution?: number = 9;
}

/**
 * Bulk h3-to-pincode conversion
 */
export class BulkH3ToPincodeDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  h3Indexes: string[];
}

// ==================== RESPONSE DTOs ====================

/**
 * Response for pincode-to-h3 conversion
 */
export class PincodeToH3Response {
  pincode: string;
  resolution: number;
  h3Cells: string[];
  totalCells: number;
  boundary?: {
    type: string;
    coordinates: number[][][];
  };
}

/**
 * Response for h3-to-pincode conversion
 */
export class H3ToPincodeResponse {
  h3Index: string;
  resolution: number;
  pincodes: string[];
  totalPincodes: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for bulk pincode-to-h3 conversion
 */
export class BulkPincodeToH3Response {
  resolution: number;
  results: Array<{
    pincode: string;
    h3Cells: string[];
    totalCells: number;
  }>;
  totalProcessed: number;
  totalCells: number;
}

/**
 * Response for bulk h3-to-pincode conversion
 */
export class BulkH3ToPincodeResponse {
  results: Array<{
    h3Index: string;
    resolution: number;
    pincodes: string[];
    totalPincodes: number;
  }>;
  totalProcessed: number;
  uniquePincodes: number;
}
