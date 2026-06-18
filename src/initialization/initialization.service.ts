import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataIngestionService } from './data-ingestion.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { H3IndexService } from './h3-index.service';
import { HealthService } from './health.service';
import { DatabaseCapabilityService } from '../admin/services/database-capability.service';
import { RedisStatusService } from '../admin/services/redis-status.service';

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
 * Phases:
 * 1. Database validation (PostGIS)
 * 2. Pincode boundary ingestion (GeoJSON - 19,312 pincodes with boundaries)
 * 3. CSV data ingestion (165,627 post offices + pincode metadata updates)
 * 4. H3 spatial index build (32M+ hexagons)
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
    private readonly dataIngestionService: DataIngestionService,
    private readonly csvIngestionService: CSVIngestionService,
    private readonly h3IndexService: H3IndexService,
    private readonly healthService: HealthService,
    private readonly databaseCapability: DatabaseCapabilityService,
    private readonly redisStatus: RedisStatusService,
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
      // Phase 0: System capability assessment (for H3 migration planning)
      this.logger.log('Phase 0: Assessing system capabilities...');
      await this.databaseCapability.logCapabilitiesOnStartup();
      await this.redisStatus.logStatusOnStartup();

      // Phase 1: Validate database connectivity and PostGIS extension
      this.logger.log('Phase 1: Validating database...');
      await this.healthService.checkPostGIS();
      this.logger.log('✅ Database validated (PostGIS enabled)');

      // Phase 2: Ensure pincode boundary data exists (GeoJSON)
      this.logger.log('Phase 2: Checking pincode boundary data...');
      const dataExists = await this.dataIngestionService.checkDataExists();

      if (!dataExists) {
        if (isProduction) {
          // Production: Fail fast - data should be pre-loaded
          this.logger.error(
            '❌ Pincode boundary data not found. In production, data must be pre-loaded.',
          );
          this.logger.error(
            'Run: npm run cli init -- before starting the application.',
          );
          process.exit(1);
        } else {
          // Development: Auto-download and ingest
          this.logger.log('Pincode boundary data not found, starting ingestion...');
          await this.dataIngestionService.ingestData();
          this.logger.log('✅ Pincode boundary data ingested');
        }
      } else {
        this.logger.log('✅ Pincode boundary data already exists');
      }

      // Phase 3: Ensure CSV data exists (post offices + pincode metadata)
      this.logger.log('Phase 3: Checking CSV data (post offices)...');
      const csvDataExists = await this.csvIngestionService.checkCSVDataExists();

      if (!csvDataExists) {
        if (isProduction) {
          // Production: Fail fast - data should be pre-loaded
          this.logger.error(
            '❌ CSV data not found. In production, data must be pre-loaded.',
          );
          this.logger.error(
            'Run: npm run cli init -- before starting the application.',
          );
          process.exit(1);
        } else {
          // Development: Auto-download and ingest
          this.logger.log('CSV data not found, starting download and ingestion...');
          await this.csvIngestionService.ingestCSVData();
          this.logger.log('✅ CSV data ingested');
        }
      } else {
        this.logger.log('✅ CSV data already exists');
      }

      // Phase 4: Ensure H3 spatial index exists
      this.logger.log('Phase 4: Checking H3 spatial index...');
      const forceRebuildH3 = process.env.FORCE_REBUILD_H3_INDEX === 'true';
      const indexExists = await this.h3IndexService.checkIndexExists();

      if (forceRebuildH3) {
        // Force rebuild requested - rebuild even if index exists
        this.logger.log('Force rebuild requested, rebuilding H3 index...');
        await this.h3IndexService.buildIndex(true);
        this.logger.log('✅ H3 index rebuilt');
      } else if (!indexExists) {
        if (isProduction) {
          // Production: Fail fast - index should be pre-built
          this.logger.error(
            '❌ H3 index not found. In production, index must be pre-built.',
          );
          this.logger.error(
            'Run: npm run cli init -- before starting the application.',
          );
          process.exit(1);
        } else {
          // Development: Auto-build index
          this.logger.log('H3 index not found, starting build...');
          await this.h3IndexService.buildIndex();
          this.logger.log('✅ H3 index built');
        }
      } else {
        this.logger.log('✅ H3 index already exists');
      }

      // Phase 5: Mark system as ready
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
    forceRebuild?: boolean;
  }): Promise<void> {
    this.logger.log('🔄 Force re-initialization requested...');

    if (options?.forceReingest) {
      this.logger.log('Force re-ingesting pincode data...');
      await this.dataIngestionService.ingestData(true);
    }

    if (options?.forceRebuild) {
      this.logger.log('Force rebuilding H3 index...');
      await this.h3IndexService.buildIndex(true);
    }

    await this.healthService.markReady();
    this.logger.log('✅ Force re-initialization complete');
  }
}
