import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pincode } from './entities/pincode.entity';

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
        entities: [Pincode],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
        logging: configService.get<string>('NODE_ENV') === 'development',
        // PostGIS extension is automatically detected
        // Connection pooling
        extra: {
          max: 10,
          min: 2,
          idleTimeoutMillis: 30000,
        },
      }),
    }),
    TypeOrmModule.forFeature([Pincode]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
