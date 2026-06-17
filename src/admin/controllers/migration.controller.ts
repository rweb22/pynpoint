import { Controller, Get, Logger } from '@nestjs/common';
import { DatabaseCapabilityService } from '../services/database-capability.service';
import { RedisStatusService } from '../services/redis-status.service';

/**
 * MigrationController
 * 
 * Admin endpoints for H3 PostGIS migration assessment
 * 
 * These endpoints help determine the implementation approach for
 * migrating from buffer-based to PostGIS-based H3 index generation.
 */
@Controller('admin/migration')
export class MigrationController {
  private readonly logger = new Logger(MigrationController.name);

  constructor(
    private readonly databaseCapability: DatabaseCapabilityService,
    private readonly redisStatus: RedisStatusService,
  ) {}

  /**
   * Check PostgreSQL and PostGIS capabilities
   * 
   * Returns detailed information about:
   * - PostgreSQL version
   * - PostGIS installation and version
   * - H3 extension availability
   * - Database statistics
   * - Recommendation for migration approach
   */
  @Get('check-database')
  async checkDatabase() {
    this.logger.log('Checking database capabilities...');
    return await this.databaseCapability.checkCapabilities();
  }

  /**
   * Check Redis status and H3 index statistics
   * 
   * Returns detailed information about:
   * - Redis server version and uptime
   * - Memory usage
   * - Persistence configuration
   * - H3 index statistics (key count, metadata)
   * - Sample H3 index data
   */
  @Get('check-redis')
  async checkRedis() {
    this.logger.log('Checking Redis status...');
    return await this.redisStatus.checkStatus();
  }

  /**
   * Get complete migration assessment
   * 
   * Combines database and Redis checks to provide a complete
   * picture of current state and recommended migration approach.
   */
  @Get('assessment')
  async getAssessment() {
    this.logger.log('Running complete migration assessment...');
    
    const [database, redis] = await Promise.all([
      this.databaseCapability.checkCapabilities(),
      this.redisStatus.checkStatus(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      database,
      redis,
      migrationReady: this.assessMigrationReadiness(database, redis),
    };
  }

  /**
   * Assess if system is ready for migration
   */
  private assessMigrationReadiness(database: any, redis: any): any {
    const checks = {
      postgisInstalled: database.postgis?.installed || false,
      postgisWorks: database.postgis?.functionsWork || false,
      h3Available: database.h3Extension?.functionCount > 0 || false,
      h3Works: database.h3Extension?.functionsWork || false,
      redisWorking: !redis.server?.error,
      h3IndexExists: redis.h3Index?.metadata?.lastBuilt !== null,
      spatialIndexExists: database.pincodes?.hasSpatialIndex || false,
    };

    const warnings: string[] = [];
    const blockers: string[] = [];

    // Check for blockers
    if (!checks.postgisInstalled) {
      blockers.push('PostGIS is not installed');
    }
    if (!checks.postgisWorks) {
      blockers.push('PostGIS functions are not working');
    }
    if (!checks.redisWorking) {
      blockers.push('Redis is not accessible');
    }

    // Check for warnings
    if (!checks.spatialIndexExists) {
      warnings.push('No spatial index on pincodes table (should create GIST index)');
    }
    if (!checks.h3IndexExists) {
      warnings.push('No existing H3 index found in Redis');
    }

    // Determine implementation approach
    let implementationApproach = 'unknown';
    if (checks.h3Available && checks.h3Works) {
      implementationApproach = 'native-h3-extension';
    } else if (checks.postgisWorks) {
      implementationApproach = 'hybrid-javascript-postgis';
    }

    return {
      ready: blockers.length === 0,
      checks,
      warnings,
      blockers,
      implementationApproach,
      recommendation: this.generateMigrationRecommendation(
        blockers,
        warnings,
        implementationApproach
      ),
    };
  }

  /**
   * Generate migration recommendation
   */
  private generateMigrationRecommendation(
    blockers: string[],
    warnings: string[],
    approach: string
  ): string {
    if (blockers.length > 0) {
      return `BLOCKED: Fix the following issues before proceeding: ${blockers.join(', ')}`;
    }

    if (approach === 'native-h3-extension') {
      return 'READY: Use native H3 extension approach (fastest, recommended)';
    }

    if (approach === 'hybrid-javascript-postgis') {
      return 'READY: Use hybrid JavaScript + PostGIS approach (accurate, slightly slower build)';
    }

    return 'WARNING: Unable to determine best approach. Review assessment details.';
  }

  /**
   * Count actual H3 keys in Redis
   *
   * Performs a complete SCAN of Redis to count all h3:* keys.
   * This may take 10-30 seconds depending on the number of keys.
   *
   * Use this to get the actual count vs the estimated count from the assessment.
   */
  @Get('count-h3-keys')
  async countH3Keys() {
    this.logger.log('Counting actual H3 keys in Redis (this may take 10-30 seconds)...');

    const startTime = Date.now();
    const result = await this.redisStatus.countAllH3Keys();
    const duration = Date.now() - startTime;

    return {
      timestamp: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(2)}s`,
      ...result,
    };
  }
}
