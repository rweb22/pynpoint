import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pincode } from './entities/pincode.entity';
import { PostOffice } from './entities/postoffice.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiUsage } from './entities/api-usage.entity';

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
        entities: [Pincode, PostOffice, ApiKey, ApiUsage],
        migrations: ['dist/src/database/migrations/*.js'],
        migrationsTableName: 'migrations',
        migrationsRun: true, // Auto-run migrations on startup
        synchronize: false, // Always false - use migrations instead
        logging: ['error', 'warn', 'migration'], // Always log migrations and errors
        // PostGIS extension is automatically detected
        // Connection pooling (optimized for concurrent load)
        extra: {
          max: 50,  // Increased from 10 to handle 100+ concurrent requests
          min: 5,   // Increased from 2 to keep more connections ready
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,  // Timeout for getting connection from pool
          acquireTimeoutMillis: 10000,     // Timeout for acquiring connection
        },
      }),
    }),
    TypeOrmModule.forFeature([Pincode, PostOffice, ApiKey, ApiUsage]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
