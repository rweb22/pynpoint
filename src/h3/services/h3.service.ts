import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { H3AlgorithmService } from './h3-algorithm.service';
import { RedisPersistentService } from '../../redis/redis-persistent.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  EncodeH3Dto,
  DecodeH3Dto,
  NearbyH3QueryDto,
} from '../dto/h3-request.dto';
import {
  H3CellResponse,
  EncodeH3Response,
  DecodeH3Response,
  H3NeighborsResponse,
  H3NearbyResponse,
} from '../dto/h3-response.dto';

/**
 * H3Service
 * 
 * Business logic for H3 operations.
 * Integrates H3AlgorithmService with Redis for pincode lookups.
 * 
 * Data Flow:
 * 1. H3AlgorithmService: Pure H3 math (encode/decode/neighbors)
 * 2. RedisPersistentService: H3 → Pincode mapping (built during initialization)
 * 3. RedisCacheService: Cache expensive operations (nearby search)
 */
@Injectable()
export class H3Service {
  private readonly logger = new Logger(H3Service.name);
  private readonly DEFAULT_RESOLUTION = 9; // Match initialization resolution

  constructor(
    private readonly algorithm: H3AlgorithmService,
    private readonly redisPersistent: RedisPersistentService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * GET /h3/:h3Index
   * Get detailed information about an H3 cell
   */
  async getCellDetails(h3Index: string): Promise<H3CellResponse> {
    const cacheKey = `h3:cell:${h3Index}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.log(`Cache HIT for H3 cell ${h3Index}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache MISS for H3 cell ${h3Index}, calculating...`);

    // Get H3 cell info
    const { lat, lng, resolution } = this.algorithm.decode(h3Index);
    const boundary = this.algorithm.getBoundary(h3Index);
    const area = this.algorithm.getArea(h3Index);

    // Get pincodes from Redis persistent store
    const pincodes = await this.getPincodesForH3(h3Index);

    const response: H3CellResponse = {
      h3Index,
      resolution,
      center: { latitude: lat, longitude: lng },
      boundary: {
        type: 'Polygon',
        coordinates: boundary,
      },
      area: {
        value: parseFloat(area.toFixed(3)),
        unit: 'km²',
      },
      pincodes,
      pincodeCount: pincodes.length,
    };

    // Cache for 1 hour
    await this.redisCache.set(cacheKey, JSON.stringify(response), 3600);

    return response;
  }

  /**
   * POST /h3/encode
   * Convert coordinates to H3 indices
   */
  async encode(dto: EncodeH3Dto): Promise<EncodeH3Response> {
    const resolution = dto.resolution || this.DEFAULT_RESOLUTION;
    const results: Array<{
      input: { latitude: number; longitude: number };
      h3Index: string;
      pincodes: string[];
    }> = [];

    for (const coord of dto.coordinates) {
      const h3Index = this.algorithm.encode(coord.latitude, coord.longitude, resolution);
      const pincodes = await this.getPincodesForH3(h3Index);

      results.push({
        input: { latitude: coord.latitude, longitude: coord.longitude },
        h3Index,
        pincodes,
      });
    }

    return { resolution, results };
  }

  /**
   * POST /h3/decode
   * Convert H3 indices to coordinates
   */
  async decode(dto: DecodeH3Dto): Promise<DecodeH3Response> {
    const results = dto.h3Indices.map((h3Index) => {
      const { lat, lng, resolution } = this.algorithm.decode(h3Index);
      return {
        h3Index,
        center: { latitude: lat, longitude: lng },
        resolution,
      };
    });

    return { results };
  }

  /**
   * GET /h3/neighbors/:h3Index
   * Get neighboring H3 cells
   */
  async getNeighbors(h3Index: string): Promise<H3NeighborsResponse> {
    const { resolution } = this.algorithm.decode(h3Index);
    const neighbors = this.algorithm.getNeighbors(h3Index);

    return {
      center: h3Index,
      resolution,
      neighbors,
      totalCount: neighbors.length,
      note: 'H3 hexagons have exactly 6 neighbors (except pentagons at icosahedron vertices)',
    };
  }

  /**
   * GET /h3/nearby
   * Find H3 cells within radius using BFS
   */
  async getNearby(query: NearbyH3QueryDto): Promise<H3NearbyResponse> {
    const { lat, lng, radius = 5, resolution = this.DEFAULT_RESOLUTION } = query;
    const cacheKey = `h3:nearby:${lat}:${lng}:${radius}:${resolution}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.log(`Cache HIT for nearby ${lat},${lng}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache MISS for nearby ${lat},${lng}, calculating...`);

    // Start from center cell
    const centerH3 = this.algorithm.encode(lat, lng, resolution);
    const visited = new Set<string>([centerH3]);
    const results: string[] = [centerH3];
    const queue: string[] = [centerH3];

    // BFS to find all cells within radius
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.algorithm.getNeighbors(current);

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);

        const neighborCenter = this.algorithm.getCenter(neighbor);
        const distance = this.algorithm.haversineDistance(
          lat,
          lng,
          neighborCenter.lat,
          neighborCenter.lng,
        );

        if (distance <= radius) {
          results.push(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Get pincodes and build response
    const cells = await Promise.all(
      results.map(async (h3Index) => {
        const center = this.algorithm.getCenter(h3Index);
        const distance = this.algorithm.haversineDistance(lat, lng, center.lat, center.lng);
        const pincodes = await this.getPincodesForH3(h3Index);

        return {
          h3Index,
          distance: parseFloat(distance.toFixed(2)),
          pincodes,
          center: { latitude: center.lat, longitude: center.lng },
        };
      }),
    );

    // Sort by distance and collect unique pincodes
    cells.sort((a, b) => a.distance - b.distance);
    const allPincodes = new Set<string>();
    cells.forEach((cell) => cell.pincodes.forEach((p) => allPincodes.add(p)));

    const response: H3NearbyResponse = {
      center: { latitude: lat, longitude: lng },
      radius,
      radiusUnit: 'km',
      resolution,
      cells,
      totalCells: cells.length,
      uniquePincodes: allPincodes.size,
    };

    // Cache for 1 hour
    await this.redisCache.set(cacheKey, JSON.stringify(response), 3600);

    return response;
  }

  /**
   * Helper: Get pincodes for an H3 cell from Redis
   */
  private async getPincodesForH3(h3Index: string): Promise<string[]> {
    const key = `h3:${h3Index}`;
    const pincodes = await this.redisPersistent.getClient().smembers(key);
    return pincodes.sort();
  }

  /**
   * Haversine distance helper (delegates to algorithm service)
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    return this.algorithm.haversineDistance(lat1, lng1, lat2, lng2);
  }
}
