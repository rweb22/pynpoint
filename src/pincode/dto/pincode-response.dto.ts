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
  region?: string;
  circle?: string;

  /**
   * Centroid coordinates (geometric center of the pincode boundary)
   */
  coordinates?: CoordinatesDto;

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
 * City Response DTO
 */
export class CityDto {
  name: string;
  state: string;
  stateCode: string;
  district?: string;
  pincodeCount: number;
}

/**
 * Cities List Response
 *
 * GET /administrative/cities?state=...&district=...
 */
export class CitiesListResponseDto {
  total: number;
  cities: CityDto[];
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

/**
 * Pincode Validation Response
 *
 * GET /pincodes/:pincode/validate
 *
 * Enhanced validation that includes format, existence, and geographic bounds checks
 */
export class PincodeValidationResponseDto {
  /**
   * Overall validation status
   */
  valid: boolean;

  /**
   * Whether the pincode exists in the database
   */
  exists: boolean;

  /**
   * The pincode being validated
   */
  pincode: string;

  /**
   * Validation error messages (if any)
   */
  errors?: string[];

  /**
   * Brief details about the pincode (if it exists)
   */
  details?: {
    state: string;
    district: string;
    officeName?: string;
  };

  /**
   * Coordinate validation
   */
  coordinates?: {
    latitude: number;
    longitude: number;
    withinIndiaBounds: boolean;
  };
}

/**
 * Nearby Pincode Result
 *
 * Individual result for nearby search
 */
export class NearbyPincodeResult {
  pincode: string;
  officeName?: string;
  state?: string;
  district?: string;
  city?: string;
  coordinates?: CoordinatesDto;

  /**
   * Distance from the source pincode/location
   */
  distance?: {
    value: number;
    unit: 'km' | 'm';
  };
}

/**
 * Nearby Pincodes Response
 *
 * GET /pincodes/:pincode/nearby
 */
export class NearbyPincodesResponseDto {
  /**
   * The source pincode that was queried
   */
  source: {
    pincode: string;
    coordinates?: CoordinatesDto;
  };

  /**
   * Search parameters used
   */
  searchParams: {
    radius: number;
    unit: 'km' | 'm';
    limit: number;
  };

  /**
   * Results found within radius
   */
  results: NearbyPincodeResult[];

  /**
   * Total count of results
   */
  total: number;
}

/**
 * Reverse Geocoding Response
 *
 * POST /pincodes/reverse-geocode
 */
export class ReverseGeocodeResponseDto {
  /**
   * Input coordinates
   */
  coordinates: {
    latitude: number;
    longitude: number;
    withinIndiaBounds: boolean;
  };

  /**
   * Nearest pincode(s) found
   */
  results: Array<{
    pincode: string;
    officeName?: string;
    state?: string;
    district?: string;
    city?: string;
    coordinates?: CoordinatesDto;
    distance: {
      value: number;
      unit: 'km';
    };
    /**
     * Whether the coordinates fall within this pincode's boundary
     */
    containsPoint?: boolean;
  }>;

  /**
   * Total results returned
   */
  total: number;

  /**
   * Search parameters used
   */
  searchParams: {
    maxDistance: number;
    limit: number;
  };
}
