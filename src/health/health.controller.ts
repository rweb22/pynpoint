import { Controller, Get, Post, Headers, UnauthorizedException } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthService } from '../initialization/health.service';
import { RedisCacheService } from '../redis/redis-cache.service';
import { ConfigService } from '@nestjs/config';

/**
 * HealthController
 *
 * Provides health check endpoints for Railway, Kubernetes, and monitoring tools.
 *
 * Endpoints:
 * - GET /health - Overall system health (liveness + readiness)
 * - GET /health/live - Liveness probe (is the service running?)
 * - GET /health/ready - Readiness probe (is the service ready to accept traffic?)
 *
 * Railway uses /health for its health checks.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly healthService: HealthService,
    private readonly redisCache: RedisCacheService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Overall health check
   * Returns 200 OK if all checks pass, 503 Service Unavailable otherwise
   */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database connectivity
      () => this.db.pingCheck('database'),

      // Redis Cache connectivity
      async () => {
        try {
          await this.redisCache.ping();
          return { redisCache: { status: 'up' } };
        } catch (error) {
          return { redisCache: { status: 'down', error: error.message } };
        }
      },

      // System readiness (initialization complete)
      async () => {
        const isReady = this.healthService.isReady();
        return {
          initialization: {
            status: isReady ? 'up' : 'down',
            ready: isReady,
          },
        };
      },
    ]);
  }

  /**
   * Liveness probe
   * Checks if the service is alive and running
   */
  @Get('live')
  @HealthCheck()
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Readiness probe
   * Checks if the service is ready to accept traffic
   */
  @Get('ready')
  async readiness() {
    const isReady = this.healthService.isReady();
    
    if (!isReady) {
      return {
        status: 'not ready',
        message: 'System initialization in progress',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed status endpoint (optional - for monitoring dashboards)
   */
  @Get('status')
  async status() {
    try {
      // Measure latency for each service
      const dbStart = Date.now();
      const dbResult = await this.db.pingCheck('database');
      const dbLatency = Date.now() - dbStart;

      const redisCacheStart = Date.now();
      const redisCacheResult = await this.redisCache.ping();
      const redisCacheLatency = Date.now() - redisCacheStart;

      const isReady = this.healthService.isReady();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: {
            status: 'up',
            latency_ms: dbLatency,
          },
          redisCache: {
            status: 'up',
            latency_ms: redisCacheLatency,
          },
          initialization: isReady ? 'complete' : 'pending',
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * Clear Redis cache (admin-only)
   * Requires ADMIN_SECRET in Authorization header
   */
  @Post('clear-cache')
  async clearCache(@Headers('authorization') authHeader: string) {
    const adminSecret = this.configService.get<string>('ADMIN_SECRET');

    if (!authHeader || !adminSecret) {
      throw new UnauthorizedException('Missing authorization');
    }

    const token = authHeader.replace('Bearer ', '');
    if (token !== adminSecret) {
      throw new UnauthorizedException('Invalid admin secret');
    }

    try {
      await this.redisCache.clearAll();
      return {
        status: 'success',
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
