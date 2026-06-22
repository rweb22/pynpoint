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
 * Detailed DIGIPIN cell information (PURE - no pincode references)
 */
export class DigipinCellResponse {
  digipinCode: string;
  level: number;
  center: CoordinateResponse;
  bounds: DigipinBoundsResponse;
  boundary: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  area: {
    value: number;
    unit: string;
  };
  parentDigipin: string | null;
  hierarchy: DigipinHierarchyResponse;
}

/**
 * POST /digipin/encode
 * Encode coordinates to DIGIPIN codes (PURE - no pincode references)
 */
export class EncodeDigipinResponse {
  level: number;
  results: Array<{
    input: CoordinateResponse;
    digipinCode: string;
    center: CoordinateResponse;
    bounds: DigipinBoundsResponse;
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
 * Find DIGIPIN cells within radius (PURE - no pincode references)
 */
export class DigipinNearbyResponse {
  center: CoordinateResponse;
  radius: number;
  radiusUnit: string;
  level: number;
  cells: Array<{
    digipinCode: string;
    distance: number;
    center: CoordinateResponse;
    bounds: DigipinBoundsResponse;
  }>;
  totalCells: number;
}

/**
 * GET /digipin/:code/parent
 * Get parent DIGIPIN cell
 */
export class DigipinParentResponse {
  digipinCode: string;
  level: number;
  parent: string;
  parentLevel: number;
  center: CoordinateResponse;
  parentCenter: CoordinateResponse;
  parentBounds: DigipinBoundsResponse;
}

/**
 * GET /digipin/:code/children
 * Get children DIGIPIN cells
 */
export class DigipinChildrenResponse {
  digipinCode: string;
  level: number;
  children: string[];
  childrenLevel: number;
  totalChildren: number;
  center: CoordinateResponse;
}

/**
 * Ancestor info for hierarchy
 */
export class DigipinAncestorInfo {
  cell: string;
  level: number;
  center: CoordinateResponse;
}

/**
 * GET /digipin/:code/ancestors
 * Get all ancestor DIGIPIN cells
 */
export class DigipinAncestorsResponse {
  digipinCode: string;
  level: number;
  ancestors: DigipinAncestorInfo[];
  totalAncestors: number;
  center: CoordinateResponse;
}

/**
 * POST /digipin/validate
 * Validate DIGIPIN code format and geographic bounds
 *
 * UNIQUE FEATURE - No competitor has DIGIPIN validation!
 */
export class ValidateDigipinResponse {
  /**
   * Overall validation status
   */
  valid: boolean;

  /**
   * The DIGIPIN code being validated
   */
  digipinCode: string;

  /**
   * Calculated level from code length (2 chars per level)
   */
  level?: number;

  /**
   * Charset validation result
   */
  charset?: 'valid' | 'invalid';

  /**
   * Geographic bounds information (if valid)
   */
  bounds?: {
    withinIndia: boolean;
    centerLat?: number;
    centerLng?: number;
  };

  /**
   * Validation error messages (if any)
   */
  errors?: string[];

  /**
   * Grid path information (for valid codes)
   */
  gridPath?: string;
}
