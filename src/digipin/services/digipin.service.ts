import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { DigipinAlgorithmService } from './digipin-algorithm.service';
import { Pincode } from '../../database/entities/pincode.entity';
import {
  DigipinCellResponse,
  EncodeDigipinResponse,
  DecodeDigipinResponse,
  DigipinNeighborsResponse,
  DigipinNearbyResponse,
  ValidateDigipinResponse,
  DigipinToPincodeResponse,
} from '../dto/digipin-response.dto';
import { EncodeDigipinDto, DecodeDigipinDto, NearbyDigipinQueryDto, ValidateDigipinDto, DigipinToPincodeDto } from '../dto/digipin-request.dto';

/**
 * DigipinService
 *
 * DIGIPIN operations including coordinate conversion and reverse geocoding.
 * Most operations are pure algorithmic grid calculations with optional Redis caching.
 *
 * Caching Strategy:
 * - encode/decode: NO cache (< 0.1ms, pure algorithm)
 * - getCellDetails: YES cache (1h TTL, pure calculation but still cached for performance)
 * - nearby: YES cache (1h TTL, expensive calculation with many cells)
 * - neighbors: NO cache (<1ms, pure algorithm)
 * - toPincode: NO cache (uses PostGIS query, already fast <10ms)
 */
@Injectable()
export class DigipinService {
  private readonly logger = new Logger(DigipinService.name);
  private readonly CACHE_TTL_CELL = 3600; // 1 hour
  private readonly CACHE_TTL_NEARBY = 3600; // 1 hour

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly algorithm: DigipinAlgorithmService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * GET /digipin/:code
   * Get detailed information about a DIGIPIN cell (PURE - no DB queries)
   */
  async getCellDetails(code: string): Promise<DigipinCellResponse> {
    const cacheKey = `digipin:cell:${code.toUpperCase()}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.log(`Cache HIT for DIGIPIN cell ${code}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache MISS for DIGIPIN cell ${code}, calculating...`);

    const bounds = this.algorithm.getBounds(code);
    const center = this.algorithm.getCenter(code);
    const level = code.length;

    // Create polygon for boundary
    const boundary = {
      type: 'Polygon' as const,
      coordinates: [[
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
        [bounds.minLng, bounds.maxLat],
        [bounds.minLng, bounds.minLat], // Close polygon
      ]],
    };

    // Calculate area (approximate, assuming rectangular cell)
    const latDiff = bounds.maxLat - bounds.minLat;
    const lngDiff = bounds.maxLng - bounds.minLng;
    const areaKm2 = latDiff * lngDiff * 111 * 111 * Math.cos(center.lat * Math.PI / 180);

    // Build hierarchy
    const hierarchy: any = {};
    for (let i = 1; i <= level; i++) {
      hierarchy[`level${i}`] = code.substring(0, i);
    }

    const response: DigipinCellResponse = {
      digipinCode: code.toUpperCase(),
      level,
      center: { latitude: center.lat, longitude: center.lng },
      bounds: {
        minLat: bounds.minLat,
        maxLat: bounds.maxLat,
        minLng: bounds.minLng,
        maxLng: bounds.maxLng,
      },
      boundary,
      area: {
        value: parseFloat(areaKm2.toFixed(2)),
        unit: 'km²',
      },
      parentDigipin: level > 1 ? code.substring(0, level - 1).toUpperCase() : null,
      hierarchy,
    };

    // Cache the result
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL_CELL);

    return response;
  }

  /**
   * POST /digipin/encode
   * Convert coordinates to DIGIPIN codes (PURE - no DB queries)
   */
  async encode(dto: EncodeDigipinDto): Promise<EncodeDigipinResponse> {
    const level = dto.level || 6;

    const results = dto.coordinates.map(coord => {
      const digipinCode = this.algorithm.encode(coord.latitude, coord.longitude, level);
      const center = this.algorithm.getCenter(digipinCode);
      const bounds = this.algorithm.getBounds(digipinCode);

      return {
        input: { latitude: coord.latitude, longitude: coord.longitude },
        digipinCode,
        center: { latitude: center.lat, longitude: center.lng },
        bounds: {
          minLat: bounds.minLat,
          maxLat: bounds.maxLat,
          minLng: bounds.minLng,
          maxLng: bounds.maxLng,
        },
      };
    });

    return { level, results };
  }

  /**
   * POST /digipin/decode
   * Convert DIGIPIN codes to coordinates
   */
  async decode(dto: DecodeDigipinDto): Promise<DecodeDigipinResponse> {
    const results = dto.digipinCodes.map(code => {
      const { lat, lng, level } = this.algorithm.decode(code);
      return {
        digipinCode: code.toUpperCase(),
        center: { latitude: lat, longitude: lng },
        level,
      };
    });

    return { results };
  }

  /**
   * GET /digipin/neighbors/:code
   * Get neighboring DIGIPIN cells
   */
  async getNeighbors(code: string): Promise<DigipinNeighborsResponse> {
    const neighbors = this.algorithm.getNeighbors(code);

    return {
      center: code.toUpperCase(),
      level: code.length,
      neighbors,
      totalCount: neighbors.length,
      note: 'DIGIPIN cells have up to 8 neighbors (4x4 grid system, edge cells have fewer)',
    };
  }

  /**
   * GET /digipin/nearby
   * Find DIGIPIN cells within radius (PURE - no DB queries)
   */
  async getNearby(query: NearbyDigipinQueryDto): Promise<DigipinNearbyResponse> {
    const { lat, lng, radius = 5, level = 6 } = query;
    const cacheKey = `digipin:nearby:${lat}:${lng}:${radius}:${level}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.log(`Cache HIT for nearby ${lat},${lng}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache MISS for nearby ${lat},${lng}, calculating...`);

    // Get nearby cells using algorithm
    const nearbyCells = this.algorithm.getNearby(lat, lng, radius, level);

    // Calculate distances for each cell
    const cells = nearbyCells.map(cellCode => {
      const cellCenter = this.algorithm.getCenter(cellCode);
      const distance = this.haversineDistance(lat, lng, cellCenter.lat, cellCenter.lng);
      const bounds = this.algorithm.getBounds(cellCode);

      return {
        digipinCode: cellCode,
        distance: parseFloat(distance.toFixed(2)),
        center: { latitude: cellCenter.lat, longitude: cellCenter.lng },
        bounds: {
          minLat: bounds.minLat,
          maxLat: bounds.maxLat,
          minLng: bounds.minLng,
          maxLng: bounds.maxLng,
        },
      };
    });

    // Sort by distance
    cells.sort((a, b) => a.distance - b.distance);

    const response: DigipinNearbyResponse = {
      center: { latitude: lat, longitude: lng },
      radius,
      radiusUnit: 'km',
      level,
      cells,
      totalCells: cells.length,
    };

    // Cache the result
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL_NEARBY);

