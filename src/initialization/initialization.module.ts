import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InitializationService } from './initialization.service';
import { DataIngestionService } from './data-ingestion.service';
import { H3IndexService } from './h3-index.service';
import { HealthService } from './health.service';
import { Pincode } from '../database/entities/pincode.entity';

/**
 * InitializationModule
 *
 * Orchestrates the startup sequence for PinPoint India:
 * 1. Database migrations (automatic via TypeORM)
 * 2. Pincode data ingestion (conditional)
 * 3. H3 spatial index build (conditional)
 *
 * Uses NestJS lifecycle hooks (OnApplicationBootstrap) to ensure
 * all data is ready before the application serves requests.
 *
 * Idempotent: Safe to run multiple times, only executes missing steps.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Pincode])],
  providers: [
    InitializationService,
    DataIngestionService,
    H3IndexService,
    HealthService,
  ],
  exports: [
    InitializationService,
    HealthService,
  ],
})
export class InitializationModule {}
