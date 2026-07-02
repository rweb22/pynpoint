import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { InitializationModule } from './initialization/initialization.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PincodeModule } from './pincode/pincode.module';
import { DigipinModule } from './digipin/digipin.module';
import { DistanceModule } from './distance/distance.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { RequestTrackingInterceptor } from './monitoring/request-tracking.interceptor';
import { MarketplaceProxyGuard } from './auth/guards/marketplace-proxy.guard';
import { ApiKeyGuard } from './auth/guards/api-key.guard';
import configuration from './config/configuration';

/**
 * AppModule - Root module for PinPoint India
 *
 * Initialization Flow:
 * 1. ConfigModule loads environment variables
 * 2. DatabaseModule connects to PostgreSQL (with PostGIS)
 * 3. RedisModule connects to Redis
 * 4. InitializationModule runs startup sequence (OnApplicationBootstrap):
 *    - Validates PostGIS extension
 *    - Ingests pincode data if missing
 * 5. HealthModule provides /health endpoints for Railway and monitoring
 * 6. HTTP server starts listening (only after initialization completes)
 */
@Module({
  imports: [
    // Configuration (global)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Common services (global)
    CommonModule,

    // Database & Cache
    DatabaseModule,
    RedisModule,

    // Monitoring (global)
    MonitoringModule,

    // Authentication
    AuthModule,

    // API Endpoints
    PincodeModule,     // Track 1: Pincode Solo Operations
    DigipinModule,     // Track 2: DIGIPIN Solo Operations
    DistanceModule,    // Track 3: Distance & Measurement Operations

    // Initialization
    InitializationModule,

    // Health Checks
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global guards (run in order: marketplace first, then API key)
    {
      provide: APP_GUARD,
      useClass: MarketplaceProxyGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    // Global request tracking interceptor
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTrackingInterceptor,
    },
  ],
})
export class AppModule {}
