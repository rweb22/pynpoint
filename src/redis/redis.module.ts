import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * RedisModule
 * 
 * Provides Redis client for H3 spatial index storage.
 * 
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - Pipeline support for bulk operations
 * - Global module (available everywhere)
 * 
 * Environment variables:
 * - REDIS_URL: redis://host:port
 * - REDIS_PASSWORD: (optional)
 * - REDIS_DB: Database number (default: 0)
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
