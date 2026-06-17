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
import { H3DigipinService } from '../services/h3-digipin.service';
import {
  H3ToDigipinQueryDto,
  DigipinToH3QueryDto,
  BulkH3ToDigipinDto,
  BulkDigipinToH3Dto,
  H3ToDigipinResponse,
  DigipinToH3Response,
  BulkH3ToDigipinResponse,
  BulkDigipinToH3Response,
} from '../dto/h3-digipin.dto';

/**
 * H3DigipinController
 * 
 * Stack 3: H3 ↔ DIGIPIN Conversion Operations
 * 
 * 4 endpoints for direct bidirectional conversion between H3 and DIGIPIN:
 * 
 * Single Operations:
 * - GET /convert/h3-to-digipin/:h3Index - H3 hexagon → DIGIPIN cells (ALL overlapping)
 * - GET /convert/digipin-to-h3/:digipinCode - DIGIPIN cell → H3 hexagons (ALL overlapping)
 * 
 * Bulk Operations (NEW):
 * - POST /convert/bulk/h3-to-digipin - Bulk H3 → DIGIPIN (up to 100)
 * - POST /convert/bulk/digipin-to-h3 - Bulk DIGIPIN → H3 (up to 100)
 * 
 * CRITICAL FIX:
 * - Old: Returned only 1 cell (center-point conversion)
 * - New: Returns ALL overlapping cells (complete spatial coverage)
 * - Uses h3-digipin library for accurate spatial relationships
 */
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class H3DigipinController {
  private readonly logger = new Logger(H3DigipinController.name);

  constructor(private readonly h3DigipinService: H3DigipinService) {}

  /**
   * 3.1: GET /convert/h3-to-digipin/:h3Index
   * Convert H3 hexagon to ALL intersecting DIGIPIN cells
   * 
   * CRITICAL FIX: Returns ALL overlapping cells (not just 1)
   */
  @Get('convert/h3-to-digipin/:h3Index')
  async h3ToDigipin(
    @Param('h3Index') h3Index: string,
    @Query() query: H3ToDigipinQueryDto,
  ): Promise<H3ToDigipinResponse> {
    this.logger.log(`GET /convert/h3-to-digipin/${h3Index}?level=${query.level}`);
    return this.h3DigipinService.h3ToDigipin(h3Index, query.level);
  }

  /**
   * 3.2: GET /convert/digipin-to-h3/:digipinCode
   * Convert DIGIPIN cell to ALL intersecting H3 hexagons
   * 
   * CRITICAL FIX: Returns ALL overlapping cells (not just 1)
   */
  @Get('convert/digipin-to-h3/:digipinCode')
  async digipinToH3(
    @Param('digipinCode') digipinCode: string,
    @Query() query: DigipinToH3QueryDto,
  ): Promise<DigipinToH3Response> {
    this.logger.log(`GET /convert/digipin-to-h3/${digipinCode}?resolution=${query.resolution}`);
    return this.h3DigipinService.digipinToH3(digipinCode, query.resolution);
  }

  /**
   * 3.3: POST /convert/bulk/h3-to-digipin (NEW)
   * Bulk convert H3 hexagons to DIGIPIN cells (up to 100)
   */
  @Post('convert/bulk/h3-to-digipin')
  async bulkH3ToDigipin(@Body() dto: BulkH3ToDigipinDto): Promise<BulkH3ToDigipinResponse> {
    this.logger.log(`POST /convert/bulk/h3-to-digipin (${dto.h3Indexes.length} H3 cells)`);
    return this.h3DigipinService.bulkH3ToDigipin(dto.h3Indexes, dto.level);
  }

  /**
   * 3.4: POST /convert/bulk/digipin-to-h3 (NEW)
   * Bulk convert DIGIPIN cells to H3 hexagons (up to 100)
   */
  @Post('convert/bulk/digipin-to-h3')
  async bulkDigipinToH3(@Body() dto: BulkDigipinToH3Dto): Promise<BulkDigipinToH3Response> {
    this.logger.log(`POST /convert/bulk/digipin-to-h3 (${dto.digipinCodes.length} DIGIPIN cells)`);
    return this.h3DigipinService.bulkDigipinToH3(dto.digipinCodes, dto.resolution);
  }
}
