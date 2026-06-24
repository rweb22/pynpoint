import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { OfficialJSONIngestionService } from './official-json-ingestion.service';
import { DataIngestionService } from './data-ingestion.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { HealthService } from './health.service';

/**
 * InitializationService
 * 
 * Main orchestrator for application startup sequence.
 * Implements OnApplicationBootstrap - runs AFTER all modules are initialized
 * but BEFORE the server starts accepting requests.
 * 
 * Equivalent to Spring Boot's ApplicationRunner / CommandLineRunner.
 * 
 * Execution order:
 * 1. Module construction
 * 2. Dependency injection
 * 3. onModuleInit() [not used here]
 * 4. onApplicationBootstrap() ← THIS RUNS HERE
 * 5. Server starts listening
 *
 * NEW STRATEGY (2025-06):
 * Phases:
 * 1. Database validation (PostGIS)
 * 2. Official JSON ingestion (data.gov.in - 19,586 pincodes + 165,627 postoffices)
 * 3. GeoJSON boundary enrichment (updates ~19,312 pincodes with spatial data)
 *
 * Key change: JSON data first (correct state/district), then GeoJSON enrichment
 *
 * Behavior modes (controlled by environment variables):
 * - Production: Validate data exists, fail fast if missing
 * - Development: Auto-download and build if missing
 * - Testing: Skip initialization entirely
 */
@Injectable()
export class InitializationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitializationService.name);

  constructor(
    private readonly officialJSONIngestionService: OfficialJSONIngestionService,
    private readonly dataIngestionService: DataIngestionService,
    private readonly csvIngestionService: CSVIngestionService,
    private readonly healthService: HealthService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const skipInit = process.env.SKIP_INITIALIZATION === 'true';
    const isProduction = process.env.NODE_ENV === 'production';

    if (skipInit) {
      this.logger.warn('⚠️  Initialization skipped (SKIP_INITIALIZATION=true)');
      return;
    }

    this.logger.log('🚀 Starting PinPoint India initialization...');
    const startTime = Date.now();

    try {
      // Phase 1: Validate database connectivity and PostGIS extension
      this.logger.log('Phase 1: Validating database...');
      await this.healthService.checkPostGIS();
      this.logger.log('✅ Database validated (PostGIS enabled)');

      // Phase 2: Ensure official JSON data exists (pincodes + postoffices)
      this.logger.log('Phase 2: Checking official JSON data (data.gov.in)...');
      const jsonDataExists = await this.officialJSONIngestionService.checkDataExists();

      if (!jsonDataExists) {
        if (isProduction) {
          // Production: Fail fast - data should be pre-loaded
          this.logger.error(
            '❌ Official JSON data not found. In production, data must be pre-loaded.',
          );
          this.logger.error(
            'Run: npm run cli init -- before starting the application.',
          );
          process.exit(1);
        } else {
          // Development: Auto-download and ingest
          this.logger.log('Official JSON data not found, starting download and ingestion...');
          await this.officialJSONIngestionService.ingestData();
          this.logger.log('✅ Official JSON data ingested');
        }
      } else {
        this.logger.log('✅ Official JSON data already exists');
      }

      // Phase 3: Enrich pincodes with GeoJSON boundary data (optional)
      this.logger.log('Phase 3: Checking GeoJSON boundary enrichment...');
      const boundaryCount = await this.dataIngestionService.checkBoundaryCount();

      if (boundaryCount === 0) {
        if (isProduction) {
          // Production: Warn but don't fail - boundaries are optional
          this.logger.warn(
            '⚠️  No pincode boundaries found. Spatial queries will be limited.',
          );
          this.logger.warn(
            'Consider running: npm run cli enrich-boundaries',
          );
        } else {
          // Development: Auto-enrich from GeoJSON
          this.logger.log('No boundaries found, enriching from GeoJSON...');
          await this.dataIngestionService.enrichBoundaries();
          this.logger.log('✅ Boundary enrichment complete');
        }
      } else {
        this.logger.log(`✅ Found ${boundaryCount.toLocaleString()} pincodes with boundaries`);
      }

      // Phase 4: Mark system as ready
      await this.healthService.markReady();

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.logger.log(`✅ System initialization complete (${duration}s)`);
    } catch (error) {
      this.logger.error('❌ System initialization failed:', error.stack);

      if (isProduction) {
        // Production: Fail fast
        process.exit(1);
      } else {
        // Development: Log but allow startup for debugging
        this.logger.warn(
          '⚠️  Continuing in development mode despite errors...',
        );
      }
    }
  }

  /**
   * Force re-initialization (useful for admin endpoints or CLI commands)
   */
  async forceReinitialize(options?: {
    forceReingest?: boolean;
  }): Promise<void> {
    this.logger.log('🔄 Force re-initialization requested...');

    if (options?.forceReingest) {
      this.logger.log('Force re-ingesting official JSON data...');
      await this.officialJSONIngestionService.ingestData(true);

      this.logger.log('Force enriching boundaries from GeoJSON...');
      await this.dataIngestionService.enrichBoundaries(true);
    }

    await this.healthService.markReady();
    this.logger.log('✅ Force re-initialization complete');
  }
}
