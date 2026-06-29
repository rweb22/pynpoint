import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';
import { RedisCacheService } from './redis-cache.service';

/**
 * PincodeCacheService
 *
 * Persistent Redis cache for all pincodes and post offices data.
 * Loads entire dataset into Redis on startup for O(1) lookups.
 *
 * Data Structures:
 * - pincode:{code} - HASH with full pincode data (no PostGIS)
 * - postoffices:{code} - LIST of post office JSON strings
 * - state:index:{state} - SET of pincodes in state
 * - district:index:{state}:{district} - SET of pincodes in district
 * - geo:pincodes - GEOSPATIAL index for centroids (GEORADIUS queries)
 * - states:meta - HASH of state metadata
 * - districts:meta - HASH of district metadata
 *
 * Memory Usage: ~50-60 MB for 19k pincodes + 150k post offices
 *
 * Benefits:
 * - O(1) pincode lookups (vs O(log n) PostgreSQL B-tree)
 * - Bulk lookups with MGET/pipelines
 * - State/district filtering with SET operations
 * - Nearby searches with GEORADIUS (for non-PostGIS queries)
 * - Zero database load for 95%+ of queries
 *
 * PostGIS Still Required For:
 * - Reverse geocoding (point-in-polygon: ST_Intersects)
 * - Boundary polygon queries
 * - Precise nearby with polygons (ST_DWithin on boundaries)
 */

