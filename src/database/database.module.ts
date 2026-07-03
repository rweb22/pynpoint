import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pincode } from './entities/pincode.entity';
import { PostOffice } from './entities/postoffice.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiUsage } from './entities/api-usage.entity';
import { MarketplaceConfig } from './entities/marketplace-config.entity';

/**
 * DatabaseModule
 * 
 * Configures TypeORM connection to PostgreSQL with PostGIS extension.
 * 
 * Features:
 * - PostgreSQL with PostGIS for spatial queries
 * - Automatic schema synchronization (development only)
 * - Connection pooling
 * - Entity auto-loading
 * 
 * Environment variables required:
 * - DATABASE_URL: postgresql://user:pass@host:port/database
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [Pincode, PostOffice, ApiKey, ApiUsage, MarketplaceConfig],
        migrations: ['dist/src/database/migrations/*.js'],
        migrationsTableName: 'migrations',
        migrationsRun: true, // Auto-run migrations on startup
        synchronize: false, // Always false - use migrations instead
        logging: ['error', 'warn', 'migration'], // Always log migrations and errors
        // PostGIS extension is automatically detected
        // Connection pooling (optimized for concurrent load)
        extra: {
          max: parseInt(process.env.DB_POOL_MAX || '100', 10),  // Support 100-500 concurrent connections (default: 100)
          min: parseInt(process.env.DB_POOL_MIN || '10', 10),   // Keep 10 connections warm for fast response
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 20000,  // Increased to 20s to handle high load spikes
          acquireTimeoutMillis: 20000,     // Increased to 20s to handle high load spikes
        },
      }),
    }),
    TypeOrmModule.forFeature([Pincode, PostOffice, ApiKey, ApiUsage, MarketplaceConfig]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
