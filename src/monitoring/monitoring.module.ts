import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PerformanceMonitor } from './performance.monitor';
import { RedisModule } from '../redis/redis.module';

/**
 * Monitoring Module
 * 
 * Provides performance monitoring and health metrics
 */
@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    RedisModule,
  ],
  providers: [PerformanceMonitor],
  exports: [PerformanceMonitor],
})
export class MonitoringModule {}
