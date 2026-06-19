import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SpatialConverter } from 'h3-digipin';
import { getResolution } from 'h3-js';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  H3ToDigipinResponse,
  DigipinToH3Response,
  BulkH3ToDigipinResponse,
  BulkDigipinToH3Response,
} from '../dto/h3-digipin.dto';

/**
 * H3DigipinService
 *
 * Stack 3: H3 ↔ DIGIPIN Conversion Operations
 *
 * Handles direct bidirectional conversion between H3 hexagons and DIGIPIN grid cells.
 *
 * Key Operations:
 * - H3 → DIGIPIN cells (ALL overlapping cells, not just center-point)
 * - DIGIPIN → H3 cells (ALL overlapping cells, not just center-point)
 * - Bulk operations for efficiency
 *
 * IMPLEMENTATION:
 * - Uses h3-digipin library for complete spatial coverage
 * - Returns ALL overlapping cells (4-6 cells typical for H3-9 → DIGIPIN-6)
 * - 400-600% more complete coverage than center-point method
 *
 * Data Sources:
 * - h3-digipin library: SpatialConverter for complete spatial relationships
 * - Redis Cache: Expensive conversions (1 hour TTL)
 * - NO database (pure algorithmic)
 */
@Injectable()
export class H3DigipinService {
  private readonly logger = new Logger(H3DigipinService.name);
  private readonly DEFAULT_H3_RESOLUTION = 9;
  private readonly DEFAULT_DIGIPIN_LEVEL = 6;
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly spatialConverter: SpatialConverter;

  constructor(
    private readonly redisCache: RedisCacheService,
  ) {
    // Initialize h3-digipin spatial converter
    this.spatialConverter = new SpatialConverter();
  }

