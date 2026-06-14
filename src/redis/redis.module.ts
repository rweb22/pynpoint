import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';
import { RedisPersistentService } from './redis-persistent.service';
import { RedisCacheService } from './redis-cache.service';

/**
 * RedisModule
 *
 * Provides dual-Redis architecture:
 *
 * 1. RedisPersistentService (H3 spatial index)
 *    - maxmemory-policy: noeviction
 *    - RDB snapshots enabled
 *    - Persistent volume
 *    - 32.5M H3 hexagons
 *
 * 2. RedisCacheService (API auth, rate limiting)
 *    - maxmemory-policy: allkeys-lru
 *    - NO persistence
 *    - Ephemeral data
 *    - API key cache, rate limit counters
 *
 * 3. RedisService (Legacy, will be deprecated)
 *    - Kept for backward compatibility
 *    - Migrate to RedisPersistentService/RedisCacheService
 *
 * Environment variables:
 * - REDIS_PERSISTENT_URL: redis://host:port (H3 index)
 * - REDIS_CACHE_URL: redis://host:port (auth/rate-limit)
 * - REDIS_URL: Fallback for both (not recommended)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService, // Legacy
    RedisPersistentService,
    RedisCacheService,
  ],
  exports: [
    RedisService, // Legacy
    RedisPersistentService,
    RedisCacheService,
  ],
})
export class RedisModule {}