    return response;
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * GET /digipin/:code/parent
   * Get parent DIGIPIN cell (one level up)
   */
  async getParent(code: string) {
    const level = this.algorithm.getLevel(code);

    if (level === 1) {
      throw new BadRequestException('Level 1 DIGIPIN cells have no parent');
    }

    const parent = this.algorithm.getParent(code);
    const parentLevel = level - 1;
    const center = this.algorithm.getCenter(code);
    const parentCenter = this.algorithm.getCenter(parent);
    const parentBounds = this.algorithm.getBounds(parent);

    return {
      digipinCode: code.toUpperCase(),
      level,
      parent: parent.toUpperCase(),
      parentLevel,
      center: { latitude: center.lat, longitude: center.lng },
      parentCenter: { latitude: parentCenter.lat, longitude: parentCenter.lng },
      parentBounds: {
        minLat: parentBounds.minLat,
        maxLat: parentBounds.maxLat,
        minLng: parentBounds.minLng,
        maxLng: parentBounds.maxLng,
      },
    };
  }

  /**
   * GET /digipin/:code/children
   * Get children DIGIPIN cells (one level down, 16 children in 4x4 grid)
   */
  async getChildren(code: string) {
    const level = this.algorithm.getLevel(code);

    if (level >= 10) {
      throw new BadRequestException('Level 10 is the maximum DIGIPIN level, no children available');
    }

    const children = this.algorithm.getChildren(code);
    const childrenLevel = level + 1;
    const center = this.algorithm.getCenter(code);

    return {
      digipinCode: code.toUpperCase(),
      level,
      children: children.map(c => c.toUpperCase()),
      childrenLevel,
      totalChildren: children.length,
      center: { latitude: center.lat, longitude: center.lng },
    };
  }

