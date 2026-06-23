import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InitializationService } from './initialization.service';
import { DataIngestionService } from './data-ingestion.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { HealthService } from './health.service';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';
import { AdminModule } from '../admin/admin.module';

/**
 * InitializationModule
 *
 * Orchestrates the startup sequence for PinPoint India:
 * 1. Database migrations (automatic via TypeORM)
 * 2. Pincode boundary data ingestion from GeoJSON (conditional)
 * 3. CSV data ingestion: post offices + pincode metadata (conditional)
 *
 * Uses NestJS lifecycle hooks (OnApplicationBootstrap) to ensure
 * all data is ready before the application serves requests.
 *
 * Idempotent: Safe to run multiple times, only executes missing steps.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pincode, PostOffice]),
    AdminModule,
  ],
  providers: [
    InitializationService,
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
