import { Controller, Post, Body, UseGuards, UseInterceptors, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiBody } from '@nestjs/swagger';
import { DistanceService } from '../services/distance.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { TokenBucketRateLimitInterceptor } from '../../auth/interceptors/token-bucket-rate-limit.interceptor';
import { StreamUsageTrackingInterceptor } from '../../auth/interceptors/stream-usage-tracking.interceptor';
import { ApiRateLimitHeaders } from '../../common/decorators/api-rate-limit-headers.decorator';
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
@ApiRateLimitHeaders()
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
  @ApiBody({
    type: CalculateDistanceDto,
    examples: {
      'pincode-to-pincode': {
        summary: 'Delhi to Mumbai (pincodes)',
        value: {
          from: { pincode: '110001' },
          to: { pincode: '400001' },
          unit: 'km'
        }
      },
      'mixed-types': {
        summary: 'DIGIPIN to coordinates',
        value: {
          from: { digipin: 'C4P8K63M' },
          to: { coordinate: { lat: 19.0760, lng: 72.8777 } },
          unit: 'km'
        }
      },
      'coordinates': {
        summary: 'Between two GPS coordinates',
        value: {
          from: { coordinate: { lat: 28.6139, lng: 77.2090 } },
          to: { coordinate: { lat: 13.0827, lng: 80.2707 } },
          unit: 'mi'
        }
      }
    }
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
  @ApiBody({
    type: BatchDistanceDto,
    examples: {
      'multiple-routes': {
        summary: 'Calculate multiple routes',
        value: {
          pairs: [
            { from: { pincode: '110001' }, to: { pincode: '400001' } },
            { from: { pincode: '110001' }, to: { pincode: '560001' } },
            { from: { pincode: '110001' }, to: { pincode: '700001' } }
          ],
          unit: 'km'
        }
      }
    }
  })
  async batchDistance(@Body() dto: BatchDistanceDto): Promise<BatchDistanceResponse> {
    this.logger.log(`POST /distance/batch (${dto.pairs.length} pairs)`);
    return this.distanceService.batchDistance(dto);
  }
}
