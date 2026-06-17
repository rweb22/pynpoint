import { Injectable, Logger } from '@nestjs/common';
import { H3AlgorithmService } from './h3-algorithm.service';
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
  H3ParentResponse,
  H3ChildrenResponse,
  H3AncestorsResponse,
} from '../dto/h3-response.dto';

/**
 * H3Service
 *
 * Track 3: H3 Solo Operations (PURE - No Cross-System References)
 *
 * Pure H3 algorithmic operations without database or pincode dependencies.
 * All operations use h3-js library for hexagonal spatial indexing.
 *
 * Data Flow:
 * 1. H3AlgorithmService: Pure H3 math (encode/decode/neighbors/hierarchy)
 * 2. RedisCacheService: Cache expensive operations (nearby search, cell details)
 *
 * NO database access, NO pincode lookups - those belong in Track 4 (Conversion).
 */
@Injectable()
export class H3Service {
  private readonly logger = new Logger(H3Service.name);
  private readonly DEFAULT_RESOLUTION = 9; // Standard resolution for H3 operations

  constructor(
    private readonly algorithm: H3AlgorithmService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * GET /h3/:h3Index
   * Get detailed information about an H3 cell (PURE H3 - no pincode references)
   */
  async getCellDetails(h3Index: string): Promise<H3CellResponse> {
    const cacheKey = `h3:cell:${h3Index}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.log(`Cache HIT for H3 cell ${h3Index}`);
      return JSON.parse(cached);
    }

    this.logger.log(`Cache MISS for H3 cell ${h3Index}, calculating...`);

    // Get H3 cell info (pure algorithm)
    const { lat, lng, resolution } = this.algorithm.decode(h3Index);
    const boundary = this.algorithm.getBoundary(h3Index);
    const area = this.algorithm.getArea(h3Index);

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
    };

    // Cache for 1 hour
    await this.redisCache.set(cacheKey, JSON.stringify(response), 3600);

    return response;
  }

  /**
   * POST /h3/encode
   * Convert coordinates to H3 indices (PURE H3 - no pincode references)
   */
  async encode(dto: EncodeH3Dto): Promise<EncodeH3Response> {
    const resolution = dto.resolution || this.DEFAULT_RESOLUTION;
    const results: Array<{
      input: { latitude: number; longitude: number };
      h3Index: string;
    }> = [];

    for (const coord of dto.coordinates) {
      const h3Index = this.algorithm.encode(coord.latitude, coord.longitude, resolution);

      results.push({
        input: { latitude: coord.latitude, longitude: coord.longitude },
        h3Index,
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
   * Find H3 cells within radius using BFS (PURE H3 - no pincode references)
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

    // Build response (pure H3 - no pincode lookups)
    const cells = results.map((h3Index) => {
      const center = this.algorithm.getCenter(h3Index);
      const distance = this.algorithm.haversineDistance(lat, lng, center.lat, center.lng);

      return {
        h3Index,
        distance: parseFloat(distance.toFixed(2)),
        center: { latitude: center.lat, longitude: center.lng },
      };
    });

    // Sort by distance
    cells.sort((a, b) => a.distance - b.distance);

    const response: H3NearbyResponse = {
      center: { latitude: lat, longitude: lng },
      radius,
      radiusUnit: 'km',
      resolution,
      cells,
      totalCells: cells.length,
    };

    // Cache for 1 hour
    await this.redisCache.set(cacheKey, JSON.stringify(response), 3600);

    return response;
  }

  /**
   * GET /h3/:h3Index/parent
   * Get parent H3 cell at coarser resolution
   */
  async getParent(h3Index: string, parentResolution?: number): Promise<H3ParentResponse> {
    const { resolution: childResolution } = this.algorithm.decode(h3Index);
    const parent = this.algorithm.getParent(h3Index, parentResolution);
    const { lat, lng, resolution: parentRes } = this.algorithm.decode(parent);
    const boundary = this.algorithm.getBoundary(parent);
    const area = this.algorithm.getArea(parent);

    return {
      child: h3Index,
      childResolution,
      parent,
      parentResolution: parentRes,
      center: { latitude: lat, longitude: lng },
      boundary: {
        type: 'Polygon',
        coordinates: boundary,
      },
      area: {
        value: parseFloat(area.toFixed(3)),
        unit: 'km²',
      },
    };
  }

  /**
   * GET /h3/:h3Index/children
   * Get children H3 cells at finer resolution
   */
  async getChildren(h3Index: string, childResolution?: number): Promise<H3ChildrenResponse> {
    const { resolution: parentResolution } = this.algorithm.decode(h3Index);
    const children = this.algorithm.getChildren(h3Index, childResolution);
    const targetResolution = childResolution !== undefined ? childResolution : parentResolution + 1;

    return {
      parent: h3Index,
      parentResolution,
      childResolution: targetResolution,
      children,
      totalCount: children.length,
      note: `H3 cells subdivide into 7 children at the next finer resolution (except at pentagons)`,
    };
  }

  /**
   * GET /h3/:h3Index/ancestors
   * Get all ancestor H3 cells from child to resolution 0
   */
  async getAncestors(h3Index: string): Promise<H3AncestorsResponse> {
    const { resolution } = this.algorithm.decode(h3Index);
    const ancestorIndices = this.algorithm.getAncestors(h3Index);

    const ancestors = ancestorIndices.map((ancestorIndex) => {
      const { lat, lng, resolution: res } = this.algorithm.decode(ancestorIndex);
      const area = this.algorithm.getArea(ancestorIndex);

      return {
        h3Index: ancestorIndex,
        resolution: res,
        center: { latitude: lat, longitude: lng },
        area: {
          value: parseFloat(area.toFixed(3)),
          unit: 'km²',
        },
      };
    });

    return {
      h3Index,
      resolution,
      ancestors,
      totalCount: ancestors.length,
    };
  }
}
