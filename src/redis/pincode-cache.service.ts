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
   * Build search indexes (state, district)
   */
  private async buildSearchIndexes(): Promise<void> {
    this.logger.log('📦 Building search indexes...');

    const pincodes = await this.pincodeRepository.find({
      where: { is_active: true },
      select: ['pincode', 'state', 'district'],
    });

    const pipeline = this.redisCache.getClient().pipeline();

    // Group by state
    const byState = new Map<string, Set<string>>();
    const byDistrict = new Map<string, Set<string>>();
    const statesMeta = new Map<string, any>();
    const districtsMeta = new Map<string, any>();

    for (const pc of pincodes) {
      const state = (pc.state || '').toLowerCase().trim();
      const district = (pc.district || '').toLowerCase().trim();

      if (state && state !== 'na') {
        // Add to state index
        if (!byState.has(state)) {
          byState.set(state, new Set());
          statesMeta.set(state, {
            name: pc.state,
            pincodeCount: 0,
          });
        }
        byState.get(state)!.add(pc.pincode);
        statesMeta.get(state)!.pincodeCount++;

        // Add to district index
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

    // Store state indexes
    for (const [state, pincodeSet] of byState.entries()) {
      pipeline.sadd(`state:index:${state}`, ...Array.from(pincodeSet));
    }

    // Store district indexes
    for (const [districtKey, pincodeSet] of byDistrict.entries()) {
      pipeline.sadd(`district:index:${districtKey}`, ...Array.from(pincodeSet));
    }

    // Store metadata
    for (const [state, meta] of statesMeta.entries()) {
      pipeline.hset('states:meta', state, JSON.stringify(meta));
    }

    for (const [districtKey, meta] of districtsMeta.entries()) {
      pipeline.hset('districts:meta', districtKey, JSON.stringify(meta));
    }

    await pipeline.exec();
    this.logger.log(`✅ Built indexes: ${byState.size} states, ${byDistrict.size} districts`);
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
   * Get pincodes by state
   */
  async getPincodesByState(state: string): Promise<string[]> {
    const normalized = state.toLowerCase().trim();
    return await this.redisCache.getClient().smembers(`state:index:${normalized}`);
  }

  /**
   * Get pincodes by district
   */
  async getPincodesByDistrict(state: string, district: string): Promise<string[]> {
    const normalizedState = state.toLowerCase().trim();
    const normalizedDistrict = district.toLowerCase().trim();
    return await this.redisCache.getClient().smembers(`district:index:${normalizedState}:${normalizedDistrict}`);
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
