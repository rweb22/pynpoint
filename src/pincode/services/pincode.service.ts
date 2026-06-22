import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';
import { PostOffice } from '../../database/entities/postoffice.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  PincodeDetailResponseDto,
  PincodeListResponseDto,
  PostOfficeDto,
  PincodeValidationResponseDto,
  NearbyPincodesResponseDto,
  NearbyPincodeResult,
  ReverseGeocodeResponseDto,
} from '../dto/pincode-response.dto';
import { PincodeQueryDto, BulkPincodeLookupDto, NearbyPincodeQueryDto, ReverseGeocodeDto } from '../dto/pincode-query.dto';

/**
 * PincodeService
 * 
 * Handles all pincode-related business logic for Track 1.
 * 
 * Caching Strategy (RedisCacheService):
 * - Single pincode lookup: 1 hour TTL
 * - Query results: 10 minutes TTL (more dynamic)
 * - Bulk lookups: Reuse individual pincode cache
 * 
 * Performance:
 * - Single lookup: ~1-10ms (cached) | ~10-50ms (DB)
 * - Query: ~20-50ms
 * - Bulk: ~5-50ms (100 pincodes)
 */
@Injectable()
export class PincodeService {
  private readonly logger = new Logger(PincodeService.name);
  private readonly CACHE_TTL_SINGLE = 3600; // 1 hour
  private readonly CACHE_TTL_QUERY = 600; // 10 minutes

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    @InjectRepository(PostOffice)
    private readonly postOfficeRepository: Repository<PostOffice>,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Get single pincode details
   * GET /pincodes/:pincode
   */
  async findByPincode(
    pincode: string,
    includePostOffices = true,
    includeBoundary = false,
  ): Promise<PincodeDetailResponseDto> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = `pincode:${pincode}:${includePostOffices}:${includeBoundary}`;
    this.logger.log(`🔍 Checking cache for key: ${cacheKey}`);

    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      const cacheTime = Date.now() - startTime;
      this.logger.log(`✅ Cache HIT for pincode ${pincode} (${cacheTime}ms)`);
      return JSON.parse(cached);
    }

    const missTime = Date.now() - startTime;
    this.logger.log(`❌ Cache MISS for pincode ${pincode} (${missTime}ms) - querying DB...`);

    // Query database
    const dbStartTime = Date.now();
    const pincodeEntity = await this.pincodeRepository.findOne({
      where: { pincode, is_active: true },
    });
    const dbTime = Date.now() - dbStartTime;
    this.logger.log(`📊 DB query completed in ${dbTime}ms`);

    if (!pincodeEntity) {
      throw new NotFoundException(`Pincode ${pincode} not found`);
    }

    // Build response
    const response = await this.buildPincodeResponse(
      pincodeEntity,
      includePostOffices,
      includeBoundary,
    );

    // Cache the result
    const cacheSetStart = Date.now();
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL_SINGLE);
    const cacheSetTime = Date.now() - cacheSetStart;
    this.logger.log(`💾 Cached result for ${pincode} (TTL: ${this.CACHE_TTL_SINGLE}s) in ${cacheSetTime}ms`);

    const totalTime = Date.now() - startTime;
    this.logger.log(`⏱️  Total request time: ${totalTime}ms`);

    return response;
  }

  /**
   * Search/filter pincodes
   * GET /pincodes?state=...&district=...
   */
  async findPincodes(query: PincodeQueryDto): Promise<PincodeListResponseDto> {
    const { state, district, city, search, limit = 25, page = 1, includePostOffices, includeBoundary } = query;

    // Build query
    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('pincode')
      .where('pincode.is_active = :isActive', { isActive: true });

    if (state) {
      queryBuilder.andWhere('LOWER(pincode.state) = LOWER(:state)', { state });
    }

    if (district) {
      queryBuilder.andWhere('LOWER(pincode.district) = LOWER(:district)', { district });
    }

    if (city) {
      queryBuilder.andWhere('LOWER(pincode.city) = LOWER(:city)', { city });
    }

    if (search) {
      queryBuilder.andWhere(
        '(pincode.pincode LIKE :search OR LOWER(pincode.office_name) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute
    const [results, total] = await queryBuilder.getManyAndCount();

    // Build responses
    const pincodes = await Promise.all(
      results.map(p => this.buildPincodeResponse(p, includePostOffices || false, includeBoundary || false)),
    );

    return {
      total,
      page,
      limit,
      pincodes,
    };
  }

  /**
   * Bulk pincode lookup
   * POST /pincodes/bulk/lookup
   */
  async bulkLookup(dto: BulkPincodeLookupDto) {
    const { pincodes, includePostOffices, includeBoundary } = dto;

    // Validate max 100 pincodes
    if (pincodes.length > 100) {
      throw new NotFoundException('Maximum 100 pincodes allowed per request');
    }

    const results = await Promise.all(
      pincodes.map(async (pincode) => {
        try {
          const data = await this.findByPincode(pincode, includePostOffices, includeBoundary);
          return { pincode, found: true, data };
        } catch (error) {
          return { pincode, found: false, error: error.message };
        }
      }),
    );

    return {
      total: results.length,
      results,
    };
  }

  /**
   * Helper: Build pincode response DTO from entity
   */
  private async buildPincodeResponse(
    pincodeEntity: Pincode,
    includePostOffices: boolean,
    includeBoundary: boolean,
  ): Promise<PincodeDetailResponseDto> {
    const response: PincodeDetailResponseDto = {
      pincode: pincodeEntity.pincode,
      officeName: pincodeEntity.office_name,
      state: pincodeEntity.state,
      district: pincodeEntity.district,
      city: pincodeEntity.city,
      isActive: pincodeEntity.is_active,
    };

    // Add centroid coordinates if available
    if (pincodeEntity.centroid) {
      const coords = this.parseCoordinates(pincodeEntity.centroid);
      if (coords) {
        response.coordinates = coords;
      }
    }

    // Add boundary if requested
    if (includeBoundary && pincodeEntity.boundary) {
      response.boundary = this.parseBoundary(pincodeEntity.boundary);
    }

    // Add post offices if requested
    if (includePostOffices) {
      const postOffices = await this.postOfficeRepository.find({
        where: { pincode: pincodeEntity.pincode, is_active: true },
      });

      response.postOffices = postOffices.map(po => this.buildPostOfficeDto(po));
      response.postOfficeCount = postOffices.length;
    }

    return response;
  }

  /**
   * Helper: Build post office DTO
   */
  private buildPostOfficeDto(po: PostOffice): PostOfficeDto {
    const dto: PostOfficeDto = {
      officeName: po.officename,
      area: po.area,
      officeType: po.officetype as 'HO' | 'SO' | 'BO',
      deliveryStatus: po.delivery === 'delivery' ? 'Delivery' : 'Non-Delivery',
      division: po.division,
      region: po.region,
      circle: po.circle,
    };

    if (po.latitude && po.longitude) {
      dto.coordinates = {
        latitude: Number(po.latitude),
        longitude: Number(po.longitude),
      };
    }

    return dto;
  }

  /**
   * Helper: Parse PostGIS Point to coordinates
   */
  private parseCoordinates(centroid: string): { latitude: number; longitude: number } | null {
    try {
      // PostGIS returns GeoJSON or WKT format
      if (centroid.startsWith('POINT')) {
        // WKT format: POINT(lng lat)
        const match = centroid.match(/POINT\(([^ ]+) ([^ ]+)\)/);
        if (match) {
          return {
            longitude: parseFloat(match[1]),
            latitude: parseFloat(match[2]),
          };
        }
      } else {
        // GeoJSON format
        const geojson = JSON.parse(centroid);
        if (geojson.type === 'Point') {
          return {
            longitude: geojson.coordinates[0],
            latitude: geojson.coordinates[1],
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse centroid: ${error.message}`);
    }
    return null;
  }

  /**
   * Helper: Parse PostGIS boundary to GeoJSON
   */
  private parseBoundary(boundary: string): any {
    try {
      // If already GeoJSON, return as-is
      if (boundary.startsWith('{')) {
        return JSON.parse(boundary);
      }
      // TODO: Convert WKT to GeoJSON if needed
      return boundary;
    } catch (error) {
      this.logger.warn(`Failed to parse boundary: ${error.message}`);
      return null;
    }
  }

  /**
   * Validate pincode format, existence, and geographic bounds
   * GET /pincodes/:pincode/validate
   */
  async validatePincode(pincode: string): Promise<PincodeValidationResponseDto> {
    const startTime = Date.now();
    const errors: string[] = [];

    // India's official bounding box (same as DIGIPIN)
    const INDIA_BBOX = {
      minLat: 2.5,   // 2.5°N
      maxLat: 38.5,  // 38.5°N
      minLng: 63.5,  // 63.5°E
      maxLng: 99.5,  // 99.5°E
    };

    // Check cache first
    const cacheKey = `pincode:validate:${pincode}`;
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      this.logger.log(`✅ Validation cache HIT for pincode ${pincode}`);
      return JSON.parse(cached);
    }

    this.logger.log(`🔍 Validating pincode: ${pincode}`);

    // 1. Format validation: Exactly 6 digits, all numeric
    const formatValid = /^\d{6}$/.test(pincode);
    if (!formatValid) {
      errors.push('Invalid format: Pincode must be exactly 6 digits (0-9)');
    }

    // 2. Database existence check
    let pincodeEntity: Pincode | null = null;
    let exists = false;

    if (formatValid) {
      pincodeEntity = await this.pincodeRepository.findOne({
        where: { pincode, is_active: true },
      });
      exists = !!pincodeEntity;

      if (!exists) {
        errors.push(`Pincode ${pincode} does not exist in database`);
      }
    }

    // 3. Build response
    const response: PincodeValidationResponseDto = {
      valid: formatValid && exists,
      exists,
      pincode,
    };

    // Add errors if any
    if (errors.length > 0) {
      response.errors = errors;
    }

    // Add details if pincode exists
    if (pincodeEntity) {
      response.details = {
        state: pincodeEntity.state || 'Unknown',
        district: pincodeEntity.district || 'Unknown',
        officeName: pincodeEntity.office_name || undefined,
      };

      // Try to extract coordinates from centroid if available
      if (pincodeEntity.centroid) {
        try {
          // Parse GeoJSON Point from centroid
          // Centroid is stored as geography(Point, 4326)
          // It may be in WKT format: "POINT(lng lat)" or GeoJSON
          const centroidStr = pincodeEntity.centroid.toString();

          let lat: number | null = null;
          let lng: number | null = null;

          // Try GeoJSON format first
          if (centroidStr.startsWith('{')) {
            const geojson = JSON.parse(centroidStr);
            if (geojson.type === 'Point' && geojson.coordinates) {
              lng = geojson.coordinates[0];
              lat = geojson.coordinates[1];
            }
          }
          // Try WKT format: "POINT(lng lat)"
          else if (centroidStr.includes('POINT')) {
            const match = centroidStr.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }

          if (lat !== null && lng !== null) {
            const withinBounds =
              lat >= INDIA_BBOX.minLat && lat <= INDIA_BBOX.maxLat &&
              lng >= INDIA_BBOX.minLng && lng <= INDIA_BBOX.maxLng;

            response.coordinates = {
              latitude: lat,
              longitude: lng,
              withinIndiaBounds: withinBounds,
            };

            if (!withinBounds) {
              this.logger.warn(
                `⚠️  Pincode ${pincode} has coordinates (${lat}, ${lng}) outside India bounds!`
              );
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to parse centroid for pincode ${pincode}: ${error.message}`);
        }
      }
    }

    // Cache the result (24 hours TTL for validation)
    await this.redisCache.set(cacheKey, JSON.stringify(response), 86400);

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `✅ Validation complete for ${pincode}: valid=${response.valid}, exists=${exists} (${totalTime}ms)`
    );

    return response;
  }

  /**
   * Find nearby pincodes within radius
   * GET /pincodes/:pincode/nearby
   */
  async findNearbyPincodes(
    sourcePincode: string,
    query: NearbyPincodeQueryDto,
  ): Promise<NearbyPincodesResponseDto> {
    const startTime = Date.now();
    const { radius = 50, unit = 'km', limit = 50, includeDistance = true } = query;

    this.logger.log(
      `🔍 Finding pincodes near ${sourcePincode} within ${radius}${unit} (limit: ${limit})`
    );

    // Get the source pincode first
    const source = await this.pincodeRepository.findOne({
      where: { pincode: sourcePincode, is_active: true },
    });

    if (!source) {
      throw new NotFoundException(`Source pincode ${sourcePincode} not found`);
    }

    if (!source.centroid) {
      throw new BadRequestException(
        `Source pincode ${sourcePincode} does not have coordinate data`
      );
    }

    // Convert radius to meters for PostGIS
    const radiusMeters = unit === 'km' ? radius * 1000 : radius;

    // PostGIS spatial query using ST_DWithin
    // ST_DWithin returns true if geometries are within specified distance
    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.id',
        'p.pincode',
        'p.office_name',
        'p.state',
        'p.district',
        'p.city',
        'p.centroid',
      ])
      .where('p.is_active = :active', { active: true })
      .andWhere('p.pincode != :sourcePincode', { sourcePincode })
      .andWhere(
        `ST_DWithin(p.centroid::geography, :sourceCentroid::geography, :radius)`,
        {
          sourceCentroid: source.centroid,
          radius: radiusMeters,
        }
      );

    // Add distance calculation if requested
    if (includeDistance) {
      queryBuilder.addSelect(
        `ST_Distance(p.centroid::geography, :sourceCentroid::geography)`,
        'distance'
      );
      queryBuilder.setParameter('sourceCentroid', source.centroid);
      queryBuilder.orderBy('distance', 'ASC');
    }

    queryBuilder.limit(limit);

    const rawResults = await queryBuilder.getRawAndEntities();
    const dbTime = Date.now() - startTime;
    this.logger.log(`📊 DB query completed in ${dbTime}ms, found ${rawResults.entities.length} results`);

    // Parse source coordinates
    let sourceCoordinates: { latitude: number; longitude: number } | undefined;
    try {
      const centroidStr = source.centroid.toString();
      if (centroidStr.startsWith('{')) {
        const geojson = JSON.parse(centroidStr);
        if (geojson.coordinates) {
          sourceCoordinates = {
            latitude: geojson.coordinates[1],
            longitude: geojson.coordinates[0],
          };
        }
      } else if (centroidStr.includes('POINT')) {
        const match = centroidStr.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
        if (match) {
          sourceCoordinates = {
            latitude: parseFloat(match[2]),
            longitude: parseFloat(match[1]),
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse source centroid: ${error.message}`);
    }

    // Build results
    const results: NearbyPincodeResult[] = rawResults.entities.map((entity, index) => {
      const result: NearbyPincodeResult = {
        pincode: entity.pincode,
        officeName: entity.office_name || undefined,
        state: entity.state || undefined,
        district: entity.district || undefined,
        city: entity.city || undefined,
      };

      // Parse coordinates from centroid
      if (entity.centroid) {
        try {
          const centroidStr = entity.centroid.toString();
          if (centroidStr.startsWith('{')) {
            const geojson = JSON.parse(centroidStr);
            if (geojson.coordinates) {
              result.coordinates = {
                latitude: geojson.coordinates[1],
                longitude: geojson.coordinates[0],
              };
            }
          } else if (centroidStr.includes('POINT')) {
            const match = centroidStr.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
            if (match) {
              result.coordinates = {
                latitude: parseFloat(match[2]),
                longitude: parseFloat(match[1]),
              };
            }
          }
        } catch (error) {
          // Ignore parse errors for individual results
        }
      }

      // Add distance if available
      if (includeDistance && rawResults.raw[index]?.distance !== undefined) {
        const distanceMeters = parseFloat(rawResults.raw[index].distance);
        result.distance = {
          value: unit === 'km' ? distanceMeters / 1000 : distanceMeters,
          unit,
        };
      }

      return result;
    });

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `✅ Nearby search complete: ${results.length} pincodes found (${totalTime}ms)`
    );

    return {
      source: {
        pincode: sourcePincode,
        coordinates: sourceCoordinates,
      },
      searchParams: {
        radius,
        unit,
        limit,
      },
      results,
      total: results.length,
    };
  }

  /**
   * Reverse geocode: Convert coordinates to nearest pincode
   * POST /pincodes/reverse-geocode
   */
  async reverseGeocode(dto: ReverseGeocodeDto): Promise<ReverseGeocodeResponseDto> {
    const startTime = Date.now();
    const { latitude, longitude, maxDistance = 5, limit = 1 } = dto;

    // India's bounding box
    const INDIA_BBOX = {
      minLat: 2.5,
      maxLat: 38.5,
      minLng: 63.5,
      maxLng: 99.5,
    };

    // Check if coordinates are within India
    const withinIndiaBounds =
      latitude >= INDIA_BBOX.minLat &&
      latitude <= INDIA_BBOX.maxLat &&
      longitude >= INDIA_BBOX.minLng &&
      longitude <= INDIA_BBOX.maxLng;

    this.logger.log(
      `🔍 Reverse geocoding (${latitude}, ${longitude}), withinIndia: ${withinIndiaBounds}`
    );

    if (!withinIndiaBounds) {
      this.logger.warn(
        `⚠️  Coordinates (${latitude}, ${longitude}) are outside India bounds`
      );
    }

    // Create PostGIS point from input coordinates
    const point = `SRID=4326;POINT(${longitude} ${latitude})`;
    const maxDistanceMeters = maxDistance * 1000;

    // Query for nearest pincodes using ST_DWithin and ST_Distance
    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.id',
        'p.pincode',
        'p.office_name',
        'p.state',
        'p.district',
        'p.city',
        'p.centroid',
        'p.boundary',
      ])
      .where('p.is_active = :active', { active: true })
      .andWhere(
        `ST_DWithin(p.centroid::geography, ST_GeographyFromText(:point), :maxDistance)`,
        {
          point,
          maxDistance: maxDistanceMeters,
        }
      )
      .addSelect(
        `ST_Distance(p.centroid::geography, ST_GeographyFromText(:point))`,
        'distance'
      )
      .setParameter('point', point)
      .orderBy('distance', 'ASC')
      .limit(limit);

    const rawResults = await queryBuilder.getRawAndEntities();
    const dbTime = Date.now() - startTime;
    this.logger.log(
      `📊 DB query completed in ${dbTime}ms, found ${rawResults.entities.length} results`
    );

    // Build results
    const results = rawResults.entities.map((entity, index) => {
      const result: any = {
        pincode: entity.pincode,
        officeName: entity.office_name || undefined,
        state: entity.state || undefined,
        district: entity.district || undefined,
        city: entity.city || undefined,
      };

      // Parse coordinates
      if (entity.centroid) {
        try {
          const centroidStr = entity.centroid.toString();
          if (centroidStr.startsWith('{')) {
            const geojson = JSON.parse(centroidStr);
            if (geojson.coordinates) {
              result.coordinates = {
                latitude: geojson.coordinates[1],
                longitude: geojson.coordinates[0],
              };
            }
          } else if (centroidStr.includes('POINT')) {
            const match = centroidStr.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
            if (match) {
              result.coordinates = {
                latitude: parseFloat(match[2]),
                longitude: parseFloat(match[1]),
              };
            }
          }
        } catch (error) {
          // Ignore parse errors
        }
      }

      // Add distance
      const distanceMeters = parseFloat(rawResults.raw[index].distance);
      result.distance = {
        value: distanceMeters / 1000, // Convert to km
        unit: 'km' as const,
      };

      // Check if point is within boundary (if boundary exists)
      result.containsPoint = false;
      // Note: We would need a separate query to check ST_Contains for this
      // For now, we'll mark the closest one as potentially containing the point
      if (index === 0 && distanceMeters < 100) {
        // Within 100 meters
        result.containsPoint = true;
      }

      return result;
    });

    const totalTime = Date.now() - startTime;
    this.logger.log(
      `✅ Reverse geocoding complete: ${results.length} pincodes found (${totalTime}ms)`
    );

    return {
      coordinates: {
        latitude,
        longitude,
        withinIndiaBounds,
      },
      results,
      total: results.length,
      searchParams: {
        maxDistance,
        limit,
      },
    };
  }
}