@Injectable()
export class PincodeCacheService implements OnModuleInit {
  private readonly logger = new Logger(PincodeCacheService.name);
  private isLoaded = false;

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    @InjectRepository(PostOffice)
    private readonly postOfficeRepository: Repository<PostOffice>,
    private readonly redisCache: RedisCacheService,
  ) {}

  /**
   * Load entire dataset into Redis on application startup
   */
  async onModuleInit() {
    this.logger.log('🚀 Starting pincode cache initialization...');

    try {
      // Check if cache is already loaded
      const cacheStatus = await this.redisCache.get('cache:pincode:loaded');

      if (cacheStatus === 'true') {
        this.logger.log('✅ Pincode cache already loaded');
        this.isLoaded = true;
        return;
      }

      const startTime = Date.now();

      // Load pincodes
      await this.loadPincodesIntoRedis();

      // Load post offices
      await this.loadPostOfficesIntoRedis();

      // Build indexes
      await this.buildSearchIndexes();

      // Build geospatial index
      await this.buildGeoIndex();

      // Mark as loaded
      await this.redisCache.set('cache:pincode:loaded', 'true', 0); // No expiry

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.isLoaded = true;

      this.logger.log(`✅ Pincode cache initialization complete (${duration}s)`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize pincode cache:', error);
      // Don't throw - app should still work with database fallback
    }
  }

  /**
   * Load all pincodes into Redis HASHes
   */
  private async loadPincodesIntoRedis(): Promise<void> {
    this.logger.log('📦 Loading pincodes into Redis...');

    // Query all active pincodes with centroid
    const pincodes = await this.pincodeRepository
      .createQueryBuilder('p')
      .select([
        'p.id',
        'p.pincode',
        'p.office_name',
        'p.state',
        'p.district',
        'p.city',
        'p.region',
        'p.circle',
        'p.is_active',
      ])
      .addSelect('ST_Y(p.centroid::geometry)', 'centroid_lat')
      .addSelect('ST_X(p.centroid::geometry)', 'centroid_lng')
      .where('p.is_active = :active', { active: true })
      .getRawMany();

    this.logger.log(`Found ${pincodes.length} pincodes to cache`);

    // Use Redis pipeline for batch insert (much faster)
    const pipeline = this.redisCache.getClient().pipeline();

    for (const pc of pincodes) {
      const key = `pincode:${pc.p_pincode}`;
      const data = {
        id: pc.p_id,
        pincode: pc.p_pincode,
        office_name: pc.p_office_name || '',
        state: pc.p_state || '',
        district: pc.p_district || '',
        city: pc.p_city || '',
        region: pc.p_region || '',
        circle: pc.p_circle || '',
        centroid_lat: pc.centroid_lat || null,
        centroid_lng: pc.centroid_lng || null,
        is_active: pc.p_is_active,
      };

      pipeline.hset(key, data);
    }

    await pipeline.exec();
    this.logger.log(`✅ Cached ${pincodes.length} pincodes`);
  }

  /**
   * Load all post offices into Redis LISTs (grouped by pincode)
   */
  private async loadPostOfficesIntoRedis(): Promise<void> {
    this.logger.log('📦 Loading post offices into Redis...');

    const postOffices = await this.postOfficeRepository.find({
      where: { is_active: true },
      order: { pincode: 'ASC', officetype: 'ASC' },
    });

    this.logger.log(`Found ${postOffices.length} post offices to cache`);

    // Group by pincode
    const byPincode = new Map<string, PostOffice[]>();

    for (const po of postOffices) {
      if (!byPincode.has(po.pincode)) {
        byPincode.set(po.pincode, []);
      }
      byPincode.get(po.pincode)!.push(po);
    }

    // Use pipeline to store
    const pipeline = this.redisCache.getClient().pipeline();
    let totalCached = 0;

    for (const [pincode, offices] of byPincode.entries()) {
      const key = `postoffices:${pincode}`;
      const officeData = offices.map(po => JSON.stringify({
        id: po.id,
        officename: po.officename,
        area: po.area,
        officetype: po.officetype,
        delivery: po.delivery,
        district: po.district,
        state: po.state,
        division: po.division,
        region: po.region,
        circle: po.circle,
        latitude: po.latitude ? Number(po.latitude) : null,
        longitude: po.longitude ? Number(po.longitude) : null,
      }));

      pipeline.rpush(key, ...officeData);

      // Also store post office count in pincode hash
      pipeline.hset(`pincode:${pincode}`, 'post_office_count', offices.length);

      totalCached += offices.length;
    }

    await pipeline.exec();
    this.logger.log(`✅ Cached ${totalCached} post offices across ${byPincode.size} pincodes`);
  }

  /**
   * Build search indexes (state, district, city)
   * Creates inverted indexes for O(1) filtered queries
   */
  private async buildSearchIndexes(): Promise<void> {
    this.logger.log('📦 Building search indexes...');

    const pincodes = await this.pincodeRepository.find({
      where: { is_active: true },
      select: ['pincode', 'state', 'district', 'city', 'office_name'],
    });

    const pipeline = this.redisCache.getClient().pipeline();

    // Index maps
    const byState = new Map<string, Set<string>>();
    const byDistrict = new Map<string, Set<string>>();
    const byCity = new Map<string, Set<string>>();
    const statesMeta = new Map<string, any>();
    const districtsMeta = new Map<string, any>();
    const citiesMeta = new Map<string, any>();
    const allPincodes = new Set<string>();

    for (const pc of pincodes) {
      const state = this.normalizeKey(pc.state || '');
      const district = this.normalizeKey(pc.district || '');
      const city = this.normalizeKey(pc.city || '');

      // Add to "all pincodes" set
      allPincodes.add(pc.pincode);

      // State index
      if (state && state !== 'na') {
        if (!byState.has(state)) {
          byState.set(state, new Set());
          statesMeta.set(state, {
            name: pc.state,
            pincodeCount: 0,
          });
        }
        byState.get(state)!.add(pc.pincode);
        statesMeta.get(state)!.pincodeCount++;

        // District index (compound key: state:district)
        if (district && district !== 'na') {
          const districtKey = `${state}:${district}`;
          if (!byDistrict.has(districtKey)) {
            byDistrict.set(districtKey, new Set());
            districtsMeta.set(districtKey, {
              name: pc.district,
              state: pc.state,
              pincodeCount: 0,
            });
          }
          byDistrict.get(districtKey)!.add(pc.pincode);
          districtsMeta.get(districtKey)!.pincodeCount++;
        }
      }

      // City index
      if (city && city !== 'na') {
        if (!byCity.has(city)) {
          byCity.set(city, new Set());
          citiesMeta.set(city, {
            name: pc.city,
            pincodeCount: 0,
          });
        }
        byCity.get(city)!.add(pc.pincode);
        citiesMeta.get(city)!.pincodeCount++;
      }
    }

    // Store all pincodes as SORTED SET (sorted by pincode number for natural ordering)
    const allPincodesArray = Array.from(allPincodes).flatMap(pincode => [
      parseInt(pincode), // score
      pincode,           // member
    ]);
    pipeline.zadd('pincodes:all', ...allPincodesArray);
    pipeline.set('count:all', allPincodes.size);

    // Store state indexes as SORTED SETS
    for (const [state, pincodeSet] of byState.entries()) {
      const members = Array.from(pincodeSet).flatMap(pincode => [
        parseInt(pincode), // score = pincode number for natural sorting
        pincode,           // member
      ]);
      pipeline.zadd(`state:index:${state}`, ...members);
      pipeline.set(`count:state:${state}`, pincodeSet.size);
    }

    // Store district indexes as SORTED SETS
    for (const [districtKey, pincodeSet] of byDistrict.entries()) {
      const members = Array.from(pincodeSet).flatMap(pincode => [
        parseInt(pincode),
        pincode,
      ]);
      pipeline.zadd(`district:index:${districtKey}`, ...members);
      pipeline.set(`count:district:${districtKey}`, pincodeSet.size);
    }

    // Store city indexes as SORTED SETS
    for (const [city, pincodeSet] of byCity.entries()) {
      const members = Array.from(pincodeSet).flatMap(pincode => [
        parseInt(pincode),
        pincode,
      ]);
      pipeline.zadd(`city:index:${city}`, ...members);
      pipeline.set(`count:city:${city}`, pincodeSet.size);
    }

    // Build multi-criteria lookup tables (state+city combinations)
    this.logger.log('📦 Building multi-criteria lookup tables...');
    const stateCityMap = new Map<string, Set<string>>();
    const districtCityMap = new Map<string, Set<string>>();

    for (const pc of pincodes) {
      const state = this.normalizeKey(pc.state || '');
      const district = this.normalizeKey(pc.district || '');
      const city = this.normalizeKey(pc.city || '');

      // State + City combinations
      if (state && state !== 'na' && city && city !== 'na') {
        const key = `${state}:${city}`;
        if (!stateCityMap.has(key)) {
          stateCityMap.set(key, new Set());
        }
        stateCityMap.get(key)!.add(pc.pincode);
      }

      // District + City combinations (state:district:city)
      if (state && state !== 'na' && district && district !== 'na' && city && city !== 'na') {
        const key = `${state}:${district}:${city}`;
        if (!districtCityMap.has(key)) {
          districtCityMap.set(key, new Set());
        }
        districtCityMap.get(key)!.add(pc.pincode);
      }
    }

    // Store multi-criteria lookups
    for (const [key, pincodeSet] of stateCityMap.entries()) {
      const members = Array.from(pincodeSet).flatMap(pincode => [
        parseInt(pincode),
        pincode,
      ]);
      pipeline.zadd(`lookup:state-city:${key}`, ...members);
      pipeline.set(`count:state-city:${key}`, pincodeSet.size);
    }

    for (const [key, pincodeSet] of districtCityMap.entries()) {
      const members = Array.from(pincodeSet).flatMap(pincode => [
        parseInt(pincode),
        pincode,
      ]);
      pipeline.zadd(`lookup:district-city:${key}`, ...members);
      pipeline.set(`count:district-city:${key}`, pincodeSet.size);
    }

    // Store metadata
    for (const [state, meta] of statesMeta.entries()) {
      pipeline.hset('states:meta', state, JSON.stringify(meta));
    }

    for (const [districtKey, meta] of districtsMeta.entries()) {
      pipeline.hset('districts:meta', districtKey, JSON.stringify(meta));
    }

    for (const [city, meta] of citiesMeta.entries()) {
      pipeline.hset('cities:meta', city, JSON.stringify(meta));
    }

    await pipeline.exec();
    this.logger.log(
      `✅ Built indexes: ${byState.size} states, ${byDistrict.size} districts, ${byCity.size} cities`
    );
    this.logger.log(
      `✅ Built lookup tables: ${stateCityMap.size} state-city combos, ${districtCityMap.size} district-city combos`
    );
    this.logger.log(`✅ Total pincodes indexed: ${allPincodes.size}`);
  }

  /**
   * Normalize keys for consistent indexing (lowercase, trim, replace spaces with hyphens)
   */
  private normalizeKey(value: string): string {
    return value.toLowerCase().trim().replace(/\s+/g, '-');
  }

  /**
   * Build geospatial index for nearby queries
   * Uses Redis GEOADD for GEORADIUS queries
   */
  private async buildGeoIndex(): Promise<void> {
    this.logger.log('📦 Building geospatial index...');

    const pincodes = await this.pincodeRepository
      .createQueryBuilder('p')
      .select(['p.pincode'])
      .addSelect('ST_Y(p.centroid::geometry)', 'lat')
      .addSelect('ST_X(p.centroid::geometry)', 'lng')
      .where('p.is_active = :active', { active: true })
      .andWhere('p.centroid IS NOT NULL')
      .getRawMany();

    // Use pipeline for batch GEOADD
    const pipeline = this.redisCache.getClient().pipeline();
    const geoKey = 'geo:pincodes';

    // GEOADD accepts: longitude latitude member
    for (const pc of pincodes) {
      if (pc.lng && pc.lat) {
        pipeline.geoadd(geoKey, pc.lng, pc.lat, pc.p_pincode);
      }
    }

    await pipeline.exec();
    this.logger.log(`✅ Built geospatial index with ${pincodes.length} centroids`);
  }

  /**
   * Get pincode from cache
   */
  async getPincode(pincode: string): Promise<any | null> {
    const data: Record<string, string> = await this.redisCache.getClient().hgetall(`pincode:${pincode}`);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      ...data,
      centroid_lat: data.centroid_lat ? parseFloat(data.centroid_lat) : null,
      centroid_lng: data.centroid_lng ? parseFloat(data.centroid_lng) : null,
      post_office_count: data.post_office_count ? parseInt(data.post_office_count, 10) : 0,
      is_active: data.is_active === 'true',
    };
  }

  /**
   * Get post offices for a pincode
   */
  async getPostOffices(pincode: string): Promise<any[]> {
    const offices = await this.redisCache.getClient().lrange(`postoffices:${pincode}`, 0, -1);
    return offices.map(o => JSON.parse(o));
  }

  /**
   * Bulk fetch post offices for multiple pincodes
   */
  async getBulkPostOffices(pincodes: string[]): Promise<Map<string, any[]>> {
    const pipeline = this.redisCache.getClient().pipeline();

    for (const pincode of pincodes) {
      pipeline.lrange(`postoffices:${pincode}`, 0, -1);
    }

    const results = await pipeline.exec();
    const map = new Map<string, any[]>();

    for (let i = 0; i < pincodes.length; i++) {
      const [err, data] = results![i];
      if (!err && data && Array.isArray(data) && data.length > 0) {
        map.set(pincodes[i], data.map((o: string) => JSON.parse(o)));
      }
    }

    return map;
  }

  /**
   * Bulk pincode lookup
   */
  async getBulkPincodes(pincodes: string[]): Promise<Map<string, any>> {
    const pipeline = this.redisCache.getClient().pipeline();

    for (const pincode of pincodes) {
      pipeline.hgetall(`pincode:${pincode}`);
    }

    const results = await pipeline.exec();
    const map = new Map<string, any>();

    for (let i = 0; i < pincodes.length; i++) {
      const [err, data] = results![i];
      const hashData = data as Record<string, string>;
      if (!err && hashData && Object.keys(hashData).length > 0) {
        map.set(pincodes[i], {
          ...hashData,
          centroid_lat: hashData.centroid_lat ? parseFloat(hashData.centroid_lat) : null,
          centroid_lng: hashData.centroid_lng ? parseFloat(hashData.centroid_lng) : null,
          post_office_count: hashData.post_office_count ? parseInt(hashData.post_office_count, 10) : 0,
          is_active: hashData.is_active === 'true',
        });
      }
    }

    return map;
  }

  /**
   * Get paginated pincodes with count using SORTED SET
   * Returns both the pincodes for the page AND the total count
   */
  async getPincodesByFiltersWithPagination(filters: {
    state?: string;
    district?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<{ pincodes: string[]; total: number }> {
    const { state, district, city, page = 1, limit = 25 } = filters;

    // Calculate range for ZRANGE (0-indexed)
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    let indexKey: string;
    let countKey: string;

    // Strategy: Use most specific pre-computed index
    if (state && district && city) {
      // Use district-city lookup table
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(district)}:${this.normalizeKey(city)}`;
      indexKey = `lookup:district-city:${normalized}`;
      countKey = `count:district-city:${normalized}`;
    } else if (state && city) {
      // Use state-city lookup table
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(city)}`;
      indexKey = `lookup:state-city:${normalized}`;
      countKey = `count:state-city:${normalized}`;
    } else if (state && district) {
      // Use district index
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(district)}`;
      indexKey = `district:index:${normalized}`;
      countKey = `count:district:${normalized}`;
    } else if (state) {
      // Use state index
      const normalized = this.normalizeKey(state);
      indexKey = `state:index:${normalized}`;
      countKey = `count:state:${normalized}`;
    } else if (city) {
      // Use city index
      const normalized = this.normalizeKey(city);
      indexKey = `city:index:${normalized}`;
      countKey = `count:city:${normalized}`;
    } else {
      // No filters - all pincodes
      indexKey = 'pincodes:all';
      countKey = 'count:all';
    }

    // Fetch pincodes and count in parallel
    const [pincodes, countStr] = await Promise.all([
      this.redisCache.getClient().zrange(indexKey, start, stop),
      this.redisCache.getClient().get(countKey),
    ]);

    // If count cache miss, use ZCARD (slower but still O(1))
    const total = countStr ? parseInt(countStr, 10) : await this.redisCache.getClient().zcard(indexKey);

    return { pincodes, total };
  }

  /**
   * Get pincodes by state (all, no pagination)
   */
  async getPincodesByState(state: string): Promise<string[]> {
    const normalized = this.normalizeKey(state);
    return await this.redisCache.getClient().zrange(`state:index:${normalized}`, 0, -1);
  }

  /**
   * Get pincodes by district (all, no pagination)
   */
  async getPincodesByDistrict(state: string, district: string): Promise<string[]> {
    const normalizedState = this.normalizeKey(state);
    const normalizedDistrict = this.normalizeKey(district);
    return await this.redisCache.getClient().zrange(`district:index:${normalizedState}:${normalizedDistrict}`, 0, -1);
  }

  /**
   * Get pincodes by city (all, no pagination)
   */
  async getPincodesByCity(city: string): Promise<string[]> {
    const normalized = this.normalizeKey(city);
    return await this.redisCache.getClient().zrange(`city:index:${normalized}`, 0, -1);
  }

  /**
   * Get all active pincodes (all, no pagination)
   */
  async getAllPincodes(): Promise<string[]> {
    return await this.redisCache.getClient().zrange('pincodes:all', 0, -1);
  }

  /**
   * Get all states metadata from persistent cache
   */
  async getAllStates(): Promise<Array<{ name: string; pincodeCount: number }>> {
    const statesHash = await this.redisCache.getClient().hgetall('states:meta');

    if (!statesHash || Object.keys(statesHash).length === 0) {
      return [];
    }

    return Object.entries(statesHash).map(([key, value]) => {
      const meta = JSON.parse(value);
      return {
        name: meta.name,
        pincodeCount: meta.pincodeCount || 0,
      };
    });
  }

  /**
   * Get state details by name from persistent cache
   */
  async getStateByName(stateName: string): Promise<{ name: string; pincodeCount: number; districts: string[] } | null> {
    const normalized = this.normalizeKey(stateName);
    const metaStr = await this.redisCache.getClient().hget('states:meta', normalized);

    if (!metaStr) {
      return null;
    }

    const meta = JSON.parse(metaStr);

    // Get all districts for this state from districts:meta
    const allDistricts = await this.redisCache.getClient().hgetall('districts:meta');
    const stateDistricts: string[] = [];

    for (const [key, value] of Object.entries(allDistricts)) {
      if (key.startsWith(`${normalized}:`)) {
        const districtMeta = JSON.parse(value);
        stateDistricts.push(districtMeta.name);
      }
    }

    return {
      name: meta.name,
      pincodeCount: meta.pincodeCount || 0,
      districts: stateDistricts.sort(),
    };
  }

  /**
   * Get all districts metadata (optionally filtered by state)
   */
  async getAllDistricts(stateFilter?: string): Promise<Array<{ name: string; state: string; pincodeCount: number }>> {
    const districtsHash = await this.redisCache.getClient().hgetall('districts:meta');

    if (!districtsHash || Object.keys(districtsHash).length === 0) {
      return [];
    }

    const normalizedFilter = stateFilter ? this.normalizeKey(stateFilter) : null;

    const districts = Object.entries(districtsHash)
      .filter(([key, _]) => {
        if (!normalizedFilter) return true;
        return key.startsWith(`${normalizedFilter}:`);
      })
      .map(([key, value]) => {
        const meta = JSON.parse(value);
        return {
          name: meta.name,
          state: meta.state,
          pincodeCount: meta.pincodeCount || 0,
        };
      });

    return districts.sort((a, b) => {
      // Sort by state, then by district name
      if (a.state !== b.state) {
        return a.state.localeCompare(b.state);
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get total count for filters (O(1) from cache or ZCARD)
   */
  async getCountByFilters(filters: {
    state?: string;
    district?: string;
    city?: string;
  }): Promise<number> {
    const { state, district, city } = filters;

    let countKey: string;

    if (state && district && city) {
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(district)}:${this.normalizeKey(city)}`;
      countKey = `count:district-city:${normalized}`;
    } else if (state && city) {
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(city)}`;
      countKey = `count:state-city:${normalized}`;
    } else if (state && district) {
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(district)}`;
      countKey = `count:district:${normalized}`;
    } else if (state) {
      const normalized = this.normalizeKey(state);
      countKey = `count:state:${normalized}`;
    } else if (city) {
      const normalized = this.normalizeKey(city);
      countKey = `count:city:${normalized}`;
    } else {
      countKey = 'count:all';
    }

    const count = await this.redisCache.getClient().get(countKey);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Find nearby pincodes using GEORADIUS
   * Returns pincode codes within radius (in km)
   * Note: This uses centroid-to-centroid distance, not boundary intersection
   */
  async findNearbyPincodes(latitude: number, longitude: number, radiusKm: number, limit: number = 10): Promise<Array<{ pincode: string; distance: number }>> {
    const results = await this.redisCache.getClient().georadius(
      'geo:pincodes',
      longitude,
      latitude,
      radiusKm,
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      limit,
    );

    // Redis returns: [[pincode, distance], ...]
    return results.map((r: any) => ({
      pincode: r[0],
      distance: parseFloat(r[1]),
    }));
  }

  /**
   * Get all states metadata
   */
  async getStates(): Promise<any[]> {
    const data = await this.redisCache.getClient().hgetall('states:meta');
    return Object.values(data).map(v => JSON.parse(v));
  }

  /**
   * Get all districts metadata
   */
  async getDistricts(state?: string): Promise<any[]> {
    const data = await this.redisCache.getClient().hgetall('districts:meta');
    const allDistricts = Object.values(data).map(v => JSON.parse(v));

    if (state) {
      const normalized = state.toLowerCase().trim();
      return allDistricts.filter(d => d.state.toLowerCase().trim() === normalized);
    }

    return allDistricts;
  }

  /**
   * Check if cache is loaded
   */
  isCacheReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Force reload cache (admin operation)
   */
  async reloadCache(): Promise<void> {
    this.logger.warn('🔄 Force reloading pincode cache...');
    await this.redisCache.del('cache:pincode:loaded');
    this.isLoaded = false;
    await this.onModuleInit();
  }
}
