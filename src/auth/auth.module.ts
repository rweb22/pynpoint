import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ApiKey } from '../database/entities/api-key.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { MarketplaceConfig } from '../database/entities/marketplace-config.entity';
import { ApiKeyService } from './services/api-key.service';
import { MarketplaceConfigService } from './services/marketplace-config.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { MarketplaceProxyGuard } from './guards/marketplace-proxy.guard';
import { RateLimitInterceptor } from './interceptors/rate-limit.interceptor';
import { UsageTrackingInterceptor } from './interceptors/usage-tracking.interceptor';
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
 *
 * Services:
 * - ApiKeyService: Key generation, validation, caching
 *
 * Guards:
 * - MarketplaceProxyGuard: Validate marketplace proxy requests (RapidAPI, AWS, Azure)
 * - ApiKeyGuard: Validate API keys from Authorization header
 * - AdminAuthGuard: Protect admin endpoints with ADMIN_API_SECRET
 *
 * Interceptors:
 * - RateLimitInterceptor: Enforce tier-based rate limits
 * - UsageTrackingInterceptor: Track API usage for analytics
 *
 * Controllers:
 * - AdminApiKeyController: Admin endpoints for key provisioning
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([ApiKey, ApiUsage, MarketplaceConfig]),
    RedisModule, // Provides RedisCacheService
  ],
  controllers: [AdminApiKeyController],
  providers: [
    ApiKeyService,
    MarketplaceConfigService,
    MarketplaceProxyGuard,
    ApiKeyGuard,
    AdminAuthGuard,
    RateLimitInterceptor,
    UsageTrackingInterceptor,
  ],
  exports: [
    ApiKeyService,
    MarketplaceConfigService,
    MarketplaceProxyGuard,
    ApiKeyGuard,
    AdminAuthGuard,
    RateLimitInterceptor,
    UsageTrackingInterceptor,
  ],
})
export class AuthModule {}
