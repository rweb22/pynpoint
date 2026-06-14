import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ApiKey } from '../database/entities/api-key.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { ApiKeyService } from './services/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { UsageTrackingInterceptor } from './interceptors/usage-tracking.interceptor';
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
 * Guards:
 * - ApiKeyGuard: Validate API keys from Authorization header
 * - AdminAuthGuard: Protect admin endpoints with ADMIN_API_SECRET
 *
 * Interceptors:
 * - RateLimitInterceptor: Enforce tier-based rate limits
 * - UsageTrackingInterceptor: Track API usage for analytics
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ApiKey, ApiUsage]),
    RedisModule, // Provides RedisCacheService
  ],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    AdminAuthGuard,
    RateLimitInterceptor,
    UsageTrackingInterceptor,
  ],
  exports: [
    ApiKeyService,
    ApiKeyGuard,
    AdminAuthGuard,
    RateLimitInterceptor,
    UsageTrackingInterceptor,
  ],
})
export class AuthModule {}
