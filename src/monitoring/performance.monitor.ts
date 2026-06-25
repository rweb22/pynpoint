import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisCacheService } from '../redis/redis-cache.service';

/**
 * Performance Monitoring Service
 * 
 * Tracks system health metrics:
 * - Database connection pool usage
 * - Redis connection status
 * - Request rate and concurrency
 * - Memory and event loop lag
 * 
 * Logs warnings when approaching resource limits.
 */
@Injectable()
export class PerformanceMonitor {
  private readonly logger = new Logger(PerformanceMonitor.name);
  
  // Request tracking
  private activeRequests = 0;
  private totalRequests = 0;
  private requestsThisMinute = 0;
  private lastMinuteReset = Date.now();
  
  // Peak tracking
  private peakConcurrent = 0;
  private peakRPM = 0;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisCacheService: RedisCacheService,
  ) {}

  /**
   * Track request start
   */
  onRequestStart(): void {
    this.activeRequests++;
    this.totalRequests++;
    this.requestsThisMinute++;
    
    // Track peak concurrent
    if (this.activeRequests > this.peakConcurrent) {
      this.peakConcurrent = this.activeRequests;
    }
    
    // Reset minute counter
    const now = Date.now();
    if (now - this.lastMinuteReset >= 60000) {
      if (this.requestsThisMinute > this.peakRPM) {
        this.peakRPM = this.requestsThisMinute;
      }
      this.requestsThisMinute = 0;
      this.lastMinuteReset = now;
    }
  }

  /**
   * Track request end
   */
  onRequestEnd(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Get current request metrics
   */
  getRequestMetrics() {
    return {
      active: this.activeRequests,
      total: this.totalRequests,
      rpm: this.requestsThisMinute,
      peakConcurrent: this.peakConcurrent,
      peakRPM: this.peakRPM,
    };
  }

  /**
   * Log comprehensive system metrics every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async logMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherMetrics();
      this.analyzeAndLog(metrics);
    } catch (error) {
      this.logger.error(`Failed to gather metrics: ${error.message}`);
    }
  }

  /**
   * Gather all system metrics
   */
  private async gatherMetrics() {
    const [dbMetrics, redisMetrics, memoryMetrics] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getRedisMetrics(),
      this.getMemoryMetrics(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      requests: this.getRequestMetrics(),
      database: dbMetrics,
      redis: redisMetrics,
      memory: memoryMetrics,
      eventLoop: this.getEventLoopLag(),
    };
  }

  /**
   * Get database connection pool metrics
   */
  private async getDatabaseMetrics() {
    const pool = (this.dataSource.driver as any).master;
    
    // TypeORM doesn't expose pool stats directly, query PostgreSQL
    const result = await this.dataSource.query(`
      SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections
      FROM pg_stat_activity
      WHERE datname = current_database()
    `);

    const stats = result[0];
    
    return {
      totalConnections: parseInt(stats.total_connections),
      activeConnections: parseInt(stats.active_connections),
      idleConnections: parseInt(stats.idle_connections),
      maxConnections: 50, // From our config
      utilizationPercent: (parseInt(stats.total_connections) / 50) * 100,
    };
  }

  /**
   * Get Redis connection status
   */
  private async getRedisMetrics() {
    try {
      const client = this.redisCacheService.getClient();
      const info = await client.info('stats');
      const lines = info.split('\r\n');

      const metrics: any = {};
      lines.forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          metrics[key] = value;
        }
      });

      return {
        connected: client.status === 'ready',
        totalCommandsProcessed: parseInt(metrics.total_commands_processed) || 0,
        opsPerSec: parseInt(metrics.instantaneous_ops_per_sec) || 0,
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Get memory usage metrics
   */
  private getMemoryMetrics() {
    const usage = process.memoryUsage();
    
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB (Resident Set Size)
      external: Math.round(usage.external / 1024 / 1024), // MB
      heapUtilization: Math.round((usage.heapUsed / usage.heapTotal) * 100),
    };
  }

  /**
   * Measure event loop lag (indicator of blocking operations)
   */
  private getEventLoopLag(): number {
    // Simple event loop lag measurement
    const start = Date.now();
    setImmediate(() => {
      const lag = Date.now() - start;
      if (lag > 100) {
        this.logger.warn(`⚠️  High event loop lag detected: ${lag}ms`);
      }
    });
    return 0; // Actual measurement happens asynchronously
  }

  /**
   * Analyze metrics and log with appropriate severity
   */
  private analyzeAndLog(metrics: any): void {
    const warnings: string[] = [];
    
    // Check database pool utilization
    if (metrics.database.utilizationPercent > 80) {
      warnings.push(`DB pool at ${metrics.database.utilizationPercent.toFixed(1)}% capacity`);
    }
    
    // Check memory usage
    if (metrics.memory.heapUtilization > 85) {
      warnings.push(`Heap memory at ${metrics.memory.heapUtilization}% (${metrics.memory.heapUsed}MB/${metrics.memory.heapTotal}MB)`);
    }
    
    // Check RSS (Railway free tier has 512MB limit)
    if (metrics.memory.rss > 400) {
      warnings.push(`RSS memory at ${metrics.memory.rss}MB (Railway limit: 512MB)`);
    }
    
    // Check concurrent requests
    if (metrics.requests.active > 80) {
      warnings.push(`High concurrent requests: ${metrics.requests.active}`);
    }

    // Log with appropriate severity
    if (warnings.length > 0) {
      this.logger.warn(`\n⚠️  PERFORMANCE WARNING:\n${warnings.map(w => `  • ${w}`).join('\n')}\n`);
    }

    // Always log summary
    this.logger.log(
      `📊 Metrics | ` +
      `Requests: ${metrics.requests.active} active, ${metrics.requests.rpm} RPM (peak: ${metrics.requests.peakRPM}) | ` +
      `DB: ${metrics.database.activeConnections}/${metrics.database.maxConnections} active (${metrics.database.utilizationPercent.toFixed(0)}%) | ` +
      `Memory: ${metrics.memory.rss}MB RSS, ${metrics.memory.heapUsed}MB heap | ` +
      `Redis: ${metrics.redis.opsPerSec} ops/sec`
    );
  }
}