  /**
   * Convert H3 cell to DIGIPIN cells
   *
   * Returns ALL overlapping DIGIPIN cells (not just center-point conversion)
   *
   * Example:
   *   H3-9 cell → 4-6 DIGIPIN-6 cells (complete spatial coverage)
   */
  async h3ToDigipin(h3Index: string, level?: number): Promise<H3ToDigipinResponse> {
    const targetLevel = level || this.DEFAULT_DIGIPIN_LEVEL;

    this.logger.log(`Converting H3 ${h3Index} to DIGIPIN level ${targetLevel}`);

    // Validate H3 index
    if (!this.spatialConverter.isValidH3Index(h3Index)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Invalid H3 Index',
        message: `Invalid H3 index: ${h3Index}`,
        details: {
          providedH3Index: h3Index,
          suggestion: 'Provide a valid H3 index string (e.g., "8928308280fffff")',
        },
      });
    }

    // Validate DIGIPIN level
    if (!this.spatialConverter.validateDigipinLevel(targetLevel)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Invalid DIGIPIN Level',
        message: `DIGIPIN level must be between 1 and 10 (received: ${targetLevel})`,
        details: {
          providedLevel: targetLevel,
          validRange: '1-10',
          suggestion: 'Level 6 is equivalent to H3 resolution 9',
        },
      });
    }

    // Check cache
    const cacheKey = `conversion:h3-digipin:${h3Index}:${targetLevel}`;
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Get H3 cell info
    const h3Resolution = getResolution(h3Index);
    const h3Center = this.spatialConverter.getH3Info(h3Index).center;

    // Convert H3 to ALL overlapping DIGIPIN cells
    const digipinCodes = this.spatialConverter.h3ToDigipin(h3Index, targetLevel);

    // Find primary DIGIPIN (the one containing H3 center)
    const primaryDigipin = this.spatialConverter.encodeToDigipin(
      h3Center.lat,
      h3Center.lng,
      targetLevel,
    );

    // Build response
    const result: H3ToDigipinResponse = {
      h3Index,
      h3Resolution,
      digipinLevel: targetLevel,
      digipinCodes: digipinCodes.sort(),
      totalCodes: digipinCodes.length,
      center: {
        latitude: h3Center.lat,
        longitude: h3Center.lng,
      },
      note: `Primary DIGIPIN: ${primaryDigipin}. Returns all ${digipinCodes.length} DIGIPIN cells that overlap with H3 hexagon.`,
    };

    // Cache result
    await this.redisCache.set(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );

    return result;
  }

  /**
   * Convert DIGIPIN cell to H3 cells
   *
   * Returns ALL overlapping H3 cells (not just center-point conversion)
   */
  async digipinToH3(digipinCode: string, resolution?: number): Promise<DigipinToH3Response> {
    const targetResolution = resolution || this.DEFAULT_H3_RESOLUTION;

    this.logger.log(`Converting DIGIPIN ${digipinCode} to H3 resolution ${targetResolution}`);

    // Validate DIGIPIN code
    if (!this.spatialConverter.isValidDigipinCode(digipinCode)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Invalid DIGIPIN Code',
        message: `Invalid DIGIPIN code: ${digipinCode}`,
        details: {
          providedCode: digipinCode,
          suggestion: 'Provide a valid DIGIPIN code (e.g., "NJ4VJM" for level 6)',
        },
      });
    }

    // Validate H3 resolution
    if (!this.spatialConverter.validateH3Resolution(targetResolution)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Invalid H3 Resolution',
        message: `H3 resolution must be between 0 and 15 (received: ${targetResolution})`,
        details: {
          providedResolution: targetResolution,
          validRange: '0-15',
          suggestion: 'Resolution 9 is equivalent to DIGIPIN level 6',
        },
      });
    }

    // Check cache
    const cacheKey = `conversion:digipin-h3:${digipinCode}:${targetResolution}`;
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for ${cacheKey}`);
      return JSON.parse(cached);
    }

    // Get DIGIPIN cell info
    const digipinLevel = this.spatialConverter.getDigipinLevel(digipinCode);
    const digipinCenter = this.spatialConverter.getDigipinCenter(digipinCode);

    // Convert DIGIPIN to ALL overlapping H3 cells
    const h3Indexes = this.spatialConverter.digipinToH3(digipinCode, targetResolution);

    // Find primary H3 (the one containing DIGIPIN center)
    const primaryH3 = this.spatialConverter.getH3Info(
      h3Indexes.find((h3) => {
        const h3Info = this.spatialConverter.getH3Info(h3);
        // Check if DIGIPIN center is close to this H3's center
        const distLat = Math.abs(h3Info.center.lat - digipinCenter.lat);
        const distLng = Math.abs(h3Info.center.lng - digipinCenter.lng);
        return distLat < 0.01 && distLng < 0.01;
      }) || h3Indexes[0],
    ).h3Index;

    // Build response
    const result: DigipinToH3Response = {
      digipinCode,
      digipinLevel,
      h3Resolution: targetResolution,
      h3Indexes: h3Indexes.sort(),
      totalCells: h3Indexes.length,
      center: {
        latitude: digipinCenter.lat,
        longitude: digipinCenter.lng,
      },
      note: `Primary H3: ${primaryH3}. Returns all ${h3Indexes.length} H3 cells that overlap with DIGIPIN cell.`,
    };

    // Cache result
    await this.redisCache.set(
      cacheKey,
      JSON.stringify(result),
      this.CACHE_TTL,
    );

    return result;
  }

  /**
   * Bulk convert H3 cells to DIGIPIN cells
   */
  async bulkH3ToDigipin(h3Indexes: string[], level?: number): Promise<BulkH3ToDigipinResponse> {
    const targetLevel = level || this.DEFAULT_DIGIPIN_LEVEL;

    this.logger.log(`Bulk converting ${h3Indexes.length} H3 cells to DIGIPIN level ${targetLevel}`);

    // Process in parallel
    const results = await Promise.all(
      h3Indexes.map(async (h3Index) => {
        try {
          const result = await this.h3ToDigipin(h3Index, targetLevel);
          return {
            h3Index: result.h3Index,
            h3Resolution: result.h3Resolution,
            digipinCodes: result.digipinCodes,
            totalCodes: result.totalCodes,
          };
        } catch (error) {
          this.logger.warn(`Failed to convert H3 ${h3Index}: ${error.message}`);
          return {
            h3Index,
            h3Resolution: 0,
            digipinCodes: [],
            totalCodes: 0,
          };
        }
      }),
    );

    // Collect all unique DIGIPIN codes
    const allDigipinCodes = new Set<string>();
    results.forEach((r) => r.digipinCodes.forEach((code) => allDigipinCodes.add(code)));

    return {
      digipinLevel: targetLevel,
      results,
      totalProcessed: h3Indexes.length,
      totalDigipinCodes: allDigipinCodes.size,
    };
  }

  /**
   * Bulk convert DIGIPIN cells to H3 cells
   */
  async bulkDigipinToH3(digipinCodes: string[], resolution?: number): Promise<BulkDigipinToH3Response> {
    const targetResolution = resolution || this.DEFAULT_H3_RESOLUTION;

    this.logger.log(`Bulk converting ${digipinCodes.length} DIGIPIN cells to H3 resolution ${targetResolution}`);

    // Process in parallel
    const results = await Promise.all(
      digipinCodes.map(async (digipinCode) => {
        try {
          const result = await this.digipinToH3(digipinCode, targetResolution);
          return {
            digipinCode: result.digipinCode,
            digipinLevel: result.digipinLevel,
            h3Indexes: result.h3Indexes,
            totalCells: result.totalCells,
          };
        } catch (error) {
          this.logger.warn(`Failed to convert DIGIPIN ${digipinCode}: ${error.message}`);
          return {
            digipinCode,
            digipinLevel: 0,
            h3Indexes: [],
            totalCells: 0,
          };
        }
      }),
    );

    // Collect all unique H3 indexes
    const allH3Indexes = new Set<string>();
    results.forEach((r) => r.h3Indexes.forEach((h3) => allH3Indexes.add(h3)));

    return {
      h3Resolution: targetResolution,
      results,
      totalProcessed: digipinCodes.length,
      totalH3Cells: allH3Indexes.size,
    };
  }
}
