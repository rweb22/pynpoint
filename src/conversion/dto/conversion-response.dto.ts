/**
 * Response DTOs for Track 4: Conversion Operations
 */

/**
 * Coverage information (area comparison)
 */
export interface CoverageDto {
  pincodeArea?: number;
  hexagonsCoverage?: number;
  digipinCoverage?: number;
  h3Coverage?: number;
  digipinArea?: number;
  areaUnit: string;
}

/**
 * Pincode with overlap information
 */
export interface PincodeOverlapDto {
  pincode: string;
  officeName: string;
  district: string;
  state: string;
  isPrimary: boolean;
  overlapPercentage: number;
}

/**
 * Response for pincode-to-h3 conversion
 */
export interface PincodeToH3Response {
  pincode: string;
  resolution: number;
  h3Indexes: string[];
  totalHexagons: number;
  coverage: CoverageDto;
  primaryHexagon: string;
  pincodeCenter: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for h3-to-pincode conversion
 */
export interface H3ToPincodeResponse {
  h3Index: string;
  resolution: number;
  pincodes: PincodeOverlapDto[];
  primaryPincode: string;
  hexagonCenter: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for pincode-to-digipin conversion
 */
export interface PincodeToDigipinResponse {
  pincode: string;
  level: number;
  digipinCodes: string[];
  totalCells: number;
  coverage: CoverageDto;
  primaryDigipin: string;
  pincodeCenter: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for digipin-to-pincode conversion
 */
export interface DigipinToPincodeResponse {
  digipinCode: string;
  level: number;
  pincodes: PincodeOverlapDto[];
  primaryPincode: string;
  digipinCenter: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for h3-to-digipin conversion
 */
export interface H3ToDigipinResponse {
  h3Index: string;
  h3Resolution: number;
  digipinCode: string;
  digipinLevel: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for digipin-to-h3 conversion
 */
export interface DigipinToH3Response {
  digipinCode: string;
  digipinLevel: number;
  h3Resolution: number;
  h3Indexes: string[];
  totalHexagons: number;
  coverage: CoverageDto;
}

/**
 * Single result for bulk pincode-to-h3
 */
export interface BulkPincodeToH3Result {
  h3Indexes: string[];
  totalHexagons: number;
  success: boolean;
  error?: string;
}

/**
 * Response for bulk pincode-to-h3
 */
export interface BulkPincodeToH3Response {
  resolution: number;
  total: number;
  results: Record<string, BulkPincodeToH3Result>;
}

/**
 * Single result for bulk h3-to-pincode
 */
export interface BulkH3ToPincodeResult {
  pincodes: string[];
  primaryPincode: string;
  success: boolean;
  error?: string;
}

/**
 * Response for bulk h3-to-pincode
 */
export interface BulkH3ToPincodeResponse {
  total: number;
  results: Record<string, BulkH3ToPincodeResult>;
}

/**
 * Response for spatial intersection
 */
export interface SpatialIntersectionResponse {
  pincode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  isInside: boolean;
  h3Index: string;
  digipinCode: string;
  distance: {
    toPincodeCenter: number;
    unit: string;
  };
}

/**
 * Pincode result for polygon search
 */
export interface PolygonSearchPincodeResult {
  pincode: string;
  officeName: string;
  district: string;
  state: string;
  overlapPercentage: number;
  h3Indexes?: string[];
  digipinCodes?: string[];
}

/**
 * Response for polygon search
 */
export interface PolygonSearchResponse {
  pincodes: PolygonSearchPincodeResult[];
  totalPincodes: number;
  totalH3Cells?: number;
  totalDigipinCells?: number;
  searchArea: {
    value: number;
    unit: string;
  };
}
