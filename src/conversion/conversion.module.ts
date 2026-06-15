import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { Pincode } from '../database/entities/pincode.entity';
import { ConversionService } from './services/conversion.service';
import { ConversionAdvancedService } from './services/conversion-advanced.service';
import { ConversionController } from './controllers/conversion.controller';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { H3Module } from '../h3/h3.module';
import { DigipinModule } from '../digipin/digipin.module';

/**
 * ConversionModule
 * 
 * Track 4: Hybrid & Conversion Operations
 * 
 * Provides bidirectional conversion between:
 * - Pincodes ↔ H3 indexes
 * - Pincodes ↔ DIGIPIN codes
 * - DIGIPIN codes ↔ H3 indexes
 * 
 * Three Conversion Stacks:
 * 1. Pincode-Centric (4 endpoints)
 *    - pincode-to-h3, h3-to-pincode
 *    - pincode-to-digipin, digipin-to-pincode
 * 
 * 2. DIGIPIN-H3 Bridge (2 endpoints)
 *    - h3-to-digipin, digipin-to-h3
 * 
 * 3. Advanced/Bulk (4 endpoints)
 *    - bulk-pincode-to-h3, bulk-h3-to-pincode
 *    - spatial-intersection, polygon-search
 * 
 * Key Optimizations:
 * - Reuses existing H3→Pincode index in Redis
 * - Batch operations for bulk conversions
 * - Point containment checks only for boundary cases
 * - Aggressive caching for expensive operations
 * 
 * Dependencies:
 * - H3Module: H3 algorithm service
 * - DigipinModule: DIGIPIN algorithm service
 * - RedisModule: Persistent index + cache
 * - AuthModule: API key auth, rate limiting, usage tracking
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage, Pincode]),
    RedisModule,
    AuthModule,
    H3Module,
    DigipinModule,
  ],
  controllers: [ConversionController],
  providers: [ConversionService, ConversionAdvancedService],
  exports: [ConversionService, ConversionAdvancedService],
})
export class ConversionModule {}
