import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InitializationService } from './initialization.service';
import { DataIngestionService } from './data-ingestion.service';
import { OfficialJSONIngestionService } from './official-json-ingestion.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { HealthService } from './health.service';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';

/**
 * InitializationModule
 *
 * Orchestrates the startup sequence for PinPoint India:
 * 1. Database migrations (automatic via TypeORM)
 * 2. Official JSON ingestion: pincodes + postoffices from data.gov.in (Phase 2)
 * 3. GeoJSON boundary enrichment: update pincodes with spatial data (Phase 3)
 *
 * NEW STRATEGY (2025-06):
 * - Phase 2: Official JSON first (creates pincodes with correct state/district)
 * - Phase 3: GeoJSON enrichment (updates boundaries on existing pincodes)
 *
 * Uses NestJS lifecycle hooks (OnApplicationBootstrap) to ensure
 * all data is ready before the application serves requests.
 *
 * Idempotent: Safe to run multiple times, only executes missing steps.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pincode, PostOffice]),
  ],
  providers: [
    InitializationService,
    OfficialJSONIngestionService,
    DataIngestionService,
    CSVIngestionService,
    HealthService,
  ],
  exports: [
    InitializationService,
    HealthService,
  ],
})
export class InitializationModule {}
