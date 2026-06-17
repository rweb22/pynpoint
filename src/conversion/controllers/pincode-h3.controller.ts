import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { RateLimitInterceptor } from '../../auth/interceptors/rate-limit.interceptor';
import { UsageTrackingInterceptor } from '../../auth/interceptors/usage-tracking.interceptor';
import { PincodeH3Service } from '../services/pincode-h3.service';
import {
  PincodeToH3QueryDto,
  H3ToPincodeQueryDto,
  BulkPincodeToH3Dto,
  BulkH3ToPincodeDto,
  PincodeToH3Response,
  H3ToPincodeResponse,
  BulkPincodeToH3Response,
  BulkH3ToPincodeResponse,
} from '../dto/pincode-h3.dto';

/**
 * PincodeH3Controller
 * 
 * Stack 1: Pincode ↔ H3 Conversion Operations
 * 
 * 4 endpoints for bidirectional conversion between Pincodes and H3 hexagons:
 * 
 * Single Operations:
 * - GET /convert/pincode-to-h3/:pincode - Pincode → H3 cells
 * - GET /convert/h3-to-pincode/:h3Index - H3 cell → Pincodes
 * 
 * Bulk Operations:
 * - POST /convert/bulk/pincode-to-h3 - Bulk Pincode → H3 (up to 50)
 * - POST /convert/bulk/h3-to-pincode - Bulk H3 → Pincodes (up to 100)
 */
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class PincodeH3Controller {
  private readonly logger = new Logger(PincodeH3Controller.name);

  constructor(private readonly pincodeH3Service: PincodeH3Service) {}

  /**
   * 1.1: GET /convert/pincode-to-h3/:pincode
   * Convert pincode to all intersecting H3 cells
   */
  @Get('convert/pincode-to-h3/:pincode')
  async pincodeToH3(
    @Param('pincode') pincode: string,
    @Query() query: PincodeToH3QueryDto,
  ): Promise<PincodeToH3Response> {
    this.logger.log(`GET /convert/pincode-to-h3/${pincode}?resolution=${query.resolution}`);
    return this.pincodeH3Service.pincodeToH3(pincode, query.resolution);
  }

  /**
   * 1.2: GET /convert/h3-to-pincode/:h3Index
   * Convert H3 cell to all intersecting pincodes
   */
  @Get('convert/h3-to-pincode/:h3Index')
  async h3ToPincode(
    @Param('h3Index') h3Index: string,
    @Query() query: H3ToPincodeQueryDto,
  ): Promise<H3ToPincodeResponse> {
    this.logger.log(`GET /convert/h3-to-pincode/${h3Index}`);
    return this.pincodeH3Service.h3ToPincode(h3Index);
  }

  /**
   * 1.3: POST /convert/bulk/pincode-to-h3
   * Bulk convert pincodes to H3 (up to 50 pincodes)
   */
  @Post('convert/bulk/pincode-to-h3')
  async bulkPincodeToH3(@Body() dto: BulkPincodeToH3Dto): Promise<BulkPincodeToH3Response> {
    this.logger.log(`POST /convert/bulk/pincode-to-h3 (${dto.pincodes.length} pincodes)`);
    return this.pincodeH3Service.bulkPincodeToH3(dto.pincodes, dto.resolution);
  }

  /**
   * 1.4: POST /convert/bulk/h3-to-pincode
   * Bulk convert H3 cells to pincodes (up to 100 cells)
   */
  @Post('convert/bulk/h3-to-pincode')
  async bulkH3ToPincode(@Body() dto: BulkH3ToPincodeDto): Promise<BulkH3ToPincodeResponse> {
    this.logger.log(`POST /convert/bulk/h3-to-pincode (${dto.h3Indexes.length} H3 cells)`);
    return this.pincodeH3Service.bulkH3ToPincode(dto.h3Indexes);
  }
}
