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
 * Track 3: H3 Solo Operations
 * 
 * Provides:
 * - H3 encoding/decoding (coordinates ↔ H3 indices)
 * - H3 cell information
 * - Neighbor finding
 * - Nearby cell search
 * 
 * Endpoints:
 * 1. GET /api/v1/h3/:h3Index
 * 2. POST /api/v1/h3/encode
 * 3. POST /api/v1/h3/decode
 * 4. GET /api/v1/h3/neighbors/:h3Index
 * 5. GET /api/v1/h3/nearby
 * 
 * Data Sources:
 * - H3AlgorithmService: Pure H3 math (encode/decode/neighbors)
 * - RedisPersistentService: H3 → Pincode mapping (built during initialization)
 * - RedisCacheService: Cache expensive operations (nearby search, cell details)
 * 
 * Caching Strategy:
 * - encode/decode: NOT cached (pure algorithm, <0.1ms)
 * - getCellDetails: 1 hour TTL (includes Redis lookup for pincodes)
 * - nearby: 1 hour TTL (expensive BFS + multiple Redis lookups)
 * - neighbors: NOT cached (pure algorithm, <0.1ms)
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
