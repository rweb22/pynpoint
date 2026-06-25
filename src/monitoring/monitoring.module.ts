import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PerformanceMonitor } from './performance.monitor';

/**
 * Monitoring Module
 *
 * Provides performance monitoring and health metrics
 *
 * Note: RedisModule is @Global so RedisCacheService is automatically available
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
  ],
  providers: [PerformanceMonitor],
  exports: [PerformanceMonitor],
})
export class MonitoringModule {}
