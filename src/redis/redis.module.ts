import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisCacheService } from './redis-cache.service';
import { PincodeCacheService } from './pincode-cache.service';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';

/**
 * RedisModule
 *
 * Provides Redis caching for:
 * - API authentication (API key validation)
 * - Rate limiting (request counters)
 * - General caching (query results)
 * - Persistent pincode/post office cache (PincodeCacheService)
 *
 * Configuration:
 * - RedisCacheService: maxmemory-policy allkeys-lru (ephemeral)
 * - PincodeCacheService: noeviction (persistent cache)
 *
 * Environment variables:
 * - REDIS_CACHE_URL: redis://host:port (auth/rate-limit)
 * - REDIS_URL: Fallback for RedisCacheService
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Pincode, PostOffice]),
  ],
  providers: [RedisCacheService, PincodeCacheService],
  exports: [RedisCacheService, PincodeCacheService],
})
export class RedisModule {}
