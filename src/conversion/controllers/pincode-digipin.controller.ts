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
import { PincodeDigipinService } from '../services/pincode-digipin.service';
import {
  PincodeToDigipinQueryDto,
  DigipinToPincodeQueryDto,
  BulkPincodeToDigipinDto,
  BulkDigipinToPincodeDto,
  PincodeToDigipinResponse,
  DigipinToPincodeResponse,
  BulkPincodeToDigipinResponse,
  BulkDigipinToPincodeResponse,
} from '../dto/pincode-digipin.dto';

/**
 * PincodeDigipinController
 * 
 * Stack 2: Pincode ↔ DIGIPIN Conversion Operations
 * 
 * 4 endpoints for bidirectional conversion between Pincodes and DIGIPIN grid cells:
 * 
 * Single Operations:
 * - GET /convert/pincode-to-digipin/:pincode - Pincode → DIGIPIN cells
 * - GET /convert/digipin-to-pincode/:digipinCode - DIGIPIN cell → Pincodes
 * 
 * Bulk Operations (NEW):
 * - POST /convert/bulk/pincode-to-digipin - Bulk Pincode → DIGIPIN (up to 50)
 * - POST /convert/bulk/digipin-to-pincode - Bulk DIGIPIN → Pincodes (up to 100)
 */
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class PincodeDigipinController {
  private readonly logger = new Logger(PincodeDigipinController.name);

  constructor(private readonly pincodeDigipinService: PincodeDigipinService) {}

  /**
   * 2.1: GET /convert/pincode-to-digipin/:pincode
   * Convert pincode to all intersecting DIGIPIN cells
   */
  @Get('convert/pincode-to-digipin/:pincode')
  async pincodeToDigipin(
    @Param('pincode') pincode: string,
    @Query() query: PincodeToDigipinQueryDto,
  ): Promise<PincodeToDigipinResponse> {
    this.logger.log(`GET /convert/pincode-to-digipin/${pincode}?level=${query.level}`);
    return this.pincodeDigipinService.pincodeToDigipin(pincode, query.level);
  }

  /**
   * 2.2: GET /convert/digipin-to-pincode/:digipinCode
   * Convert DIGIPIN cell to all intersecting pincodes
   */
  @Get('convert/digipin-to-pincode/:digipinCode')
  async digipinToPincode(
    @Param('digipinCode') digipinCode: string,
    @Query() query: DigipinToPincodeQueryDto,
  ): Promise<DigipinToPincodeResponse> {
    this.logger.log(`GET /convert/digipin-to-pincode/${digipinCode}`);
    return this.pincodeDigipinService.digipinToPincode(digipinCode);
  }

  /**
   * 2.3: POST /convert/bulk/pincode-to-digipin (NEW)
   * Bulk convert pincodes to DIGIPIN (up to 50 pincodes)
   */
  @Post('convert/bulk/pincode-to-digipin')
  async bulkPincodeToDigipin(@Body() dto: BulkPincodeToDigipinDto): Promise<BulkPincodeToDigipinResponse> {
    this.logger.log(`POST /convert/bulk/pincode-to-digipin (${dto.pincodes.length} pincodes)`);
    return this.pincodeDigipinService.bulkPincodeToDigipin(dto.pincodes, dto.level);
  }

  /**
   * 2.4: POST /convert/bulk/digipin-to-pincode (NEW)
   * Bulk convert DIGIPIN cells to pincodes (up to 100 cells)
   */
  @Post('convert/bulk/digipin-to-pincode')
  async bulkDigipinToPincode(@Body() dto: BulkDigipinToPincodeDto): Promise<BulkDigipinToPincodeResponse> {
    this.logger.log(`POST /convert/bulk/digipin-to-pincode (${dto.digipinCodes.length} DIGIPIN cells)`);
    return this.pincodeDigipinService.bulkDigipinToPincode(dto.digipinCodes);
  }
}
