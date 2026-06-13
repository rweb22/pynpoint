import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthService } from '../initialization/health.service';
import { RedisService } from '../redis/redis.service';

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
    private readonly redisService: RedisService,
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
      
      // Redis connectivity
      async () => {
        try {
          await this.redisService.ping();
          return { redis: { status: 'up' } };
        } catch (error) {
          return { redis: { status: 'down', error: error.message } };
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
      const [dbStatus, redisStatus, initStatus] = await Promise.allSettled([
        this.db.pingCheck('database'),
        this.redisService.ping(),
        this.healthService.isReady(),
      ]);

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: dbStatus.status === 'fulfilled' ? 'up' : 'down',
          redis: redisStatus.status === 'fulfilled' ? 'up' : 'down',
          initialization: initStatus.status === 'fulfilled' && initStatus.value ? 'complete' : 'pending',
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
}
