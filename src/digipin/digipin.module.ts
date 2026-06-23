import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { Pincode } from '../database/entities/pincode.entity';
import { DigipinAlgorithmService } from './services/digipin-algorithm.service';
import { DigipinService } from './services/digipin.service';
import { DigipinController } from './controllers/digipin.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

/**
 * DigipinModule
 *
 * Track 2: DIGIPIN Operations
 *
 * Provides:
 * - DIGIPIN encoding/decoding (coordinates ↔ DIGIPIN code)
 * - DIGIPIN cell information (center, bounds, area, hierarchy)
 * - Hierarchy navigation (parent, children, ancestors)
 * - Neighbor finding (8-neighbor grid system)
 * - Nearby cell search (radius-based)
 * - Reverse geocoding (DIGIPIN → Pincode via PostGIS)
 *
 * Endpoints (10 total):
 * 1. POST /api/v1/digipin/encode - Encode coordinates to DIGIPIN
 * 2. POST /api/v1/digipin/decode - Decode DIGIPIN to coordinates
 * 3. POST /api/v1/digipin/validate - Validate DIGIPIN code
 * 4. POST /api/v1/digipin/to-pincode - Convert DIGIPIN to pincode (NEW!)
 * 5. GET /api/v1/digipin/nearby - Find cells within radius
 * 6. GET /api/v1/digipin/neighbors/:code - Get neighboring cells
 * 7. GET /api/v1/digipin/:code/parent - Get parent cell
 * 8. GET /api/v1/digipin/:code/children - Get children cells (16 cells, 4x4 grid)
 * 9. GET /api/v1/digipin/:code/ancestors - Get all ancestors
 * 10. GET /api/v1/digipin/:code - Get cell details
 *
 * Caching Strategy:
 * - Uses RedisCacheService for cell details and nearby searches
 * - encode/decode NOT cached (pure algorithm, < 0.1ms)
 * - neighbors NOT cached (pure algorithm, < 1ms)
 * - parent/children/ancestors NOT cached (pure algorithm, < 1ms)
 * - Cell details: 1 hour TTL
 * - Nearby results: 1 hour TTL
 * - to-pincode: NOT cached (PostGIS query already fast <10ms)
 *
 * Authentication:
 * - All endpoints protected by ApiKeyGuard
 * - Rate limiting enforced by RateLimitInterceptor
 * - Usage tracked by UsageTrackingInterceptor
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage, Pincode]), // ApiUsage for tracking, Pincode for to-pincode operation
    RedisModule, // For RedisCacheService
    AuthModule,  // For guards and interceptors
  ],
  controllers: [DigipinController],
  providers: [DigipinAlgorithmService, DigipinService],
  exports: [DigipinAlgorithmService, DigipinService],
})
export class DigipinModule {}
