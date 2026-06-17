import { IsOptional, IsInt, Min, Max, IsArray, ArrayMaxSize, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Stack 2: Pincode ↔ DIGIPIN DTOs
 * 
 * Request/Response DTOs for Pincode-DIGIPIN conversion operations
 */

// ==================== REQUEST DTOs ====================

/**
 * Query parameters for pincode-to-digipin conversion
 */
export class PincodeToDigipinQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number = 6;

  @IsOptional()
  @IsEnum(['contains', 'intersects', 'within'])
  relationship?: 'contains' | 'intersects' | 'within' = 'intersects';
}

/**
 * Query parameters for digipin-to-pincode conversion
 */
export class DigipinToPincodeQueryDto {
  @IsOptional()
  @IsEnum(['contains', 'intersects', 'within'])
  relationship?: 'contains' | 'intersects' | 'within' = 'intersects';
}

/**
 * Bulk pincode-to-digipin conversion
 */
export class BulkPincodeToDigipinDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  pincodes: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  level?: number = 6;
}

/**
 * Bulk digipin-to-pincode conversion
 */
export class BulkDigipinToPincodeDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  digipinCodes: string[];
}

// ==================== RESPONSE DTOs ====================

/**
 * Response for pincode-to-digipin conversion
 */
export class PincodeToDigipinResponse {
  pincode: string;
  level: number;
  digipinCodes: string[];
  totalCodes: number;
  boundary?: {
    type: string;
    coordinates: number[][][];
  };
}

/**
 * Response for digipin-to-pincode conversion
 */
export class DigipinToPincodeResponse {
  digipinCode: string;
  level: number;
  pincodes: string[];
  totalPincodes: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for bulk pincode-to-digipin conversion
 */
export class BulkPincodeToDigipinResponse {
  level: number;
  results: Array<{
    pincode: string;
    digipinCodes: string[];
    totalCodes: number;
  }>;
  totalProcessed: number;
  totalCodes: number;
}

/**
 * Response for bulk digipin-to-pincode conversion
 */
export class BulkDigipinToPincodeResponse {
  results: Array<{
    digipinCode: string;
    level: number;
    pincodes: string[];
    totalPincodes: number;
  }>;
  totalProcessed: number;
  uniquePincodes: number;
}
