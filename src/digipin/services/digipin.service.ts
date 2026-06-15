import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { DigipinAlgorithmService } from './digipin-algorithm.service';
import {
  DigipinCellResponse,
  EncodeDigipinResponse,
  DecodeDigipinResponse,
  DigipinNeighborsResponse,
  DigipinNearbyResponse,
} from '../dto/digipin-response.dto';
import { EncodeDigipinDto, DecodeDigipinDto, NearbyDigipinQueryDto } from '../dto/digipin-request.dto';

/**
 * DigipinService
 * 
 * Business logic service for DIGIPIN operations.
 * Combines pure algorithmic operations with database queries.
 * 
 * Caching Strategy:
 * - encode/decode: NO cache (< 0.1ms, pure algorithm)
 * - getCellDetails: YES cache (1h TTL, includes DB query)
 * - nearby: YES cache (1h TTL, expensive calculation)
 */
@Injectable()
export class DigipinService {
  private readonly logger = new Logger(DigipinService.name);
  private readonly CACHE_TTL_CELL = 3600; // 1 hour
  private readonly CACHE_TTL_NEARBY = 3600; // 1 hour

  constructor(
    private readonly algorithm: DigipinAlgorithmService,
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * GET /digipin/:code
   * Get detailed information about a DIGIPIN cell
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

    // Find overlapping pincodes
    const pincodes = await this.findOverlappingPincodes(bounds);

    // Build hierarchy
    const hierarchy: any = {};
    for (let i = 1; i <= level; i++) {
      hierarchy[`level${i}`] = code.substring(0, i);
    }

    const response: DigipinCellResponse = {
      digipinCode: code.toUpperCase(),
      level,
      center: { latitude: center.lat, longitude: center.lng },
      boundary,
      area: {
        value: parseFloat(areaKm2.toFixed(2)),
        unit: 'km²',
      },
      pincodes: pincodes.map(p => p.pincode),
      pincodeCount: pincodes.length,
      parentDigipin: level > 1 ? code.substring(0, level - 1).toUpperCase() : null,
      hierarchy,
    };

    // Cache the result
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL_CELL);

    return response;
  }

  /**
   * POST /digipin/encode
   * Convert coordinates to DIGIPIN codes
   */
  async encode(dto: EncodeDigipinDto): Promise<EncodeDigipinResponse> {
    const level = dto.level || 6;
    const results: Array<{
      input: { latitude: number; longitude: number };
      digipinCode: string;
      pincodes: string[];
    }> = [];

    for (const coord of dto.coordinates) {
      const digipinCode = this.algorithm.encode(coord.latitude, coord.longitude, level);

      // Get pincodes for this cell
      const bounds = this.algorithm.getBounds(digipinCode);
      const pincodes = await this.findOverlappingPincodes(bounds);

      results.push({
        input: { latitude: coord.latitude, longitude: coord.longitude },
        digipinCode,
        pincodes: pincodes.map(p => p.pincode),
      });
    }

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
   * Find DIGIPIN cells within radius
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

    // Get pincodes and calculate distances for each cell
    const cells: Array<{
      digipinCode: string;
      distance: number;
      pincodes: string[];
      center: { latitude: number; longitude: number };
    }> = [];
    const allPincodes = new Set<string>();

    for (const cellCode of nearbyCells) {
      const cellCenter = this.algorithm.getCenter(cellCode);
      const distance = this.haversineDistance(lat, lng, cellCenter.lat, cellCenter.lng);

      // Get pincodes for this cell
      const bounds = this.algorithm.getBounds(cellCode);
      const pincodes = await this.findOverlappingPincodes(bounds);

      pincodes.forEach(p => allPincodes.add(p.pincode));

      cells.push({
        digipinCode: cellCode,
        distance: parseFloat(distance.toFixed(2)),
        pincodes: pincodes.map(p => p.pincode),
        center: { latitude: cellCenter.lat, longitude: cellCenter.lng },
      });
    }

    // Sort by distance
    cells.sort((a, b) => a.distance - b.distance);

    const response: DigipinNearbyResponse = {
      center: { latitude: lat, longitude: lng },
      radius,
      radiusUnit: 'km',
      level,
      cells,
      totalCells: cells.length,
      uniquePincodes: allPincodes.size,
    };

    // Cache the result
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL_NEARBY);

    return response;
  }

  /**
   * Find pincodes that overlap with DIGIPIN cell bounds
   */
  private async findOverlappingPincodes(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): Promise<Pincode[]> {
    // Query pincodes whose centroid falls within the DIGIPIN cell
    // Using raw SQL for PostGIS spatial query
    const pincodes = await this.pincodeRepository
      .createQueryBuilder('pincode')
      .where('ST_Intersects(centroid, ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326))', {
        minLng: bounds.minLng,
        minLat: bounds.minLat,
        maxLng: bounds.maxLng,
        maxLat: bounds.maxLat,
      })
      .andWhere('is_active = :active', { active: true })
      .limit(100) // Safety limit
      .getMany();

    return pincodes;
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
}