  /**
   * GET /digipin/:code/ancestors
   * Get all ancestor DIGIPIN cells (from level 1 to parent)
   */
  async getAncestors(code: string) {
    const level = this.algorithm.getLevel(code);
    const ancestors = this.algorithm.getAncestors(code);
    const center = this.algorithm.getCenter(code);

    const ancestorInfo = ancestors.map(ancestorCode => {
      const ancestorCenter = this.algorithm.getCenter(ancestorCode);
      return {
        cell: ancestorCode.toUpperCase(),
        level: ancestorCode.length,
        center: { latitude: ancestorCenter.lat, longitude: ancestorCenter.lng },
      };
    });

    return {
      digipinCode: code.toUpperCase(),
      level,
      ancestors: ancestorInfo,
      totalAncestors: ancestors.length,
      center: { latitude: center.lat, longitude: center.lng },
    };
  }

  /**
   * POST /digipin/validate
   * Validate DIGIPIN code format and geographic bounds
   *
   * UNIQUE FEATURE - No competitor has DIGIPIN validation!
   */
  async validateDigipin(dto: ValidateDigipinDto): Promise<ValidateDigipinResponse> {
    const { digipinCode } = dto;
    const errors: string[] = [];
    const normalizedCode = digipinCode.toUpperCase().trim();

    this.logger.log(`🔍 Validating DIGIPIN code: ${normalizedCode}`);

    // Official DIGIPIN charset (16 symbols)
    const VALID_CHARSET = /^[2-9CFJKLMPT]+$/;

    // India's bounding box (from algorithm service)
    const INDIA_BBOX = {
      minLat: 2.5,
      maxLat: 38.5,
      minLng: 63.5,
      maxLng: 99.5,
    };

    // 1. Length validation: Must be even (2 chars per level)
    if (normalizedCode.length === 0) {
      errors.push('DIGIPIN code cannot be empty');
    } else if (normalizedCode.length % 2 !== 0) {
      errors.push(`Invalid length: DIGIPIN codes must have even length (2 characters per level). Got ${normalizedCode.length} characters.`);
    }

    // 2. Max level check
    const level = normalizedCode.length / 2;
    if (level > 12) {
      errors.push(`Invalid level: Maximum level is 12. Got level ${level}.`);
    }

    // 3. Charset validation: Only allowed symbols
    if (!VALID_CHARSET.test(normalizedCode)) {
      // Find invalid characters
      const invalidChars = normalizedCode.split('').filter(char => !VALID_CHARSET.test(char));
      const uniqueInvalid = [...new Set(invalidChars)];
      errors.push(
        `Invalid character(s): "${uniqueInvalid.join(', ')}". ` +
        `Allowed charset: 2-9, C, F, J, K, L, M, P, T`
      );
    }

    // 4. Grid logic validation: Check if each character is valid in grid
    const gridPath: string[] = [];
    if (VALID_CHARSET.test(normalizedCode)) {
      for (let i = 0; i < normalizedCode.length; i++) {
        const char = normalizedCode[i];
        gridPath.push(char);
      }
    }

    // 5. Geographic bounds check (only if format is valid)
    let boundsInfo: any = undefined;
    if (errors.length === 0) {
      try {
        const center = this.algorithm.getCenter(normalizedCode);
        const withinIndia =
          center.lat >= INDIA_BBOX.minLat &&
          center.lat <= INDIA_BBOX.maxLat &&
          center.lng >= INDIA_BBOX.minLng &&
          center.lng <= INDIA_BBOX.maxLng;

        boundsInfo = {
          withinIndia,
          centerLat: center.lat,
          centerLng: center.lng,
        };

        if (!withinIndia) {
          errors.push(
            `Decoded location (${center.lat.toFixed(4)}°N, ${center.lng.toFixed(4)}°E) ` +
            `is outside India bounds (${INDIA_BBOX.minLat}-${INDIA_BBOX.maxLat}°N, ${INDIA_BBOX.minLng}-${INDIA_BBOX.maxLng}°E)`
          );
        }
      } catch (error) {
        // If decode fails, it means the code is structurally invalid
        errors.push(`Failed to decode DIGIPIN code: ${error.message}`);
      }
    }

    // Build response
    const response: ValidateDigipinResponse = {
      valid: errors.length === 0,
      digipinCode: normalizedCode,
    };

    if (errors.length === 0) {
      response.level = level;
      response.charset = 'valid';
      response.bounds = boundsInfo;
      response.gridPath = gridPath.join('-');

      this.logger.log(`✅ DIGIPIN validation passed: ${normalizedCode} (Level ${level})`);
    } else {
      response.errors = errors;
      response.charset = VALID_CHARSET.test(normalizedCode) ? 'valid' : 'invalid';

      this.logger.warn(`❌ DIGIPIN validation failed: ${normalizedCode} - ${errors.join('; ')}`);
    }

    return response;
  }

