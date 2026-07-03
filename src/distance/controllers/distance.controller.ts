import { Controller, Post, Body, UseGuards, UseInterceptors, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { DistanceService } from '../services/distance.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { TokenBucketRateLimitInterceptor } from '../../auth/interceptors/token-bucket-rate-limit.interceptor';
import { StreamUsageTrackingInterceptor } from '../../auth/interceptors/stream-usage-tracking.interceptor';
import {
  CalculateDistanceDto,
  BatchDistanceDto,
} from '../dto/distance-request.dto';
import {
  DistanceCalculationResponse,
  BatchDistanceResponse,
} from '../dto/distance-response.dto';

@Controller({ path: 'distance', version: '1' })
@ApiTags('distance')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@UseInterceptors(TokenBucketRateLimitInterceptor, StreamUsageTrackingInterceptor)
export class DistanceController {
  private readonly logger = new Logger(DistanceController.name);

  constructor(private readonly distanceService: DistanceService) {}

  /**
   * POST /distance/calculate
   * Universal distance calculator
   */
  @Post('calculate')
  @ApiOperation({
    summary: 'Calculate distance between two locations',
    description: 'Calculate distance between any two locations (PINCODE, DIGIPIN, or coordinates) with delivery time estimates.',
  })
  @ApiResponse({ status: 200, description: 'Distance calculated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid location data' })
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
