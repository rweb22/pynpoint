/**
 * Response DTOs for DIGIPIN endpoints
 */

export class CoordinateResponse {
  latitude: number;
  longitude: number;
}

export class DigipinBoundsResponse {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export class DigipinHierarchyResponse {
  level1?: string;
  level2?: string;
  level3?: string;
  level4?: string;
  level5?: string;
  level6?: string;
  level7?: string;
  level8?: string;
  level9?: string;
  level10?: string;
}

/**
 * GET /digipin/:code
 * Detailed DIGIPIN cell information
 */
export class DigipinCellResponse {
  digipinCode: string;
  level: number;
  center: CoordinateResponse;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  area: {
    value: number;
    unit: string;
  };
  pincodes: string[];
  pincodeCount: number;
  parentDigipin: string | null;
  hierarchy: DigipinHierarchyResponse;
}

/**
 * POST /digipin/encode
 * Encode coordinates to DIGIPIN codes
 */
export class EncodeDigipinResponse {
  level: number;
  results: Array<{
    input: CoordinateResponse;
    digipinCode: string;
    pincodes: string[];
  }>;
}

/**
 * POST /digipin/decode
 * Decode DIGIPIN codes to coordinates
 */
export class DecodeDigipinResponse {
  results: Array<{
    digipinCode: string;
    center: CoordinateResponse;
    level: number;
  }>;
}

/**
 * GET /digipin/neighbors/:code
 * Get neighboring DIGIPIN cells
 */
export class DigipinNeighborsResponse {
  center: string;
  level: number;
  neighbors: string[];
  totalCount: number;
  note: string;
}

/**
 * GET /digipin/nearby
 * Find DIGIPIN cells within radius
 */
export class DigipinNearbyResponse {
  center: CoordinateResponse;
  radius: number;
  radiusUnit: string;
  level: number;
  cells: Array<{
    digipinCode: string;
    distance: number;
    pincodes: string[];
    center: CoordinateResponse;
  }>;
  totalCells: number;
  uniquePincodes: number;
}