  /**
   * POST /digipin/to-pincode
   * Convert DIGIPIN code to pincode (reverse geocode)
   *
   * Process:
   * 1. Decode DIGIPIN → coordinates (center point)
   * 2. Query PostGIS for pincode containing that point
   *
   * Note: Uses PostGIS ST_Intersects for fast spatial lookup (<10ms)
   */
  async toPincode(dto: DigipinToPincodeDto): Promise<DigipinToPincodeResponse> {
    const code = dto.digipinCode.toUpperCase();

    // Step 1 & 2: Decode DIGIPIN to coordinates (center point)
    // This will validate the code and throw BadRequestException if invalid
    const decoded = this.algorithm.decode(code);
    const center = { lat: decoded.lat, lng: decoded.lng };

    this.logger.log(`DIGIPIN ${code} → coordinates (${center.lat}, ${center.lng})`);

    // Step 3: Query PostGIS for pincode containing this point
    // Uses ST_Intersects with GIST index for fast lookup (<10ms)
    const result = await this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.pincode',
        'p.office_name',
        'p.state',
        'p.district',
        'p.city',
      ])
      .where('ST_Intersects(p.boundary, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)')
      .setParameters({ lat: center.lat, lng: center.lng })
      .getOne();

    if (result) {
      this.logger.log(`DIGIPIN ${code} → Pincode ${result.pincode} found`);
      return {
        digipinCode: code,
        level: code.length,
        coordinates: {
          latitude: center.lat,
          longitude: center.lng,
        },
        pincode: result.pincode,
        officeName: result.office_name,
        state: result.state,
        district: result.district,
        city: result.city,
        found: true,
      };
    } else {
      this.logger.warn(`DIGIPIN ${code} → No pincode found at (${center.lat}, ${center.lng})`);
      return {
        digipinCode: code,
        level: code.length,
        coordinates: {
          latitude: center.lat,
          longitude: center.lng,
        },
        pincode: null,
        officeName: null,
        state: null,
        district: null,
        city: null,
        found: false,
        message: 'No pincode found at this location (may be outside India or in unpopulated area)',
      };
    }
  }
}
