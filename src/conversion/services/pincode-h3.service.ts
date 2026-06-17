import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  polygonToCells,
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  getResolution,
} from 'h3-js';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon as turfPolygon } from '@turf/helpers';
import { Pincode } from '../../database/entities/pincode.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { RedisPersistentService } from '../../redis/redis-persistent.service';
import {
  PincodeToH3Response,
  H3ToPincodeResponse,
  BulkPincodeToH3Response,
  BulkH3ToPincodeResponse,
} from '../dto/pincode-h3.dto';

/**
 * Service for Pincode ↔ H3 conversions
 * Stack 1 of Track 4
 *
 * ALGORITHM: Hybrid Spatial Overlap Detection
 *
 * Pincode → H3:
 * 1. Use polygonToCells() for core cells (centroid-based)
 * 2. Add 1-ring neighbors around boundary cells
 * 3. Validate boundary cells with proper overlap check
 *
 * H3 → Pincode:
 * 1. Validate resolution = 9 (only supported resolution)
 * 2. For "overlaps": Direct Redis lookup (pre-built index)
 * 3. For "contains": Redis + PostGIS ST_Contains filter
 *
 * Resolution: Fixed at 9 (~0.105 km²) - matches index granularity
 */
@Injectable()
export class PincodeH3Service {
  private readonly logger = new Logger(PincodeH3Service.name);
  private readonly FIXED_RESOLUTION = 9;
  private readonly MAX_CELLS = 5000; // Limit for large pincodes
  private readonly CACHE_TTL = 3600; // 1 hour

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly redisCache: RedisCacheService,
    private readonly redisPersistent: RedisPersistentService,
  ) {}

  /**
   * Convert Pincode to H3 cells (resolution 9 only)
   * Uses hybrid approach for accurate boundary detection
   */
  async pincodeToH3(
    pincode: string,
    relationship: 'overlaps' | 'contains' = 'overlaps',
  ): Promise<PincodeToH3Response> {
    this.logger.log(
      `Converting pincode ${pincode} to H3 (relationship: ${relationship})`,
    );

    // Check cache first
    const cacheKey = `conversion:pincode-to-h3:${pincode}:${relationship}`;
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Step 1: Get pincode from database
    const pincodeEntity = await this.pincodeRepository.findOne({
      where: { pincode },
    });

    if (!pincodeEntity) {
      throw new NotFoundException(`Pincode ${pincode} not found`);
    }

    if (!pincodeEntity.boundary) {
      throw new BadRequestException(
        `Pincode ${pincode} has no boundary geometry. ` +
          `This pincode cannot be converted to H3 cells.`,
      );
    }

    // Step 2: Parse and validate geometry
    const geometry =
      typeof pincodeEntity.boundary === 'string'
        ? JSON.parse(pincodeEntity.boundary)
        : pincodeEntity.boundary;

    const geometryType = geometry.type;
    if (!['Polygon', 'MultiPolygon'].includes(geometryType)) {
      throw new BadRequestException(
        `Invalid geometry type: ${geometryType}. Expected Polygon or MultiPolygon.`,
      );
    }

    // Step 3: Convert to H3 cells using hybrid approach
    let h3Cells: string[];

    try {
      if (geometryType === 'MultiPolygon') {
        // Handle multiple polygons (islands, disconnected areas)
        const allCells = new Set<string>();
        for (const polygonCoords of geometry.coordinates) {
          const cells = await this.hybridPolygonToCells(
            { type: 'Polygon', coordinates: polygonCoords },
            relationship,
          );
          cells.forEach((cell) => allCells.add(cell));
        }
        h3Cells = Array.from(allCells);
      } else {
        // Single polygon
        h3Cells = await this.hybridPolygonToCells(geometry, relationship);
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to convert pincode ${pincode} to H3: ${error.message}`,
      );
    }

    // Step 4: Check size limits
    if (h3Cells.length > this.MAX_CELLS) {
      this.logger.warn(
        `Large pincode: ${pincode} has ${h3Cells.length} H3 cells`,
      );
      throw new BadRequestException(
        `Pincode ${pincode} is too large (${h3Cells.length} H3 cells). ` +
          `Maximum: ${this.MAX_CELLS}. Consider using bulk operations.`,
      );
    }

    // Step 5: Handle empty results for "contains"
    let note: string | undefined;
    if (h3Cells.length === 0 && relationship === 'contains') {
      note =
        'No H3 cells fully contained within pincode boundary. ' +
        'Try relationship=overlaps for intersecting cells.';
    }

    // Step 6: Build response
    const result: PincodeToH3Response = {
      pincode,
      resolution: this.FIXED_RESOLUTION,
      h3Cells,
      totalCells: h3Cells.length,
      relationship,
      note,
    };

    // Step 7: Cache result
    await this.redisCache.set(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );

    return result;
  }

  /**
   * Convert H3 cell to Pincodes (resolution 9 only)
   * Uses Redis index for fast lookup
   */
  async h3ToPincode(
    h3Index: string,
    relationship: 'overlaps' | 'contains' = 'overlaps',
  ): Promise<H3ToPincodeResponse> {
    this.logger.log(
      `Converting H3 ${h3Index} to pincodes (relationship: ${relationship})`,
    );

    // Step 1: Validate resolution
    const resolution = getResolution(h3Index);
    if (resolution !== this.FIXED_RESOLUTION) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Invalid H3 Resolution',
        message: `H3 resolution must be 9 (received: resolution ${resolution})`,
        details: {
          providedResolution: resolution,
          requiredResolution: this.FIXED_RESOLUTION,
          providedH3Index: h3Index,
          suggestion:
            resolution < this.FIXED_RESOLUTION
              ? `Get resolution 9 descendants: GET /h3/${h3Index}/children?resolution=9`
              : `Get resolution 9 ancestor: GET /h3/${h3Index}/parent?resolution=9`,
          explanation:
            'Resolution 9 (~0.105 km²) matches our pincode-H3 index granularity',
        },
      });
    }

    // Check cache first
    const cacheKey = `conversion:h3-to-pincode:${h3Index}:${relationship}`;
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Step 2: Get cell center
    const [lat, lng] = cellToLatLng(h3Index);

    // Step 3: Lookup from Redis index
    const pincodes = await this.redisPersistent.smembers(`h3:${h3Index}`);

    let finalPincodes = pincodes;
    let note: string | undefined;

    // Step 4: For "contains", filter using PostGIS
    if (relationship === 'contains' && pincodes.length > 0) {
      finalPincodes = await this.filterContainedPincodes(h3Index, pincodes);

      if (finalPincodes.length === 0) {
        note =
          'No pincodes fully contained within H3 cell boundary. ' +
          'Try relationship=overlaps for intersecting pincodes.';
      }
    }

    // Step 5: Build response
    const result: H3ToPincodeResponse = {
      h3Index,
      resolution: this.FIXED_RESOLUTION,
      pincodes: finalPincodes.sort(),
      totalPincodes: finalPincodes.length,
      relationship,
      center: {
        latitude: lat,
        longitude: lng,
      },
      note,
    };

    // Step 6: Cache result
    await this.redisCache.set(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );

    return result;
  }

  /**
   * Bulk convert Pincodes to H3 cells
   */
  async bulkPincodeToH3(
    pincodes: string[],
    relationship: 'overlaps' | 'contains' = 'overlaps',
  ): Promise<BulkPincodeToH3Response> {
    this.logger.log(
      `Bulk converting ${pincodes.length} pincodes to H3 (relationship: ${relationship})`,
    );

    // Process in parallel with Promise.all
    const results = await Promise.all(
      pincodes.map(async (pincode) => {
        try {
          const result = await this.pincodeToH3(pincode, relationship);
          return {
            pincode: result.pincode,
            h3Cells: result.h3Cells,
            totalCells: result.totalCells,
            note: result.note,
          };
        } catch (error) {
          this.logger.warn(
            `Failed to convert pincode ${pincode}: ${error.message}`,
          );
          return {
            pincode,
            h3Cells: [],
            totalCells: 0,
            note: `Error: ${error.message}`,
          };
        }
      }),
    );

    const totalCells = results.reduce((sum, r) => sum + r.totalCells, 0);

    return {
      resolution: this.FIXED_RESOLUTION,
      relationship,
      results,
      totalProcessed: pincodes.length,
      totalCells,
    };
  }

  /**
   * Bulk convert H3 cells to Pincodes
   */
  async bulkH3ToPincode(
    h3Indexes: string[],
    relationship: 'overlaps' | 'contains' = 'overlaps',
  ): Promise<BulkH3ToPincodeResponse> {
    this.logger.log(
      `Bulk converting ${h3Indexes.length} H3 cells to pincodes (relationship: ${relationship})`,
    );

    // Process in parallel with Promise.all
    const results = await Promise.all(
      h3Indexes.map(async (h3Index) => {
        try {
          const result = await this.h3ToPincode(h3Index, relationship);
          return {
            h3Index: result.h3Index,
            resolution: result.resolution,
            pincodes: result.pincodes,
            totalPincodes: result.totalPincodes,
            note: result.note,
          };
        } catch (error) {
          this.logger.warn(
            `Failed to convert H3 ${h3Index}: ${error.message}`,
          );
          return {
            h3Index,
            resolution: this.FIXED_RESOLUTION as 9,
            pincodes: [],
            totalPincodes: 0,
            note: `Error: ${error.message}`,
          };
        }
      }),
    );

    const allPincodes = new Set<string>();
    results.forEach((r) => r.pincodes.forEach((p) => allPincodes.add(p)));

    return {
      relationship,
      results,
      totalProcessed: h3Indexes.length,
      uniquePincodes: allPincodes.size,
    };
  }

  /**
   * HYBRID ALGORITHM: Polygon to H3 cells with accurate boundary detection
   *
   * Steps:
   * 1. Get core cells using polygonToCells() (centroid-based)
   * 2. Identify boundary cells (cells with neighbors outside polygon)
   * 3. Add 1-ring neighbors around boundary
   * 4. Validate each candidate cell for actual overlap
   * 5. Filter based on relationship type (overlaps vs contains)
   */
  private async hybridPolygonToCells(
    geometry: any,
    relationship: 'overlaps' | 'contains',
  ): Promise<string[]> {
    // Step 1: Get core cells (centroid-based, fast)
    const coreCells = polygonToCells(geometry, this.FIXED_RESOLUTION, true);

    if (relationship === 'contains') {
      // For "contains", filter to cells whose centers are inside polygon
      return coreCells.filter((cell) => {
        const [lat, lng] = cellToLatLng(cell);
        return this.isPointInPolygon([lng, lat], geometry);
      });
    }

    // For "overlaps", use hybrid approach to catch boundary cells
    const allCells = new Set<string>(coreCells);

    // Step 2: Find boundary cells and get their 1-ring neighbors
    const candidateCells = new Set<string>();

    for (const cell of coreCells) {
      const neighbors = gridDisk(cell, 1);
      for (const neighbor of neighbors) {
        if (!coreCells.includes(neighbor)) {
          // This neighbor is outside core, might overlap at boundary
          candidateCells.add(neighbor);
        }
      }
    }

    // Step 3: Validate candidate boundary cells for actual overlap
    for (const cell of candidateCells) {
      if (this.cellOverlapsPolygon(cell, geometry)) {
        allCells.add(cell);
      }
    }

    return Array.from(allCells);
  }

  /**
   * Check if H3 cell overlaps with polygon
   * Returns true if ANY part of the cell intersects the polygon
   */
  private cellOverlapsPolygon(h3Cell: string, polygon: any): boolean {
    const cellBoundary = cellToBoundary(h3Cell, true); // GeoJSON format

    // Check if any vertex of cell is inside polygon
    for (const [lat, lng] of cellBoundary) {
      if (this.isPointInPolygon([lng, lat], polygon)) {
        return true;
      }
    }

    // Check if any vertex of polygon is inside cell
    const cellPoly = turfPolygon([
      cellBoundary.map(([lat, lng]) => [lng, lat]),
    ]);

    const coordinates =
      polygon.type === 'Polygon'
        ? polygon.coordinates
        : polygon.coordinates[0];

    for (const ring of coordinates) {
      for (const [lng, lat] of ring) {
        const pt = point([lng, lat]);
        if (booleanPointInPolygon(pt, cellPoly)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if point is inside polygon
   */
  private isPointInPolygon(pointCoords: number[], polygon: any): boolean {
    const pt = point([pointCoords[0], pointCoords[1]]);

    const coordinates =
      polygon.type === 'Polygon'
        ? polygon.coordinates
        : polygon.coordinates[0];

    const poly = turfPolygon(coordinates);
    return booleanPointInPolygon(pt, poly);
  }

  /**
   * Filter pincodes to only those that CONTAIN the H3 cell
   * Uses PostGIS ST_Contains for precise spatial filtering
   */
  private async filterContainedPincodes(
    h3Index: string,
    candidatePincodes: string[],
  ): Promise<string[]> {
    if (candidatePincodes.length === 0) return [];

    // Get H3 cell boundary
    const cellBoundary = cellToBoundary(h3Index, true); // GeoJSON format
    const cellPolygon = {
      type: 'Polygon',
      coordinates: [cellBoundary.map(([lat, lng]) => [lng, lat])],
    };

    // Query PostgreSQL with PostGIS ST_Contains
    const query = `
      SELECT pincode
      FROM pincode
      WHERE pincode = ANY($1)
        AND ST_Contains(
          ST_GeomFromGeoJSON(boundary),
          ST_GeomFromGeoJSON($2)
        )
    `;

    const result = await this.pincodeRepository.query(query, [
      candidatePincodes,
      JSON.stringify(cellPolygon),
    ]);

    return result.map((r: any) => r.pincode);
  }
}
