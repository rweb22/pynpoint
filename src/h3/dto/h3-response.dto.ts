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
 * Detailed H3 cell information (PURE H3 - no cross-system references)
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
}

/**
 * POST /h3/encode
 * Encode coordinates to H3 indices (PURE H3 - no cross-system references)
 */
export class EncodeH3Response {
  resolution: number;
  results: Array<{
    input: CoordinateResponse;
    h3Index: string;
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
 * Find H3 cells within radius (PURE H3 - no cross-system references)
 */
export class H3NearbyResponse {
  center: CoordinateResponse;
  radius: number;
  radiusUnit: string;
  resolution: number;
  cells: Array<{
    h3Index: string;
    distance: number;
    center: CoordinateResponse;
  }>;
  totalCells: number;
}

/**
 * GET /h3/:h3Index/parent
 * Get parent H3 cell at coarser resolution
 */
export class H3ParentResponse {
  child: string;
  childResolution: number;
  parent: string;
  parentResolution: number;
  center: CoordinateResponse;
  boundary: H3BoundaryResponse;
  area: {
    value: number;
    unit: string;
  };
}

/**
 * GET /h3/:h3Index/children
 * Get children H3 cells at finer resolution
 */
export class H3ChildrenResponse {
  parent: string;
  parentResolution: number;
  childResolution: number;
  children: string[];
  totalCount: number;
  note: string;
}

/**
 * GET /h3/:h3Index/ancestors
 * Get all ancestor H3 cells from child to resolution 0
 */
export class H3AncestorsResponse {
  h3Index: string;
  resolution: number;
  ancestors: Array<{
    h3Index: string;
    resolution: number;
    center: CoordinateResponse;
    area: {
      value: number;
      unit: string;
    };
  }>;
  totalCount: number;
}

/**
 * POST /h3/validate
 * Validate H3 index format and geographic bounds
 *
 * UNIQUE FEATURE - No competitor has H3 validation!
 */
export class ValidateH3Response {
  /**
   * Overall validation status
   */
  valid: boolean;

  /**
   * The H3 index being validated
   */
  h3Index: string;

  /**
   * Resolution level (0-15)
   */
  resolution?: number;

  /**
   * Geographic bounds information (if valid)
   */
  bounds?: {
    centerLat: number;
    centerLng: number;
    withinIndia: boolean;
  };

  /**
   * Whether we support this resolution (6-12 for pincode mappings)
   */
  supported?: boolean;

  /**
   * Cell area (if valid)
   */
  cellArea?: {
    value: number;
    unit: string;
  };

  /**
   * Validation error messages (if any)
   */
  errors?: string[];
}
