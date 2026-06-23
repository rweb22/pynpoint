import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisCacheService } from './redis-cache.service';

/**
 * RedisModule
 *
 * Provides Redis caching for:
 * - API authentication (API key validation)
 * - Rate limiting (request counters)
 * - General caching (query results)
 *
 * Configuration:
 * - maxmemory-policy: allkeys-lru
 * - NO persistence (ephemeral data)
 *
 * Environment variables:
 * - REDIS_CACHE_URL: redis://host:port (auth/rate-limit)
 * - REDIS_URL: Fallback for RedisCacheService
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class RedisModule {}
