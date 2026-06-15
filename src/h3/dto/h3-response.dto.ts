/**
 * Response DTOs for H3 endpoints
 */

export class CoordinateResponse {
  latitude: number;
  longitude: number;
}

export class H3BoundaryResponse {
  type: 'Polygon';
  coordinates: number[][][];
}

/**
 * GET /h3/:h3Index
 * Detailed H3 cell information
 */
export class H3CellResponse {
  h3Index: string;
  resolution: number;
  center: CoordinateResponse;
  boundary: H3BoundaryResponse;
  area: {
    value: number;
    unit: string;
  };
  pincodes: string[];
  pincodeCount: number;
  parentH3?: string;
  children?: string[];
}

/**
 * POST /h3/encode
 * Encode coordinates to H3 indices
 */
export class EncodeH3Response {
  resolution: number;
  results: Array<{
    input: CoordinateResponse;
    h3Index: string;
    pincodes: string[];
  }>;
}

/**
 * POST /h3/decode
 * Decode H3 indices to coordinates
 */
export class DecodeH3Response {
  results: Array<{
    h3Index: string;
    center: CoordinateResponse;
    resolution: number;
  }>;
}

/**
 * GET /h3/neighbors/:h3Index
 * Get neighboring H3 cells
 */
export class H3NeighborsResponse {
  center: string;
  resolution: number;
  neighbors: string[];
  totalCount: number;
  note: string;
}

/**
 * GET /h3/nearby
 * Find H3 cells within radius
 */
export class H3NearbyResponse {
  center: CoordinateResponse;
  radius: number;
  radiusUnit: string;
  resolution: number;
  cells: Array<{
    h3Index: string;
    distance: number;
    pincodes: string[];
    center: CoordinateResponse;
  }>;
  totalCells: number;
  uniquePincodes: number;
}
