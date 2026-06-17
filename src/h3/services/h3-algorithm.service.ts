import { Injectable, BadRequestException } from '@nestjs/common';
import {
  latLngToCell,
  cellToLatLng,
  cellToBoundary,
  getHexagonAreaAvg,
  gridDisk,
  cellToParent,
  cellToChildren,
  isValidCell,
  getResolution,
} from 'h3-js';

/**
 * H3AlgorithmService
 * 
 * Pure H3 algorithm operations using h3-js library.
 * No database or Redis access - just H3 math.
 * 
 * H3 is Uber's Hexagonal Hierarchical Spatial Index:
 * - Resolution 0: ~4,357,449 km² per hexagon (Earth divided into 122 hexagons)
 * - Resolution 9: ~0.105 km² per hexagon (used for pincode mapping)
 * - Resolution 15: ~0.0009 m² per hexagon (max precision)
 * 
 * All operations are <1ms (pure computation, no I/O).
 */
@Injectable()
export class H3AlgorithmService {
  /**
   * Encode coordinates to H3 index
   * 
   * @param lat - Latitude
   * @param lng - Longitude
   * @param resolution - H3 resolution (0-15, default: 9)
   * @returns H3 index (e.g., "8928308280fffff")
   */
  encode(lat: number, lng: number, resolution: number = 9): string {
    // Validate inputs
    if (lat < -90 || lat > 90) {
      throw new BadRequestException(`Latitude must be between -90 and 90, got ${lat}`);
    }
    if (lng < -180 || lng > 180) {
      throw new BadRequestException(`Longitude must be between -180 and 180, got ${lng}`);
    }
    if (resolution < 0 || resolution > 15) {
      throw new BadRequestException(`Resolution must be between 0 and 15, got ${resolution}`);
    }

    try {
      return latLngToCell(lat, lng, resolution);
    } catch (error) {
      throw new BadRequestException(
        `Failed to encode coordinates (${lat}, ${lng}) at resolution ${resolution}: ${error.message}`
      );
    }
  }

  /**
   * Decode H3 index to center coordinates
   * 
   * @param h3Index - H3 index (e.g., "8928308280fffff")
   * @returns { lat, lng, resolution }
   */
  decode(h3Index: string): { lat: number; lng: number; resolution: number } {
    // Validate H3 index
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    try {
      const [lat, lng] = cellToLatLng(h3Index);
      const resolution = getResolution(h3Index);
      
      return { lat, lng, resolution };
    } catch (error) {
      throw new BadRequestException(`Failed to decode H3 index ${h3Index}: ${error.message}`);
    }
  }

  /**
   * Get center coordinates of H3 cell
   * 
   * @param h3Index - H3 index
   * @returns { lat, lng }
   */
  getCenter(h3Index: string): { lat: number; lng: number } {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    const [lat, lng] = cellToLatLng(h3Index);
    return { lat, lng };
  }

  /**
   * Get boundary polygon of H3 cell
   * 
   * @param h3Index - H3 index
   * @returns GeoJSON Polygon coordinates
   */
  getBoundary(h3Index: string): number[][][] {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    const boundary = cellToBoundary(h3Index, true); // true = GeoJSON format [lng, lat]
    
    // Close the polygon (first point === last point)
    const closedBoundary = [...boundary, boundary[0]];
    
    // Return as GeoJSON Polygon format
    return [closedBoundary];
  }

  /**
   * Get area of H3 cell in km²
   *
   * @param h3Index - H3 index
   * @returns Area in km²
   */
  getArea(h3Index: string): number {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    return getHexagonAreaAvg(getResolution(h3Index), 'km2');
  }

  /**
   * Get neighboring H3 cells
   * 
   * @param h3Index - Center H3 index
   * @param k - Ring distance (default: 1 = immediate neighbors)
   * @returns Array of H3 indices
   */
  getNeighbors(h3Index: string, k: number = 1): string[] {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    if (k < 1 || k > 10) {
      throw new BadRequestException(`Ring distance k must be between 1 and 10, got ${k}`);
    }

    try {
      // gridDisk returns center + all cells within k rings
      // To get only neighbors, we use k=1 and exclude the center
      const disk = gridDisk(h3Index, k);
      return disk.filter(cell => cell !== h3Index);
    } catch (error) {
      throw new BadRequestException(`Failed to get neighbors for ${h3Index}: ${error.message}`);
    }
  }

  /**
   * Get parent H3 cell at coarser resolution
   *
   * @param h3Index - Child H3 index
   * @param parentResolution - Target parent resolution (optional, defaults to current - 1)
   * @returns Parent H3 index
   */
  getParent(h3Index: string, parentResolution?: number): string {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    const currentResolution = getResolution(h3Index);

    // Default to immediate parent (one level up)
    const targetResolution = parentResolution !== undefined ? parentResolution : currentResolution - 1;

    if (targetResolution < 0 || targetResolution > 15) {
      throw new BadRequestException(`Parent resolution must be between 0 and 15, got ${targetResolution}`);
    }

    if (targetResolution >= currentResolution) {
      throw new BadRequestException(
        `Parent resolution (${targetResolution}) must be less than current resolution (${currentResolution})`
      );
    }

    try {
      return cellToParent(h3Index, targetResolution);
    } catch (error) {
      throw new BadRequestException(
        `Failed to get parent for ${h3Index} at resolution ${targetResolution}: ${error.message}`
      );
    }
  }

  /**
   * Get children H3 cells at finer resolution
   *
   * @param h3Index - Parent H3 index
   * @param childResolution - Target child resolution (optional, defaults to current + 1)
   * @returns Array of child H3 indices
   */
  getChildren(h3Index: string, childResolution?: number): string[] {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    const currentResolution = getResolution(h3Index);

    // Default to immediate children (one level down)
    const targetResolution = childResolution !== undefined ? childResolution : currentResolution + 1;

    if (targetResolution < 0 || targetResolution > 15) {
      throw new BadRequestException(`Child resolution must be between 0 and 15, got ${targetResolution}`);
    }

    if (targetResolution <= currentResolution) {
      throw new BadRequestException(
        `Child resolution (${targetResolution}) must be greater than current resolution (${currentResolution})`
      );
    }

    try {
      return cellToChildren(h3Index, targetResolution);
    } catch (error) {
      throw new BadRequestException(
        `Failed to get children for ${h3Index} at resolution ${targetResolution}: ${error.message}`
      );
    }
  }

  /**
   * Get all ancestors from current cell to resolution 0
   *
   * @param h3Index - Starting H3 index
   * @returns Array of ancestor H3 indices (ordered from immediate parent to resolution 0)
   */
  getAncestors(h3Index: string): string[] {
    if (!isValidCell(h3Index)) {
      throw new BadRequestException(`Invalid H3 index: ${h3Index}`);
    }

    const currentResolution = getResolution(h3Index);
    const ancestors: string[] = [];

    // Build ancestor chain from parent to resolution 0
    for (let res = currentResolution - 1; res >= 0; res--) {
      ancestors.push(cellToParent(h3Index, res));
    }

    return ancestors;
  }

  /**
   * Haversine distance between two points (same as DIGIPIN)
   */
  haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
