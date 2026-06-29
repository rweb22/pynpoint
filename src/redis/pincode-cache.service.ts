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
export class PincodeCacheService {
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
   * Initialize Redis cache from PostgreSQL data
   *
   * Called by InitializationService AFTER PostgreSQL is populated
   *
   * @param force - If true, reload even if cache exists
   */
  async initializeCache(force = false): Promise<void> {
    this.logger.log('🚀 Starting pincode cache initialization...');

    try {
      // Check if cache is already loaded
      if (!force) {
        const cacheStatus = await this.redisCache.get('cache:pincode:loaded');

        if (cacheStatus === 'true') {
          this.logger.log('✅ Pincode cache already loaded (use force=true to reload)');
          this.isLoaded = true;
          return;
        }
      }

      const startTime = Date.now();

      // Step 1: Load pincodes with Head Office coordinates
      await this.loadPincodesIntoRedis();

      // Step 2: Load post offices
      await this.loadPostOfficesIntoRedis();

      // Step 3: Build search indexes (ZSETs for filtering/pagination)
      await this.buildSearchIndexes();

      // Step 4: Build geospatial index (GEORADIUS for nearby queries)
      await this.buildGeoIndex();

      // Mark as loaded
      await this.redisCache.set('cache:pincode:loaded', 'true', 0); // No expiry

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.isLoaded = true;

      this.logger.log(`✅ Pincode cache initialization complete (${duration}s)`);
      this.logger.log(`   Total Redis keys: ~67,740 | Memory: ~111 MB`);
    } catch (error) {
      this.logger.error('❌ Failed to initialize pincode cache:', error);
      throw error; // Propagate to InitializationService
    }
  }

