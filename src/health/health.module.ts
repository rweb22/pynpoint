import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { InitializationModule } from '../initialization/initialization.module';

/**
 * HealthModule
 * 
 * Provides health check endpoints using NestJS Terminus.
 * 
 * Integrates with:
 * - Railway health checks
 * - Kubernetes liveness/readiness probes
 * - Monitoring tools (Datadog, New Relic, etc.)
 */
@Module({
  imports: [
    TerminusModule,
    InitializationModule, // For HealthService
  ],
  controllers: [HealthController],
})
export class HealthModule {}
