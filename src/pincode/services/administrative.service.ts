import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  StatesListResponseDto,
  StateDetailResponseDto,
  DistrictsListResponseDto,
  CitiesListResponseDto,
  StateDto,
  DistrictDto,
  CityDto,
} from '../dto/pincode-response.dto';
import { DistrictQueryDto, CityQueryDto } from '../dto/pincode-query.dto';

/**
 * AdministrativeService
 * 
 * Handles administrative boundary queries (states, districts).
 * 
 * Caching Strategy (RedisCacheService):
 * - States list: 24 hours TTL (very static)
 * - State details: 24 hours TTL
 * - Districts list: 24 hours TTL
 * 
 * Performance: ~1-50ms (mostly cached)
 */
@Injectable()
export class AdministrativeService {
  private readonly logger = new Logger(AdministrativeService.name);
  private readonly CACHE_TTL = 86400; // 24 hours

  // India state code mapping (ISO 3166-2:IN)
  private readonly STATE_CODES: Record<string, string> = {
    'andaman and nicobar': 'AN',
    'andhra pradesh': 'AP',
    'arunachal pradesh': 'AR',
    'assam': 'AS',
    'bihar': 'BR',
    'chandigarh': 'CH',
    'chhattisgarh': 'CG',
    'dadra and nagar haveli': 'DN',
    'daman and diu': 'DD',
    'delhi': 'DL',
    'goa': 'GA',
    'gujarat': 'GJ',
    'haryana': 'HR',
    'himachal pradesh': 'HP',
    'jammu and kashmir': 'JK',
    'jharkhand': 'JH',
    'karnataka': 'KA',
    'kerala': 'KL',
    'ladakh': 'LA',
    'lakshadweep': 'LD',
    'madhya pradesh': 'MP',
    'maharashtra': 'MH',
    'manipur': 'MN',
    'meghalaya': 'ML',
    'mizoram': 'MZ',
    'nagaland': 'NL',
    'odisha': 'OR',
    'puducherry': 'PY',
    'punjab': 'PB',
    'rajasthan': 'RJ',
    'sikkim': 'SK',
    'tamil nadu': 'TN',
    'telangana': 'TG',
    'tripura': 'TR',
    'uttar pradesh': 'UP',
    'uttarakhand': 'UK',
    'west bengal': 'WB',
  };

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Get all states with metadata
   * GET /administrative/states
   */
  async getStates(): Promise<StatesListResponseDto> {
    const cacheKey = 'admin:states';
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.debug('Cache HIT for states list');
      return JSON.parse(cached);
    }

    this.logger.debug('Cache MISS for states list, querying DB');

    // Query states with counts
    const results = await this.pincodeRepository
      .createQueryBuilder('pincode')
      .select('pincode.state', 'name')
      .addSelect('COUNT(DISTINCT pincode.pincode)', 'pincodeCount')
      .addSelect('COUNT(DISTINCT pincode.district)', 'districtCount')
      .where('pincode.is_active = :isActive', { isActive: true })
      .andWhere('pincode.state IS NOT NULL')
      .groupBy('pincode.state')
      .orderBy('pincode.state', 'ASC')
      .getRawMany();

    const states: StateDto[] = results.map(r => ({
      name: r.name,
      code: this.getStateCode(r.name),
      pincodeCount: parseInt(r.pincodeCount, 10),
      districtCount: parseInt(r.districtCount, 10),
    }));

    const response: StatesListResponseDto = {
      total: states.length,
      states,
    };