  /**
   * Load all pincodes into Redis HASHes
   *
   * Coordinate priority for distance calculations:
   * 1. Head Office (HO) coordinates (most accurate, physical location)
   * 2. Sub Office (SO) coordinates (if no HO available)
   * 3. Branch Office (BO) coordinates (if no HO/SO available)
   * 4. Geometric centroid (computed from boundary polygon)
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

    // Get post office coordinates with priority: HO > SO > BO
    // We'll select the best available coordinate for each pincode
    const postOffices = await this.postOfficeRepository
      .createQueryBuilder('po')
      .select([
        'po.pincode',
        'po.officetype',
        'po.latitude',
        'po.longitude',
      ])
      .where('po.is_active = :active', { active: true })
      .andWhere('po.latitude IS NOT NULL')
      .andWhere('po.longitude IS NOT NULL')
      .orderBy('po.pincode', 'ASC')
      .addOrderBy(
        `CASE po.officetype WHEN 'HO' THEN 1 WHEN 'SO' THEN 2 WHEN 'BO' THEN 3 ELSE 4 END`,
        'ASC'
      )
      .getRawMany();

    // Create best-office coordinate lookup map (first entry per pincode is the best due to ORDER BY)
    const officeCoords = new Map<string, { lat: number; lng: number; type: string }>();
    for (const po of postOffices) {
      if (!officeCoords.has(po.po_pincode)) {
        officeCoords.set(po.po_pincode, {
          lat: Number(po.po_latitude),
          lng: Number(po.po_longitude),
          type: po.po_officetype,
        });
      }
    }

    this.logger.log(`Found ${officeCoords.size} pincodes with office coordinates`);

    // Count by type for logging
    const typeCount = { HO: 0, SO: 0, BO: 0, OTHER: 0 };
    for (const coord of officeCoords.values()) {
      if (coord.type === 'HO') typeCount.HO++;
      else if (coord.type === 'SO') typeCount.SO++;
      else if (coord.type === 'BO') typeCount.BO++;
      else typeCount.OTHER++;
    }
    this.logger.log(`  • HO coordinates: ${typeCount.HO}`);
    this.logger.log(`  • SO coordinates: ${typeCount.SO}`);
    this.logger.log(`  • BO coordinates: ${typeCount.BO}`);

    // Use Redis pipeline for batch insert (much faster)
    const pipeline = this.redisCache.getClient().pipeline();
    let withOfficeCoords = 0;
    let withCentroidOnly = 0;

    for (const pc of pincodes) {
      const key = `pincode:${pc.p_pincode}`;
      const office = officeCoords.get(pc.p_pincode);

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
        // Office coordinates (HO > SO > BO priority) - preferred for distance calculations
        office_lat: office?.lat || null,
        office_lng: office?.lng || null,
        office_type: office?.type || null, // Track which type of office provided the coordinates
        is_active: pc.p_is_active,
      };

      if (office) withOfficeCoords++;
      else if (pc.centroid_lat && pc.centroid_lng) withCentroidOnly++;

      pipeline.hset(key, data);
    }

    await pipeline.exec();
    this.logger.log(
      `✅ Cached ${pincodes.length} pincodes (${withOfficeCoords} with office coords, ${withCentroidOnly} centroid-only)`
    );
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
      select: ['pincode', 'state', 'district', 'office_name'],
    });

    const pipeline = this.redisCache.getClient().pipeline();

    // Index maps
    const byState = new Map<string, Set<string>>();
    const byDistrict = new Map<string, Set<string>>();
    const statesMeta = new Map<string, any>();
    const districtsMeta = new Map<string, any>();
    const allPincodes = new Set<string>();

    for (const pc of pincodes) {
      const state = this.normalizeKey(pc.state || '');
      const district = this.normalizeKey(pc.district || '');

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

    // Store metadata
    for (const [state, meta] of statesMeta.entries()) {
      pipeline.hset('states:meta', state, JSON.stringify(meta));
    }

    for (const [districtKey, meta] of districtsMeta.entries()) {
      pipeline.hset('districts:meta', districtKey, JSON.stringify(meta));
    }

    await pipeline.exec();
    this.logger.log(
      `✅ Built indexes: ${byState.size} states, ${byDistrict.size} districts`
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
    page?: number;
    limit?: number;
  }): Promise<{ pincodes: string[]; total: number }> {
    const { state, district, page = 1, limit = 25 } = filters;

    // Calculate range for ZRANGE (0-indexed)
    const start = (page - 1) * limit;
    const stop = start + limit - 1;

    let indexKey: string;
    let countKey: string;

    // Strategy: Use most specific pre-computed index
    if (state && district) {
      // Use district index (compound key: state:district)
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(district)}`;
      indexKey = `district:index:${normalized}`;
      countKey = `count:district:${normalized}`;
    } else if (state) {
      // Use state index
      const normalized = this.normalizeKey(state);
      indexKey = `state:index:${normalized}`;
      countKey = `count:state:${normalized}`;
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
  }): Promise<number> {
    const { state, district } = filters;

    let countKey: string;

    if (state && district) {
      const normalized = `${this.normalizeKey(state)}:${this.normalizeKey(district)}`;
      countKey = `count:district:${normalized}`;
    } else if (state) {
      const normalized = this.normalizeKey(state);
      countKey = `count:state:${normalized}`;
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
    await this.initializeCache(true);
  }

  /**
   * Get best available coordinates for a pincode
   * Priority: Office coordinates (HO > SO > BO) > Centroid
   *
   * @param pincode - Pincode to get coordinates for
   * @returns {lat, lng} or null if no coordinates available
   */
  async getPincodeCoordinates(pincode: string): Promise<{ lat: number; lng: number } | null> {
    const key = `pincode:${pincode}`;
    const data = await this.redisCache.getClient().hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    // Try office coordinates first (HO/SO/BO - most accurate for logistics)
    if (data.office_lat && data.office_lng) {
      return {
        lat: parseFloat(data.office_lat),
        lng: parseFloat(data.office_lng),
      };
    }

    // Fallback to centroid (computed from boundary polygon)
    if (data.centroid_lat && data.centroid_lng) {
      return {
        lat: parseFloat(data.centroid_lat),
        lng: parseFloat(data.centroid_lng),
      };
    }

    return null;
  }
}
