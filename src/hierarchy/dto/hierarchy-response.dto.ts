/**
 * Response DTOs for Hierarchy Operations
 */

/**
 * Response for H3 parent request
 */
export interface H3ParentResponse {
  h3Index: string;
  resolution: number;
  parent: string;
  parentResolution: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for H3 children request
 */
export interface H3ChildrenResponse {
  h3Index: string;
  resolution: number;
  children: string[];
  childrenResolution: number;
  totalChildren: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Ancestor info
 */
export interface AncestorInfo {
  cell: string;
  resolution?: number;
  level?: number;
}

/**
 * Response for H3 ancestors request
 */
export interface H3AncestorsResponse {
  h3Index: string;
  resolution: number;
  ancestors: AncestorInfo[];
  totalAncestors: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for DIGIPIN parent request
 */
export interface DigipinParentResponse {
  digipinCode: string;
  level: number;
  parent: string;
  parentLevel: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for DIGIPIN children request
 */
export interface DigipinChildrenResponse {
  digipinCode: string;
  level: number;
  children: string[];
  childrenLevel: number;
  totalChildren: number;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Response for DIGIPIN ancestors request
 */
export interface DigipinAncestorsResponse {
  digipinCode: string;
  level: number;
  ancestors: AncestorInfo[];
  totalAncestors: number;
  center: {
    latitude: number;
    longitude: number;
  };
}
