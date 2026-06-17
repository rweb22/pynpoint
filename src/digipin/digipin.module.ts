import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { DigipinAlgorithmService } from './services/digipin-algorithm.service';
import { DigipinService } from './services/digipin.service';
import { DigipinController } from './controllers/digipin.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

/**
 * DigipinModule
 *
 * Track 2: DIGIPIN Solo Operations (PURE - no database dependencies)
 *
 * Provides:
 * - DIGIPIN encoding/decoding (coordinates ↔ DIGIPIN code)
 * - DIGIPIN cell information (center, bounds, area, hierarchy)
 * - Neighbor finding (8-neighbor grid system)
 * - Nearby cell search (radius-based)
 *
 * NOTE: This module is PURE and does NOT query pincodes or any other database entities.
 * For DIGIPIN ↔ Pincode conversions, see ConversionModule.
 *
 * Endpoints:
 * 1. GET /api/v1/digipin/:code - Get cell details
 * 2. POST /api/v1/digipin/encode - Encode coordinates to DIGIPIN
 * 3. POST /api/v1/digipin/decode - Decode DIGIPIN to coordinates
 * 4. GET /api/v1/digipin/neighbors/:code - Get neighboring cells
 * 5. GET /api/v1/digipin/nearby - Find cells within radius
 *
 * Caching Strategy:
 * - Uses RedisCacheService for cell details and nearby searches
 * - encode/decode NOT cached (pure algorithm, < 0.1ms)
 * - neighbors NOT cached (pure algorithm, < 1ms)
 * - Cell details: 1 hour TTL
 * - Nearby results: 1 hour TTL
 *
 * Authentication:
 * - All endpoints protected by ApiKeyGuard
 * - Rate limiting enforced by RateLimitInterceptor
 * - Usage tracked by UsageTrackingInterceptor
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage]), // ApiUsage needed for UsageTrackingInterceptor
    RedisModule, // For RedisCacheService
    AuthModule,  // For guards and interceptors
  ],
  controllers: [DigipinController],
  providers: [DigipinAlgorithmService, DigipinService],
  exports: [DigipinAlgorithmService, DigipinService],
})
export class DigipinModule {}
