import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { InitializationModule } from './initialization/initialization.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PincodeModule } from './pincode/pincode.module';
import { DigipinModule } from './digipin/digipin.module';
import { H3Module } from './h3/h3.module';
import { ConversionModule } from './conversion/conversion.module';
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
 *    - Builds H3 spatial index if missing
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

    // Database & Cache
    DatabaseModule,
    RedisModule,

    // Authentication
    AuthModule,

    // API Endpoints
    PincodeModule,     // Track 1: Pincode Solo Operations
    DigipinModule,     // Track 2: DIGIPIN Solo Operations
    H3Module,          // Track 3: H3 Solo Operations
    ConversionModule,  // Track 4: Hybrid & Conversion Operations

    // Initialization
    InitializationModule,

    // Health Checks
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
