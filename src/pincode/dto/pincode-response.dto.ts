/**
 * Pincode Response DTOs
 * 
 * Response objects for Track 1: Pincode Solo Operations
 */

/**
 * Coordinates DTO
 */
export class CoordinatesDto {
  latitude: number;
  longitude: number;
}

/**
 * Post Office DTO (simplified for API responses)
 */
export class PostOfficeDto {
  officeName: string;
  area: string;
  officeType: 'HO' | 'SO' | 'BO';
  deliveryStatus: 'Delivery' | 'Non-Delivery';
  division?: string;
  region?: string;
  circle?: string;
  coordinates?: CoordinatesDto;
}

/**
 * Single Pincode Response
 * 
 * GET /pincodes/:pincode
 */
export class PincodeDetailResponseDto {
  pincode: string;
  officeName?: string;
  state?: string;
  district?: string;
  city?: string;
  
  /**
   * Centroid coordinates (geometric center of the pincode boundary)
   */
  coordinates?: CoordinatesDto;
  
  /**
   * PostGIS boundary in GeoJSON format (optional, for mapping applications)
   */
  boundary?: any; // GeoJSON MultiPolygon
  
  /**
   * List of post offices within this pincode
   */
  postOffices?: PostOfficeDto[];
  
  /**
   * Number of post offices in this pincode
   */
  postOfficeCount?: number;
  
  isActive: boolean;
}

/**
 * Paginated Pincode List Response
 * 
 * GET /pincodes?state=...&district=...
 */
export class PincodeListResponseDto {
  total: number;
  page: number;
  limit: number;
  pincodes: PincodeDetailResponseDto[];
}

/**
 * State Response DTO
 * 
 * GET /administrative/states
 */
export class StateDto {
  name: string;
  code: string; // ISO 3166-2 state code (e.g., "DL", "MH", "KA")
  pincodeCount: number;
  districtCount: number;
}

/**
 * States List Response
 */
export class StatesListResponseDto {
  total: number;
  states: StateDto[];
}

/**
 * State Details Response
 * 
 * GET /administrative/states/:code
 */
export class StateDetailResponseDto {
  name: string;
  code: string;
  pincodeCount: number;
  districtCount: number;
  districts: string[]; // Array of district names
}

/**
 * District Response DTO
 */
export class DistrictDto {
  name: string;
  state: string;
  stateCode: string;
  pincodeCount: number;
}

/**
 * Districts List Response
 * 
 * GET /administrative/districts?state=...
 */
export class DistrictsListResponseDto {
  total: number;
  districts: DistrictDto[];
}

/**
 * Bulk Lookup Response
 * 
 * POST /pincodes/bulk/lookup
 */
export class BulkPincodeLookupResponseDto {
  total: number;
  results: Array<{
    pincode: string;
    found: boolean;
    data?: PincodeDetailResponseDto;
    error?: string;
  }>;
}
