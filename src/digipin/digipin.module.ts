import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pincode } from '../database/entities/pincode.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { DigipinAlgorithmService } from './services/digipin-algorithm.service';
import { DigipinService } from './services/digipin.service';
import { DigipinController } from './controllers/digipin.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

/**
 * DigipinModule
 * 
 * Track 2: DIGIPIN Solo Operations
 * 
 * Provides:
 * - DIGIPIN encoding/decoding (coordinates ↔ DIGIPIN code)
 * - DIGIPIN cell information
 * - Neighbor finding
 * - Nearby cell search
 * 
 * Endpoints:
 * 1. GET /api/v1/digipin/:code
 * 2. POST /api/v1/digipin/encode
 * 3. POST /api/v1/digipin/decode
 * 4. GET /api/v1/digipin/neighbors/:code
 * 5. GET /api/v1/digipin/nearby
 * 
 * Caching Strategy:
 * - Uses RedisCacheService for cell details and nearby searches
 * - encode/decode NOT cached (pure algorithm, < 0.1ms)
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
    TypeOrmModule.forFeature([Pincode, ApiUsage]), // ApiUsage needed for UsageTrackingInterceptor
    RedisModule, // For RedisCacheService
    AuthModule,  // For guards and interceptors
  ],
  controllers: [DigipinController],
  providers: [DigipinAlgorithmService, DigipinService],
  exports: [DigipinAlgorithmService, DigipinService],
})
export class DigipinModule {}