    // Cache for 24 hours
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    return response;
  }

  /**
   * Get state details by code
   * GET /administrative/states/:code
   */
  async getStateDetails(stateCode: string): Promise<StateDetailResponseDto> {
    const cacheKey = `admin:state:${stateCode.toUpperCase()}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache HIT for state ${stateCode}`);
      return JSON.parse(cached);
    }

    this.logger.debug(`Cache MISS for state ${stateCode}, querying DB`);

    // Find state name by code
    const stateName = this.getStateNameByCode(stateCode);
    if (!stateName) {
      throw new NotFoundException(`State code ${stateCode} not found`);
    }

    // Query state details
    const results = await this.pincodeRepository
      .createQueryBuilder('pincode')
      .select('pincode.district', 'district')
      .addSelect('COUNT(DISTINCT pincode.pincode)', 'pincodeCount')
      .where('LOWER(pincode.state) = LOWER(:state)', { state: stateName })
      .andWhere('pincode.is_active = :isActive', { isActive: true })
      .andWhere('pincode.district IS NOT NULL')
      .groupBy('pincode.district')
      .orderBy('pincode.district', 'ASC')
      .getRawMany();

    if (results.length === 0) {
      throw new NotFoundException(`State ${stateName} has no active pincodes`);
    }

    const districts = results.map(r => r.district);
    const totalPincodes = results.reduce((sum, r) => sum + parseInt(r.pincodeCount, 10), 0);

    const response: StateDetailResponseDto = {
      name: stateName,
      code: stateCode.toUpperCase(),
      pincodeCount: totalPincodes,
      districtCount: districts.length,
      districts,
    };

    // Cache for 24 hours
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    return response;
  }

  /**
   * Get districts (optionally filtered by state)
   * GET /administrative/districts?state=...
   */
  async getDistricts(query: DistrictQueryDto): Promise<DistrictsListResponseDto> {
    const { state, limit = 100, page = 1 } = query;
    const cacheKey = `admin:districts:${state || 'all'}`;
    const cached = await this.redisCache.get(cacheKey);

    if (cached) {
      this.logger.debug(`Cache HIT for districts (state=${state || 'all'})`);
      return JSON.parse(cached);
    }

    this.logger.debug(`Cache MISS for districts, querying DB`);

    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('pincode')
      .select('pincode.district', 'name')
      .addSelect('pincode.state', 'state')
      .addSelect('COUNT(DISTINCT pincode.pincode)', 'pincodeCount')
      .where('pincode.is_active = :isActive', { isActive: true })
      .andWhere('pincode.district IS NOT NULL')
      .andWhere('LOWER(pincode.state) != :unknown', { unknown: 'unknown' })
      .groupBy('pincode.district, pincode.state')
      .orderBy('pincode.state', 'ASC')
      .addOrderBy('pincode.district', 'ASC');

    if (state) {
      queryBuilder.andWhere('LOWER(pincode.state) = LOWER(:state)', { state });
    }

    const results = await queryBuilder.getRawMany();

    const districts: DistrictDto[] = results.map(r => ({
      name: r.name,
      state: r.state,
      stateCode: this.getStateCode(r.state),
      pincodeCount: parseInt(r.pincodeCount, 10),
    }));

    // Apply pagination
    const total = districts.length;
    const skip = (page - 1) * limit;
    const paginated = districts.slice(skip, skip + limit);

    const response: DistrictsListResponseDto = {
      total,
      districts: paginated,
    };

    // Cache for 24 hours
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    return response;
  }

  /**
   * Helper: Get state code from state name
   */
  private getStateCode(stateName: string): string {
    const normalized = stateName?.toLowerCase().trim();
    return this.STATE_CODES[normalized] || 'XX';
  }

  /**
   * Get all cities (optionally filtered by state and/or district)
   * GET /administrative/cities?state=...&district=...
   */
  async getCities(query: CityQueryDto): Promise<CitiesListResponseDto> {
    const startTime = Date.now();
    const { state, district, limit = 100, page = 1 } = query;

    // Build cache key based on filters
    const cacheKey = `admin:cities:${state || 'all'}:${district || 'all'}:${page}:${limit}`;
    this.logger.log(`🔍 Fetching cities (state: ${state || 'all'}, district: ${district || 'all'})`);

    // Check cache first
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      const cacheTime = Date.now() - startTime;
      this.logger.log(`✅ Cache HIT for cities (${cacheTime}ms)`);
      return JSON.parse(cached);
    }

    this.logger.log(`❌ Cache MISS for cities - querying DB...`);

    // Build query with filters
    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('p')
      .select('p.city', 'name')
      .addSelect('p.state', 'state')
      .addSelect('p.district', 'district')
      .addSelect('COUNT(*)', 'pincodeCount')
      .where('p.is_active = :active', { active: true })
      .andWhere('p.city IS NOT NULL')
      .andWhere("p.city != ''");

    // Apply state filter
    if (state) {
      queryBuilder.andWhere('LOWER(p.state) = LOWER(:state)', { state });
    }

    // Apply district filter
    if (district) {
      queryBuilder.andWhere('LOWER(p.district) = LOWER(:district)', { district });
    }

    // Group by city, state, district
    queryBuilder.groupBy('p.city, p.state, p.district');

    // Order by city name
    queryBuilder.orderBy('p.city', 'ASC');

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.offset(offset).limit(limit);

    const dbStartTime = Date.now();
    const rawResults = await queryBuilder.getRawMany();
    const dbTime = Date.now() - dbStartTime;
    this.logger.log(`📊 DB query completed in ${dbTime}ms, found ${rawResults.length} cities`);

    // Build response
    const cities: CityDto[] = rawResults.map((row) => {
      const stateName = row.state || 'Unknown';
      const stateCode = this.getStateCode(stateName);

      return {
        name: row.name,
        state: stateName,
        stateCode,
        district: row.district || undefined,
        pincodeCount: parseInt(row.pincodeCount, 10),
      };
    });

    const response: CitiesListResponseDto = {
      total: cities.length,
      cities,
    };

    // Cache the result
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    const totalTime = Date.now() - startTime;
    this.logger.log(`✅ Cities fetched successfully (${totalTime}ms)`);

    return response;
  }

  /**
   * Helper: Get state name from state code
   */
  private getStateNameByCode(code: string): string | null {
    const upperCode = code.toUpperCase();
    const entry = Object.entries(this.STATE_CODES).find(([_, c]) => c === upperCode);
    return entry ? entry[0] : null;
  }
}
