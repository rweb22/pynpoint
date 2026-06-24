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
        // Connection pooling
        extra: {
          max: 10,
          min: 2,
          idleTimeoutMillis: 30000,
        },
      }),
    }),
    TypeOrmModule.forFeature([Pincode, PostOffice, ApiKey, ApiUsage]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
