import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MigrationController } from './controllers/migration.controller';
import { DatabaseCapabilityService } from './services/database-capability.service';
import { RedisStatusService } from './services/redis-status.service';
import { Pincode } from '../database/entities/pincode.entity';
import { RedisModule } from '../redis/redis.module';

/**
 * AdminModule
 * 
 * Provides administrative endpoints and services for:
 * - Migration assessment
 * - Database capability checking
 * - Redis status monitoring
 * - System diagnostics
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Pincode]),
    RedisModule,
  ],
  controllers: [
    MigrationController,
  ],
  providers: [
    DatabaseCapabilityService,
    RedisStatusService,
  ],
  exports: [
    DatabaseCapabilityService,
    RedisStatusService,
  ],
})
export class AdminModule {}
