import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { PincodeService } from './services/pincode.service';
import { AdministrativeService } from './services/administrative.service';
import { PincodeController, AdministrativeController } from './controllers/pincode.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

/**
 * PincodeModule
 * 
 * Track 1: Pincode Solo Operations
 * 
 * Provides:
 * - Pincode lookup and search
 * - Administrative boundaries (states, districts)
 * - Bulk operations
 * 
 * Endpoints:
 * 1. GET /api/v1/pincodes/:pincode
 * 2. GET /api/v1/pincodes (search/filter)
 * 3. POST /api/v1/pincodes/bulk/lookup
 * 4. GET /api/v1/administrative/states
 * 5. GET /api/v1/administrative/states/:code
 * 6. GET /api/v1/administrative/districts
 * 
 * Caching Strategy:
 * - Uses RedisCacheService for all caching
 * - Single pincode: 1 hour TTL
 * - Administrative data: 24 hours TTL
 * - Query results: 10 minutes TTL
 * 
 * Authentication:
 * - All endpoints protected by ApiKeyGuard
 * - Rate limiting enforced by RateLimitInterceptor
 * - Usage tracked by UsageTrackingInterceptor
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pincode, PostOffice, ApiUsage]), // ApiUsage needed for UsageTrackingInterceptor
    RedisModule, // For RedisCacheService
    AuthModule,  // For guards and interceptors
  ],
  controllers: [PincodeController, AdministrativeController],
  providers: [PincodeService, AdministrativeService],
  exports: [PincodeService, AdministrativeService],
})
export class PincodeModule {}
