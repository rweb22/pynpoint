import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ApiKey } from '../database/entities/api-key.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { ApiKeyService } from './services/api-key.service';
import { RedisModule } from '../redis/redis.module';

/**
 * AuthModule
 * 
 * Provides API authentication and authorization services.
 * 
 * Architecture: Decoupled (no Customer entity)
 * - API keys reference external_customer_id (managed by main website)
 * - Tier stored locally for fast lookup
 * - Redis cache for validated keys (1 hour TTL)
 * 
 * Services:
 * - ApiKeyService: Key generation, validation, caching
 * 
 * Future (Phase 4+):
 * - Guards: ApiKeyGuard, AdminAuthGuard
 * - Interceptors: RateLimitInterceptor, UsageTrackingInterceptor
 * - Controllers: AdminApiKeyController
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ApiKey, ApiUsage]),
    RedisModule, // Provides RedisCacheService
  ],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class AuthModule {}
