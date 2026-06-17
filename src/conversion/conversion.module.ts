import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { Pincode } from '../database/entities/pincode.entity';

// Old services/controllers (to be phased out)
import { ConversionService } from './services/conversion.service';
import { ConversionAdvancedService } from './services/conversion-advanced.service';
import { ConversionController } from './controllers/conversion.controller';

// New Stack-based services
import { PincodeH3Service } from './services/pincode-h3.service';
import { PincodeDigipinService } from './services/pincode-digipin.service';
import { H3DigipinService } from './services/h3-digipin.service';

// New Stack-based controllers
import { PincodeH3Controller } from './controllers/pincode-h3.controller';
import { PincodeDigipinController } from './controllers/pincode-digipin.controller';
import { H3DigipinController } from './controllers/h3-digipin.controller';

import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { H3Module } from '../h3/h3.module';
import { DigipinModule } from '../digipin/digipin.module';

/**
 * ConversionModule
 *
 * Track 4: Conversion Operations (3 Stacks)
 *
 * Provides bidirectional conversion between geocoding systems:
 *
 * Stack 1: Pincode ↔ H3 (4 endpoints)
 *    - GET /convert/pincode-to-h3/:pincode
 *    - GET /convert/h3-to-pincode/:h3Index
 *    - POST /convert/bulk/pincode-to-h3
 *    - POST /convert/bulk/h3-to-pincode
 *
 * Stack 2: Pincode ↔ DIGIPIN (4 endpoints)
 *    - GET /convert/pincode-to-digipin/:pincode
 *    - GET /convert/digipin-to-pincode/:digipinCode
 *    - POST /convert/bulk/pincode-to-digipin (NEW)
 *    - POST /convert/bulk/digipin-to-pincode (NEW)
 *
 * Stack 3: H3 ↔ DIGIPIN (4 endpoints)
 *    - GET /convert/h3-to-digipin/:h3Index (FIXED: returns ALL overlapping cells)
 *    - GET /convert/digipin-to-h3/:digipinCode (FIXED: returns ALL overlapping cells)
 *    - POST /convert/bulk/h3-to-digipin (NEW)
 *    - POST /convert/bulk/digipin-to-h3 (NEW)
 *
 * Architecture:
 * - Each stack has dedicated controller + service
 * - Stack 1 & 2: Use database (Pincode boundaries)
 * - Stack 3: Pure algorithmic (h3-digipin library)
 * - All stacks use Redis caching for expensive operations
 *
 * Dependencies:
 * - H3Module: H3 algorithm service
 * - DigipinModule: DIGIPIN algorithm service
 * - RedisModule: Persistent index + cache
 * - AuthModule: API key auth, rate limiting, usage tracking
 *
 * Migration Status:
 * - Old ConversionController: ACTIVE (keeping for backward compatibility)
 * - New Stack controllers: ACTIVE (skeleton only, implementations TODO)
 * - Will phase out old controller after migration complete
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiUsage, Pincode]),
    RedisModule,
    AuthModule,
    H3Module,
    DigipinModule,
  ],
  controllers: [
    // Old controller (keeping for backward compatibility during migration)
    ConversionController,

    // New stack-based controllers
    PincodeH3Controller,      // Stack 1: Pincode ↔ H3
    PincodeDigipinController, // Stack 2: Pincode ↔ DIGIPIN
    H3DigipinController,      // Stack 3: H3 ↔ DIGIPIN
  ],
  providers: [
    // Old services (keeping for backward compatibility during migration)
    ConversionService,
    ConversionAdvancedService,

    // New stack-based services
    PincodeH3Service,         // Stack 1: Pincode ↔ H3
    PincodeDigipinService,    // Stack 2: Pincode ↔ DIGIPIN
    H3DigipinService,         // Stack 3: H3 ↔ DIGIPIN
  ],
  exports: [
    // Export old services for now
    ConversionService,
    ConversionAdvancedService,

    // Export new services
    PincodeH3Service,
    PincodeDigipinService,
    H3DigipinService,
  ],
})
export class ConversionModule {}
