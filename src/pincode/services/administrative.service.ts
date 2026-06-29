import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { PincodeCacheService } from '../../redis/pincode-cache.service';
import {
  StatesListResponseDto,
  StateDetailResponseDto,
  DistrictsListResponseDto,
  RegionsListResponseDto,
  StateDto,
  DistrictDto,
  RegionDto,
} from '../dto/pincode-response.dto';
import { DistrictQueryDto, RegionQueryDto } from '../dto/pincode-query.dto';

/**
 * AdministrativeService
 *
 * Handles administrative boundary queries (states, districts, regions).
 *
 * REDIS-FIRST STRATEGY:
 * - Uses persistent Redis cache (loaded at startup, never expires)
 * - Falls back to PostgreSQL on cache misses or errors
 * - Performance: <1ms for cached queries (O(1) Redis HASH lookups)
 *
 * Endpoints:
 * - GET /administrative/states - List all states
 * - GET /administrative/states/:code - Get state details
 * - GET /administrative/districts - List districts (optionally filtered by state)
 * - GET /administrative/regions - List regions (filtered by state/circle)
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
    private readonly pincodeCacheService: PincodeCacheService,
  ) {}

  /**
   * Get all states with metadata
   * GET /administrative/states
   *
   * REDIS-FIRST: Uses persistent cache loaded at startup
   */
  async getStates(): Promise<StatesListResponseDto> {
    try {
      this.logger.log('⚡ Fetching states from persistent Redis cache');

      // Try persistent cache first
      const cachedStates = await this.pincodeCacheService.getAllStates();

      if (cachedStates && cachedStates.length > 0) {
        // Get district count for each state from districts:meta
        const allDistricts = await this.pincodeCacheService.getAllDistricts();

        const states: StateDto[] = cachedStates.map(state => {
          const districtCount = allDistricts.filter(d =>
            d.state.toLowerCase().trim() === state.name.toLowerCase().trim()
          ).length;

          return {
            name: state.name,
            code: this.getStateCode(state.name),
            pincodeCount: state.pincodeCount,
            districtCount,
          };
        }).sort((a, b) => a.name.localeCompare(b.name));

        this.logger.log(`✅ Redis hit: ${states.length} states from persistent cache`);

        return {
          total: states.length,
          states,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Redis error in getStates: ${error.message}`, error.stack);
      this.logger.log('⚠️ Falling back to PostgreSQL');
    }

    // Fallback to PostgreSQL
    return this.getStatesFromDatabase();
  }

  /**
   * Database fallback for getStates()
   */
  private async getStatesFromDatabase(): Promise<StatesListResponseDto> {
    this.logger.log('📊 Querying states from PostgreSQL');

    const results = await this.pincodeRepository
      .createQueryBuilder('pincode')
      .select('pincode.state', 'name')
      .addSelect('COUNT(DISTINCT pincode.pincode)', 'pincodeCount')
      .addSelect('COUNT(DISTINCT pincode.district)', 'districtCount')
      .where('pincode.is_active = :isActive', { isActive: true })
      .andWhere('pincode.state IS NOT NULL')
      .andWhere('pincode.state != :na', { na: 'na' })
      .groupBy('pincode.state')
      .orderBy('pincode.state', 'ASC')
      .getRawMany();

    const states: StateDto[] = results.map(r => ({
      name: r.name,
      code: this.getStateCode(r.name),
      pincodeCount: parseInt(r.pincodeCount, 10),
      districtCount: parseInt(r.districtCount, 10),
    }));

    return {
      total: states.length,
      states,
    };
  }

  /**
   * Get state details by code
   * GET /administrative/states/:code
   *
   * REDIS-FIRST: Uses persistent cache loaded at startup
   */
  async getStateDetails(stateCode: string): Promise<StateDetailResponseDto> {
    // Find state name by code
    const stateName = this.getStateNameByCode(stateCode);
    if (!stateName) {
      throw new NotFoundException(`State code ${stateCode} not found`);
    }

    try {
      this.logger.log(`⚡ Fetching state details for ${stateName} from persistent Redis cache`);

      const stateData = await this.pincodeCacheService.getStateByName(stateName);

      if (stateData) {
        this.logger.log(`✅ Redis hit: ${stateData.districts.length} districts, ${stateData.pincodeCount} pincodes`);

        return {
          name: stateData.name,
          code: stateCode.toUpperCase(),
          pincodeCount: stateData.pincodeCount,
          districtCount: stateData.districts.length,
          districts: stateData.districts,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Redis error in getStateDetails: ${error.message}`, error.stack);
      this.logger.log('⚠️ Falling back to PostgreSQL');
    }

    // Fallback to PostgreSQL
    return this.getStateDetailsFromDatabase(stateName, stateCode);
  }

  /**
   * Database fallback for getStateDetails()
   */
  private async getStateDetailsFromDatabase(stateName: string, stateCode: string): Promise<StateDetailResponseDto> {
    this.logger.log(`📊 Querying state details for ${stateName} from PostgreSQL`);

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

    return {
      name: stateName,
      code: stateCode.toUpperCase(),
      pincodeCount: totalPincodes,
      districtCount: districts.length,
      districts,
    };
  }

  /**
   * Get districts (optionally filtered by state)
   * GET /administrative/districts?state=...
   *
   * REDIS-FIRST: Uses persistent cache loaded at startup
   */
  async getDistricts(query: DistrictQueryDto): Promise<DistrictsListResponseDto> {
    const { state, limit = 100, page = 1 } = query;

    try {
      this.logger.log(`⚡ Fetching districts from persistent Redis cache (state=${state || 'all'})`);

      const cachedDistricts = await this.pincodeCacheService.getAllDistricts(state);

      if (cachedDistricts && cachedDistricts.length > 0) {
        const districts: DistrictDto[] = cachedDistricts.map(d => ({
          name: d.name,
          state: d.state,
          stateCode: this.getStateCode(d.state),
          pincodeCount: d.pincodeCount,
        }));

        // Apply pagination
        const total = districts.length;
        const skip = (page - 1) * limit;
        const paginated = districts.slice(skip, skip + limit);

        this.logger.log(`✅ Redis hit: ${total} districts (returning page ${page}, ${paginated.length} items)`);

        return {
          total,
          districts: paginated,
        };
      }
    } catch (error) {
      this.logger.error(`❌ Redis error in getDistricts: ${error.message}`, error.stack);
      this.logger.log('⚠️ Falling back to PostgreSQL');
    }

    // Fallback to PostgreSQL
    return this.getDistrictsFromDatabase(state, limit, page);
  }

  /**
   * Database fallback for getDistricts()
   */
  private async getDistrictsFromDatabase(state: string | undefined, limit: number, page: number): Promise<DistrictsListResponseDto> {
    this.logger.log(`📊 Querying districts from PostgreSQL (state=${state || 'all'})`);

    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('pincode')
      .select('pincode.district', 'name')
      .addSelect('pincode.state', 'state')
      .addSelect('COUNT(DISTINCT pincode.pincode)', 'pincodeCount')
      .where('pincode.is_active = :isActive', { isActive: true })
      .andWhere('pincode.district IS NOT NULL')
      .andWhere('pincode.district != :na', { na: 'na' })
      .andWhere('LOWER(pincode.state) != :unknown', { unknown: 'unknown' })
      .andWhere('pincode.state != :naState', { naState: 'na' })
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

    return {
      total,
      districts: paginated,
    };
  }

  /**
   * Helper: Get state code from state name
   */
  private getStateCode(stateName: string): string {
    const normalized = stateName?.toLowerCase().trim();
    return this.STATE_CODES[normalized] || 'XX';
  }

  /**
   * Get all regions (optionally filtered by state and/or circle)
   * GET /administrative/regions?state=...&circle=...
   */
  async getRegions(query: RegionQueryDto): Promise<RegionsListResponseDto> {
    const startTime = Date.now();
    const { state, circle, limit = 100, page = 1 } = query;

    // Build cache key based on filters
    const cacheKey = `admin:regions:${state || 'all'}:${circle || 'all'}:${page}:${limit}`;
    this.logger.log(`🔍 Fetching regions (state: ${state || 'all'}, circle: ${circle || 'all'})`);

    // Check cache first
    const cached = await this.redisCache.get(cacheKey);
    if (cached) {
      const cacheTime = Date.now() - startTime;
      this.logger.log(`✅ Cache HIT for regions (${cacheTime}ms)`);
      return JSON.parse(cached);
    }

    this.logger.log(`❌ Cache MISS for regions - querying DB...`);

    // Build query with filters
    const queryBuilder = this.pincodeRepository
      .createQueryBuilder('p')
      .select('p.region', 'name')
      .addSelect('p.circle', 'circle')
      .addSelect('p.state', 'state')
      .addSelect('COUNT(*)', 'pincodeCount')
      .where('p.is_active = :active', { active: true })
      .andWhere('p.region IS NOT NULL')
      .andWhere("p.region != ''")
      .andWhere('p.state IS NOT NULL')
      .andWhere('LOWER(p.state) != :na', { na: 'na' })
      .andWhere('LOWER(p.state) != :unknown', { unknown: 'unknown' });

    // Apply state filter
    if (state) {
      queryBuilder.andWhere('LOWER(p.state) = LOWER(:state)', { state });
    }

    // Apply circle filter
    if (circle) {
      queryBuilder.andWhere('LOWER(p.circle) = LOWER(:circle)', { circle });
    }

    // Group by region, circle, state
    queryBuilder.groupBy('p.region, p.circle, p.state');

    // Order by region name
    queryBuilder.orderBy('p.region', 'ASC');

    // Pagination
    const offset = (page - 1) * limit;
    queryBuilder.offset(offset).limit(limit);

    const dbStartTime = Date.now();
    const rawResults = await queryBuilder.getRawMany();
    const dbTime = Date.now() - dbStartTime;
    this.logger.log(`📊 DB query completed in ${dbTime}ms, found ${rawResults.length} regions`);

    // Build response
    const regions: RegionDto[] = rawResults.map((row) => {
      const stateName = row.state || 'Unknown';
      const stateCode = this.getStateCode(stateName);

      return {
        name: row.name,
        circle: row.circle || undefined,
        state: stateName,
        stateCode,
        pincodeCount: parseInt(row.pincodeCount, 10),
      };
    });

    const response: RegionsListResponseDto = {
      total: regions.length,
      regions,
    };

    // Cache the result
    await this.redisCache.set(cacheKey, JSON.stringify(response), this.CACHE_TTL);

    const totalTime = Date.now() - startTime;
    this.logger.log(`✅ Regions fetched successfully (${totalTime}ms)`);

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
