import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisCacheService
 * 
 * Dedicated Redis client for ephemeral caching and rate limiting.
 * 
 * Configuration:
 * - maxmemory-policy: allkeys-lru (evict least recently used)
 * - NO RDB snapshots (ephemeral data)
 * - NO persistent volume (data can be lost on restart)
 * 
 * Purpose:
 * - API key validation cache (TTL: 1 hour)
 * - Rate limit counters (TTL: 1 minute to 1 day)
 * - Temporary session data
 * - General application caching
 */
@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_CACHE_URL')
      || this.configService.get<string>('REDIS_URL')?.replace(/\/\d+$/, '') + '/1' // Fallback: same instance, DB 1
      || 'redis://localhost:6379/1';

    if (!this.configService.get<string>('REDIS_CACHE_URL')) {
      this.logger.warn('⚠️  REDIS_CACHE_URL not set. Using REDIS_URL database 1. For production, create separate Redis instance.');
    }

    this.logger.log(`Connecting to CACHE Redis (auth, rate-limit): ${redisUrl}`);

    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Redis CACHE retry #${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ CACHE Redis connected (auth, rate-limit)');
    });

    this.client.on('error', (err) => {
      this.logger.error('CACHE Redis error:', err);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('CACHE Redis reconnecting...');
    });

    await this.client.ping();
    this.logger.log('✅ CACHE Redis ready');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting CACHE Redis...');
    await this.client.quit();
    this.logger.log('✅ CACHE Redis disconnected');
  }

  /**
   * Get the underlying ioredis client
   */
  getClient(): Redis {
    return this.client;
  }

  // === API Key Caching ===

  /**
   * Cache API key validation result
   * @param keyHash SHA-256 hash of the API key
   * @param keyData Key metadata (external_customer_id, tier, etc.)
   * @param ttl Time to live in seconds (default: 1 hour)
   */
  async cacheApiKey(keyHash: string, keyData: any, ttl: number = 3600): Promise<void> {
    await this.client.setex(`apikey:${keyHash}`, ttl, JSON.stringify(keyData));
  }

  /**
   * Get cached API key data
   * @param keyHash SHA-256 hash of the API key
   */
  async getCachedApiKey(keyHash: string): Promise<any | null> {
    const data = await this.client.get(`apikey:${keyHash}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Invalidate cached API key (on revocation or tier change)
   * @param keyHash SHA-256 hash of the API key
   */
  async invalidateApiKey(keyHash: string): Promise<void> {
    await this.client.del(`apikey:${keyHash}`);
  }

  /**
   * Invalidate all cached keys for a customer
   * @param externalCustomerId Customer ID from main website
   */
  async invalidateCustomerKeys(externalCustomerId: string): Promise<void> {
    const keys = await this.client.keys(`apikey:*`);
    // Note: This is a naive implementation - in production, maintain a SET of keys per customer
    for (const key of keys) {
      const data = await this.client.get(key);
      if (data) {
        const keyData = JSON.parse(data);
        if (keyData.externalCustomerId === externalCustomerId) {
          await this.client.del(key);
        }
      }
    }
  }

  // === Rate Limiting (Token Bucket) ===

  /**
   * Increment rate limit counter
   * @param key Rate limit key (e.g., `ratelimit:customer123:min:12345`)
   * @returns Current count after increment
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * Set expiration on rate limit key
   * @param key Rate limit key
   * @param seconds TTL in seconds
   */
  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  /**
   * Get time-to-live for rate limit key
   * @param key Rate limit key
   * @returns TTL in seconds, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  // === Generic Operations ===

  async get(key: string): Promise<string | null> {
    try {
      const result = await this.client.get(key);
      this.logger.debug(`GET ${key}: ${result ? 'HIT' : 'MISS'}`);
      return result;
    } catch (error) {
      this.logger.error(`Redis GET error for key ${key}:`, error);
      return null; // Graceful degradation
    }
  }

  async set(key: string, value: string | number, ttl?: number): Promise<'OK'> {
    try {
      let result: 'OK';
      if (ttl) {
        result = await this.client.setex(key, ttl, value.toString());
        this.logger.debug(`SET ${key} (TTL: ${ttl}s): OK`);
      } else {
        result = await this.client.set(key, value);
        this.logger.debug(`SET ${key} (no TTL): OK`);
      }
      return result;
    } catch (error) {
      this.logger.error(`Redis SET error for key ${key}:`, error);
      return 'OK'; // Graceful degradation - pretend it worked
    }
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.exists(...keys);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async flushdb(): Promise<'OK'> {
    this.logger.warn('⚠️  Flushing CACHE Redis - all cached data will be deleted!');
    return this.client.flushdb();
  }
}
