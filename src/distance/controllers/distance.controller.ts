import { Controller, Post, Body, UseGuards, UseInterceptors, Logger } from '@nestjs/common';
import { DistanceService } from '../services/distance.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { RateLimitInterceptor } from '../../auth/interceptors/rate-limit.interceptor';
import { UsageTrackingInterceptor } from '../../auth/interceptors/usage-tracking.interceptor';
import {
  CalculateDistanceDto,
  BatchDistanceDto,
} from '../dto/distance-request.dto';
import {
  DistanceCalculationResponse,
  BatchDistanceResponse,
} from '../dto/distance-response.dto';

@Controller('api/v1/distance')
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class DistanceController {
  private readonly logger = new Logger(DistanceController.name);

  constructor(private readonly distanceService: DistanceService) {}

  /**
   * POST /distance/calculate
   * Universal distance calculator
   */
  @Post('calculate')
  async calculateDistance(@Body() dto: CalculateDistanceDto): Promise<DistanceCalculationResponse> {
    this.logger.log(`POST /distance/calculate`);
    return this.distanceService.calculateDistance(dto);
  }

  /**
   * POST /distance/batch
   * Calculate distances for multiple location pairs
   */
  @Post('batch')
  async batchDistance(@Body() dto: BatchDistanceDto): Promise<BatchDistanceResponse> {
    this.logger.log(`POST /distance/batch (${dto.pairs.length} pairs)`);
    return this.distanceService.batchDistance(dto);
  }
}
