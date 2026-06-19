import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { H3AccuracyValidatorService } from './h3-accuracy-validator.service';
import { ExternalValidatorService } from './external-validator.service';
import { VerificationController } from './verification.controller';
import { Pincode } from '../entities/pincode.entity';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pincode]),
    RedisModule,
    AuthModule,
  ],
  controllers: [VerificationController],
  providers: [H3AccuracyValidatorService, ExternalValidatorService],
  exports: [H3AccuracyValidatorService, ExternalValidatorService],
})
export class VerificationModule {}
