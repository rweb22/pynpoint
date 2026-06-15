import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';
import { PostOffice } from '../../database/entities/postoffice.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { PincodeDetailResponseDto, PincodeListResponseDto, PostOfficeDto } from '../dto/pincode-response.dto';
import { PincodeQueryDto, BulkPincodeLookupDto } from '../dto/pincode-query.dto';

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
    // Check cache first
    const cacheKey = `pincode:${pincode}:${includePostOffices}:${includeBoundary}`;
    const cached = await this.redisCache.get(cacheKey);
    
    if (cached) {
      this.logger.debug(`Cache HIT for pincode ${pincode}`);
      return JSON.parse(cached);
    }

    this.logger.debug(`Cache MISS for pincode ${pincode}, querying DB`);

    // Query database
    const pincodeEntity = await this.pincodeRepository.findOne({
      where: { pincode, is_active: true },
    });

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
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL_SINGLE);

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
}
