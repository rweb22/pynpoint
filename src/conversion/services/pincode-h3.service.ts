import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  cellToBoundary,
  cellToLatLng,
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
 * OPTIMIZED ALGORITHM: Uses Pre-computed Native PostgreSQL H3 Index
 *
 * Pincode → H3:
 * 1. Read pre-computed h3_cells from PostgreSQL (30.5M cells cached)
 * 2. For "overlaps": Return all cells directly (instant!)
 * 3. For "contains": Filter cells whose centers are inside polygon
 *
 * OLD APPROACH (DEPRECATED):
 * - Was computing cells on-the-fly using JavaScript polygonToCells()
 * - 10-100x slower than reading from cache
 *
 * H3 → Pincode:
 * 1. Validate resolution = 9 (only supported resolution)
 * 2. For "overlaps": Direct Redis lookup (pre-built reverse index)
 * 3. For "contains": Redis + PostGIS ST_Contains filter
 *
 * Data Sources:
 * - PostgreSQL h3_cells column: 30.5M pre-computed cells (source of truth)
 * - Redis h3:{index} sets: Reverse index for fast H3 → Pincode lookups
 * - Resolution: Fixed at 9 (~0.105 km²) - matches index granularity
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
   *
   * OPTIMIZED: Uses pre-computed h3_cells from PostgreSQL (30.5M cells cached)
   * - Pincode → H3: Read directly from h3_cells column (instant!)
   * - H3 → Pincode: Read from Redis reverse index
   *
   * OLD (SLOW): Was computing cells on-the-fly using polygonToCells()
   * NEW (FAST): Uses native PostgreSQL H3 extension results
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

    // Step 1: Get pincode with pre-computed H3 cells from database
    const pincodeEntity = await this.pincodeRepository.findOne({
      where: { pincode },
      select: ['pincode', 'h3_cells', 'boundary'],
    });

    if (!pincodeEntity) {
      throw new NotFoundException(`Pincode ${pincode} not found`);
    }

    // Step 2: Check if H3 cells are available (pre-computed by H3IndexService)
    if (!pincodeEntity.h3_cells || pincodeEntity.h3_cells.length === 0) {
      // This pincode has no boundary data or failed during H3 generation
      throw new BadRequestException(
        `Pincode ${pincode} has no H3 cells. ` +
          `This pincode either has no boundary geometry or was skipped during indexing.`,
      );
    }

    // Step 3: Get H3 cells directly from cached column (instant!)
    let h3Cells = pincodeEntity.h3_cells;

    // Step 4: Handle "contains" relationship filter
    // For "contains", we need to filter cells whose centers are inside the polygon
    let note: string | undefined;

    if (relationship === 'contains') {
      // Parse boundary for filtering
      const geometry =
        typeof pincodeEntity.boundary === 'string'
          ? JSON.parse(pincodeEntity.boundary)
          : pincodeEntity.boundary;

      if (!geometry) {
        throw new BadRequestException(
          `Pincode ${pincode} has H3 cells but no boundary geometry. ` +
            `Cannot apply "contains" filter.`,
        );
      }

      // Filter to cells whose centers are inside polygon
      h3Cells = h3Cells.filter((cell) => {
        const [lat, lng] = cellToLatLng(cell);
        return this.isPointInPolygon([lng, lat], geometry);
      });

      if (h3Cells.length === 0) {
        note =
          'No H3 cells fully contained within pincode boundary. ' +
          'Try relationship=overlaps for intersecting cells.';
      }
    }

    // Step 5: Build response
    const result: PincodeToH3Response = {
      pincode,
      resolution: this.FIXED_RESOLUTION,
      h3Cells,
      totalCells: h3Cells.length,
      relationship,
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
