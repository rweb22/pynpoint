import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { polygonToCells } from 'h3-js';
import { Pincode } from '../../database/entities/pincode.entity';
import { H3AlgorithmService } from '../../h3/services/h3-algorithm.service';
import { DigipinAlgorithmService } from '../../digipin/services/digipin-algorithm.service';
import { RedisPersistentService } from '../../redis/redis-persistent.service';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  BulkPincodeToH3Response,
  BulkH3ToPincodeResponse,
  SpatialIntersectionResponse,
  PolygonSearchResponse,
} from '../dto/conversion-response.dto';

/**
 * ConversionAdvancedService
 * 
 * Stack 3: Advanced/Bulk Operations
 * 
 * Implements:
 * - Bulk conversions with batching
 * - Spatial intersection validation
 * - Custom polygon searches
 */
@Injectable()
export class ConversionAdvancedService {
  private readonly logger = new Logger(ConversionAdvancedService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly h3Algorithm: H3AlgorithmService,
    private readonly digipinAlgorithm: DigipinAlgorithmService,
    private readonly redisPersistent: RedisPersistentService,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * 4.7: Bulk Pincode → H3
   * Convert up to 50 pincodes in one batch query
   */
  async bulkPincodeToH3(
    pincodes: string[],
    resolution: number = 9,
  ): Promise<BulkPincodeToH3Response> {
    this.logger.log(`Bulk converting ${pincodes.length} pincodes to H3 resolution ${resolution}`);

    // Fetch all boundaries in one query
    const boundaries = await this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.pincode',
        'ST_AsGeoJSON(p.boundary) as boundary_geojson',
        'ST_AsGeoJSON(p.centroid) as centroid_geojson',
      ])
      .where('p.pincode = ANY(:pincodes)', { pincodes })
      .andWhere('p.is_active = :active', { active: true })
      .getRawMany();

    // Process in parallel
    const results = await Promise.all(
      boundaries.map(async (row) => {
        try {
          const boundary = JSON.parse(row.boundary_geojson);
          const h3Indexes = polygonToCells(boundary.coordinates, resolution, true);

          return {
            pincode: row.p_pincode,
            result: {
              h3Indexes,
              totalHexagons: h3Indexes.length,
              success: true,
            },
          };
        } catch (error) {
          return {
            pincode: row.p_pincode,
            result: {
              h3Indexes: [],
              totalHexagons: 0,
              success: false,
              error: error.message,
            },
          };
        }
      }),
    );

    // Convert to object format
    const resultsMap = {};
    results.forEach((r) => {
      resultsMap[r.pincode] = r.result;
    });

