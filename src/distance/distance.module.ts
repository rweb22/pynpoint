import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistanceController } from './controllers/distance.controller';
import { DistanceService } from './services/distance.service';
import { Pincode } from '../database/entities/pincode.entity';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { DigipinAlgorithmService } from '../digipin/services/digipin-algorithm.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pincode, ApiUsage]),
    AuthModule,
    RedisModule,
  ],
  controllers: [DistanceController],
  providers: [
    DistanceService,
    DigipinAlgorithmService,
  ],
  exports: [DistanceService],
})
export class DistanceModule {}
