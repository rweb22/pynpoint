import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

/**
 * HealthService
 *
 * Manages system health checks and readiness status.
 *
 * Responsibilities:
 * 1. Validate PostgreSQL connectivity and PostGIS extension
 * 2. Validate Redis connectivity
 * 3. Mark system as ready/not ready for serving requests
 * 4. Provide health check endpoints for Kubernetes/Docker
 *
 * Integrates with NestJS TerminusModule for health checks.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private isSystemReady = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Check if PostgreSQL is accessible and PostGIS is enabled
   */
  async checkPostGIS(): Promise<void> {
    this.logger.log('Checking PostgreSQL and PostGIS...');

    try {
      // Check database connection
      if (!this.dataSource.isInitialized) {
        await this.dataSource.initialize();
      }

      // Check PostGIS extension
      const result = await this.dataSource.query(
        'SELECT PostGIS_Version() as version',
      );

      if (!result || result.length === 0) {
        throw new Error('PostGIS extension not enabled');
      }

      this.logger.log(`✅ PostGIS version: ${result[0].version}`);
    } catch (error) {
      this.logger.error('PostgreSQL/PostGIS check failed:', error);
      throw new Error(
        'Database not ready. Ensure PostgreSQL is running with PostGIS extension enabled.',
      );
    }
  }

  /**
   * Check if Redis is accessible
   */
  async checkRedis(): Promise<void> {
    this.logger.log('Checking Redis...');

    try {
      const pong = await this.redisService.ping();

      if (pong !== 'PONG') {
        throw new Error('Redis ping failed');
      }

      this.logger.log('✅ Redis responding');
    } catch (error) {
      this.logger.error('Redis check failed:', error);
      throw new Error('Redis not ready. Ensure Redis is running.');
    }
  }

  /**
   * Mark system as ready to serve requests
   */
  async markReady(): Promise<void> {
    this.isSystemReady = true;
    this.logger.log('✅ System marked as READY');
  }

  /**
   * Mark system as not ready
   */
  markNotReady(): void {
    this.isSystemReady = false;
    this.logger.warn('⚠️  System marked as NOT READY');
  }

  /**
   * Get system readiness status
   */
  isReady(): boolean {
    return this.isSystemReady;
  }

  /**
   * Kubernetes/Docker liveness probe
   * Returns true if the application is alive (not crashed)
   */
  isAlive(): boolean {
    // Application is alive if it can execute this code
    return true;
  }

  /**
   * Kubernetes/Docker readiness probe
   * Returns true if the application is ready to serve requests
   */
  async getReadinessStatus(): Promise<{
    ready: boolean;
    postgresReady: boolean;
    redisReady: boolean;
    dataIngested: boolean;
    h3IndexBuilt: boolean;
  }> {
    let postgresReady = false;
    let redisReady = false;
    let dataIngested = false;
    let h3IndexBuilt = false;

    try {
      await this.checkPostGIS();
      postgresReady = true;
    } catch (error) {
      this.logger.debug('PostgreSQL not ready:', error.message);
    }

    try {
      await this.checkRedis();
      redisReady = true;
    } catch (error) {
      this.logger.debug('Redis not ready:', error.message);
    }

    // TODO: Add actual checks for data and index
    // dataIngested = await this.dataIngestionService.checkDataExists();
    // h3IndexBuilt = await this.h3IndexService.checkIndexExists();

    const ready =
      this.isSystemReady &&
      postgresReady &&
      redisReady &&
      dataIngested &&
      h3IndexBuilt;

    return {
      ready,
      postgresReady,
      redisReady,
      dataIngested,
      h3IndexBuilt,
    };
  }
}