    return {
      resolution,
      total: pincodes.length,
      results: resultsMap,
    };
  }

  /**
   * 4.8: Bulk H3 → Pincode
   * Convert up to 100 H3 cells with Redis pipeline
   */
  async bulkH3ToPincode(h3Indexes: string[]): Promise<BulkH3ToPincodeResponse> {
    this.logger.log(`Bulk converting ${h3Indexes.length} H3 indexes to pincodes`);

    // Batch Redis lookups using pipeline
    const pipeline = this.redisPersistent.getClient().pipeline();

    // For each H3, we need to encode it to res-9 first (for pincode index)
    const res9Indexes = h3Indexes.map((h3) => {
      const { lat, lng } = this.h3Algorithm.decode(h3);
      return this.h3Algorithm.encode(lat, lng, 9);
    });

    for (const res9H3 of res9Indexes) {
      pipeline.smembers(`h3:${res9H3}`);
    }

    const redisResults = await pipeline.exec();

    if (!redisResults) {
      throw new Error('Redis pipeline failed');
    }

    // Process results
    const results = await Promise.all(
      h3Indexes.map(async (h3Index, i) => {
        try {
          const pincodes = redisResults[i][1] as string[];

          if (pincodes.length === 0) {
            return {
              h3Index,
              result: {
                pincodes: [],
                primaryPincode: '',
                success: false,
                error: 'No pincodes found',
              },
            };
          }

          // Determine primary (use point check if multiple)
          let primaryPincode = pincodes[0];

          if (pincodes.length > 1) {
            const { lat, lng } = this.h3Algorithm.decode(h3Index);

            const result = await this.pincodeRepository
              .createQueryBuilder('p')
              .select('p.pincode')
              .where('p.pincode = ANY(:pincodes)', { pincodes })
              .andWhere('ST_Contains(p.boundary, ST_Point(:lng, :lat))', { lng, lat })
              .getOne();

            if (result) {
              primaryPincode = result.pincode;
            }
          }

          return {
            h3Index,
            result: {
              pincodes,
              primaryPincode,
              success: true,
            },
          };
        } catch (error) {
          return {
            h3Index,
            result: {
              pincodes: [],
              primaryPincode: '',
              success: false,
              error: error.message,
            },
          };
        }
      }),
    );

    // Convert to object format
    const resultsMap = {};
    results.forEach((r) => {
      resultsMap[r.h3Index] = r.result;
    });

    return {
      total: h3Indexes.length,
      results: resultsMap,
    };
  }

  /**
   * 4.9: Spatial Intersection
   * Validate if a coordinate is inside a pincode boundary
   */
  async spatialIntersection(
    pincode: string,
    lat: number,
    lng: number,
  ): Promise<SpatialIntersectionResponse> {
    this.logger.log(`Checking if (${lat}, ${lng}) is inside pincode ${pincode}`);

    // Check containment and calculate distance
    const result = await this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.pincode',
        'ST_Contains(p.boundary, ST_Point(:lng, :lat)) as is_inside',
        'ST_Distance(p.centroid::geography, ST_Point(:lng, :lat)::geography) / 1000.0 as distance_km',
      ])
      .where('p.pincode = :pincode', { pincode })
      .andWhere('p.is_active = :active', { active: true })
      .setParameters({ lng, lat })
      .getRawOne();

    if (!result) {
      throw new NotFoundException(`Pincode ${pincode} not found`);
    }

    // Get H3 and DIGIPIN representations
    const h3Index = this.h3Algorithm.encode(lat, lng, 9);
    const digipinCode = this.digipinAlgorithm.encode(lat, lng, 6);

    return {
      pincode,
      coordinates: { latitude: lat, longitude: lng },
      isInside: result.is_inside,
      h3Index,
      digipinCode,
      distance: {
        toPincodeCenter: parseFloat(result.distance_km.toFixed(2)),
        unit: 'km',
      },
    };
  }

  /**
   * 4.10: Polygon Search
   * Find all pincodes within a custom polygon
   */
  async polygonSearch(
    polygon: any,
    includeH3: boolean = false,
    includeDigipin: boolean = false,
    h3Resolution: number = 9,
    digipinLevel: number = 6,
  ): Promise<PolygonSearchResponse> {
    this.logger.log(`Searching for pincodes within custom polygon`);

    // Find intersecting pincodes
    const pincodes = await this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.pincode',
        'p.office_name',
        'p.district',
        'p.state',
        'ST_Area(ST_Intersection(p.boundary::geography, ST_GeomFromGeoJSON(:polygon)::geography)) / 1000000.0 as intersection_area',
        'ST_Area(p.boundary::geography) / 1000000.0 as pincode_area',
      ])
      .where('ST_Intersects(p.boundary, ST_GeomFromGeoJSON(:polygon))', {
        polygon: JSON.stringify(polygon),
      })
      .andWhere('p.is_active = :active', { active: true })
      .getRawMany();

    // Calculate search area
    const areaResult = await this.pincodeRepository.query(
      'SELECT ST_Area(ST_GeomFromGeoJSON($1)::geography) / 1000000.0 as area_km2',
      [JSON.stringify(polygon)],
    );

    // Build response
    const results = pincodes.map((p) => ({
      pincode: p.p_pincode,
      officeName: p.p_office_name || '',
      district: p.p_district || '',
      state: p.p_state || '',
      overlapPercentage: parseFloat(
        ((p.intersection_area / p.pincode_area) * 100).toFixed(1),
      ),
    }));

    // Add H3 and DIGIPIN if requested
    let totalH3Cells = 0;
    let totalDigipinCells = 0;

    if (includeH3) {
      const h3Indexes = polygonToCells(polygon.coordinates, h3Resolution, true);
      totalH3Cells = h3Indexes.length;
      // Map H3 to pincodes could be added here
    }

    if (includeDigipin) {
      // Sample with H3 centers
      const h3Indexes = polygonToCells(polygon.coordinates, 9, true);
      const digipinSet = new Set<string>();

      for (const h3 of h3Indexes) {
        const { lat, lng } = this.h3Algorithm.decode(h3);
        digipinSet.add(this.digipinAlgorithm.encode(lat, lng, digipinLevel));
      }

      totalDigipinCells = digipinSet.size;
    }

    return {
      pincodes: results,
      totalPincodes: results.length,
      totalH3Cells: includeH3 ? totalH3Cells : undefined,
      totalDigipinCells: includeDigipin ? totalDigipinCells : undefined,
      searchArea: {
        value: parseFloat(areaResult[0].area_km2.toFixed(2)),
        unit: 'km²',
      },
    };
  }
}
