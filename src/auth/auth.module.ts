import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiKey } from '../database/entities/api-key.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { MarketplaceConfig } from '../database/entities/marketplace-config.entity';
import { ApiKeyService } from './services/api-key.service';
import { MarketplaceConfigService } from './services/marketplace-config.service';
import { UsageSyncService } from './services/usage-sync.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { MarketplaceProxyGuard } from './guards/marketplace-proxy.guard';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { UsageTrackingInterceptor } from './interceptors/usage-tracking.interceptor';
import { TokenBucketRateLimitInterceptor } from './interceptors/token-bucket-rate-limit.interceptor';
import { StreamUsageTrackingInterceptor } from './interceptors/stream-usage-tracking.interceptor';
import { AdminApiKeyController } from './controllers/admin-api-key.controller';
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
 * - Redis Streams for usage tracking (zero DB writes on hot path)
 *
 * Services:
 * - ApiKeyService: Key generation, validation, caching
 * - UsageSyncService: Background worker (cron) to sync Redis Streams → PostgreSQL
 *
 * Guards:
 * - MarketplaceProxyGuard: Validate marketplace proxy requests (RapidAPI, AWS, Azure)
 * - ApiKeyGuard: Validate API keys from Authorization header
 * - AdminAuthGuard: Protect admin endpoints with ADMIN_API_SECRET
 *
 * Interceptors (NEW - Token Bucket + Redis Streams):
 * - TokenBucketRateLimitInterceptor: Token Bucket algorithm with Lua (1 Redis op vs 9)
 * - StreamUsageTrackingInterceptor: Redis Streams (0 DB writes vs 3)
 *
 * Interceptors (OLD - Deprecated, kept for reference):
 * - RateLimitInterceptor: Fixed window counter (9 Redis ops)
 * - UsageTrackingInterceptor: Direct DB writes (3 DB ops)
 *
 * Controllers:
 * - AdminApiKeyController: Admin endpoints for key provisioning
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Enable cron jobs for background worker
    TypeOrmModule.forFeature([ApiKey, ApiUsage, MarketplaceConfig]),
    RedisModule, // Provides TokenBucketService, UsageStreamsService
  ],
  controllers: [AdminApiKeyController],
  providers: [
    ApiKeyService,
    MarketplaceConfigService,
    UsageSyncService, // Background worker (cron)
    MarketplaceProxyGuard,
    ApiKeyGuard,
    AdminAuthGuard,
    // NEW interceptors (Token Bucket + Redis Streams)
    TokenBucketRateLimitInterceptor,
    StreamUsageTrackingInterceptor,
    // OLD interceptors (kept for backward compatibility)
    RateLimitInterceptor,
    UsageTrackingInterceptor,
  ],
  exports: [
    ApiKeyService,
    MarketplaceConfigService,
    MarketplaceProxyGuard,
    ApiKeyGuard,
    AdminAuthGuard,
    // Export NEW interceptors as default
    TokenBucketRateLimitInterceptor,
    StreamUsageTrackingInterceptor,
    // Also export old ones for gradual migration
    RateLimitInterceptor,
    UsageTrackingInterceptor,
  ],
})
export class AuthModule {}
