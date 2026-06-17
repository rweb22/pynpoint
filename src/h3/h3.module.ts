import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { H3AlgorithmService } from './services/h3-algorithm.service';
import { H3Service } from './services/h3.service';
import { H3Controller } from './controllers/h3.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

/**
 * H3Module
 *
 * Track 3: H3 Solo Operations (PURE - No Cross-System References)
 *
 * Provides PURE H3 hexagonal spatial indexing operations:
 * - H3 encoding/decoding (coordinates ↔ H3 indices)
 * - H3 cell information (boundary, area, center)
 * - Neighbor finding (6 surrounding hexagons)
 * - Nearby cell search (BFS within radius)
 * - Hierarchy navigation (parent, children, ancestors)
 *
 * Endpoints (8 total):
 * 1. POST /api/v1/h3/encode - Convert coordinates to H3
 * 2. POST /api/v1/h3/decode - Convert H3 to coordinates
 * 3. GET /api/v1/h3/:h3Index - Cell details (geometry only)
 * 4. GET /api/v1/h3/neighbors/:h3Index - 6 neighbors
 * 5. GET /api/v1/h3/nearby - Cells within radius
 * 6. GET /api/v1/h3/:h3Index/parent - Parent cell
 * 7. GET /api/v1/h3/:h3Index/children - Children cells
 * 8. GET /api/v1/h3/:h3Index/ancestors - Full hierarchy to root
 *
 * Data Sources:
 * - H3AlgorithmService: Pure H3 math (h3-js library)
 * - RedisCacheService: Cache expensive operations (nearby, cell details)
 * - NO database access, NO pincode lookups (Track 4 handles cross-system)
 *
 * Caching Strategy:
 * - encode/decode: NOT cached (pure algorithm, <0.1ms)
 * - getCellDetails: 1 hour TTL (caches geometry calculations)
 * - nearby: 1 hour TTL (expensive BFS search)
 * - neighbors/parent/children/ancestors: NOT cached (pure algorithm)
 *
 * Authentication:
 * - All endpoints protected by ApiKeyGuard
 * - Rate limiting enforced by RateLimitInterceptor
 * - Usage tracked by UsageTrackingInterceptor
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage]), // ApiUsage needed for UsageTrackingInterceptor
    RedisModule, // For RedisPersistentService and RedisCacheService
    AuthModule,  // For guards and interceptors
  ],
  controllers: [H3Controller],
  providers: [H3AlgorithmService, H3Service],
  exports: [H3AlgorithmService, H3Service],
})
export class H3Module {}
