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
import { ConversionService } from '../services/conversion.service';
import { ConversionAdvancedService } from '../services/conversion-advanced.service';
import {
  PincodeToH3QueryDto,
  H3ToPincodeQueryDto,
  PincodeToDigipinQueryDto,
  DigipinToPincodeQueryDto,
  H3ToDigipinQueryDto,
  DigipinToH3QueryDto,
  BulkPincodeToH3Dto,
  BulkH3ToPincodeDto,
  SpatialIntersectionQueryDto,
  PolygonSearchDto,
} from '../dto/conversion-request.dto';
import {
  PincodeToH3Response,
  H3ToPincodeResponse,
  PincodeToDigipinResponse,
  DigipinToPincodeResponse,
  H3ToDigipinResponse,
  DigipinToH3Response,
  BulkPincodeToH3Response,
  BulkH3ToPincodeResponse,
  SpatialIntersectionResponse,
  PolygonSearchResponse,
} from '../dto/conversion-response.dto';

/**
 * ConversionController
 * 
 * Track 4: Hybrid & Conversion Operations
 * 
 * 10 endpoints across 3 conversion stacks:
 * 
 * Stack 1: Pincode-Centric (4 endpoints)
 * - GET /convert/pincode-to-h3/:pincode
 * - GET /convert/h3-to-pincode/:h3Index
 * - GET /convert/pincode-to-digipin/:pincode
 * - GET /convert/digipin-to-pincode/:digipinCode
 * 
 * Stack 2: DIGIPIN-H3 Bridge (2 endpoints)
 * - GET /convert/h3-to-digipin/:h3Index
 * - GET /convert/digipin-to-h3/:digipinCode
 * 
 * Stack 3: Advanced/Bulk (4 endpoints)
 * - POST /convert/bulk/pincode-to-h3
 * - POST /convert/bulk/h3-to-pincode
 * - GET /spatial/intersection
 * - POST /spatial/polygon-search
 */
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class ConversionController {
  private readonly logger = new Logger(ConversionController.name);

  constructor(
    private readonly conversionService: ConversionService,
    private readonly advancedService: ConversionAdvancedService,
  ) {}

  /**
   * STACK 1: PINCODE-CENTRIC CONVERSIONS
   */

  /**
   * 4.1: GET /convert/pincode-to-h3/:pincode
   * Convert pincode to all intersecting H3 cells
   */
  @Get('convert/pincode-to-h3/:pincode')
  async pincodeToH3(
    @Param('pincode') pincode: string,
    @Query() query: PincodeToH3QueryDto,
  ): Promise<PincodeToH3Response> {
    this.logger.log(`GET /convert/pincode-to-h3/${pincode}?resolution=${query.resolution}&relationship=${query.relationship}`);
    return this.conversionService.pincodeToH3(pincode, query.resolution);
  }

  /**
   * 4.2: GET /convert/h3-to-pincode/:h3Index
   * Convert H3 cell to all intersecting pincodes
   */
  @Get('convert/h3-to-pincode/:h3Index')
  async h3ToPincode(
    @Param('h3Index') h3Index: string,
    @Query() query: H3ToPincodeQueryDto,
  ): Promise<H3ToPincodeResponse> {
    this.logger.log(`GET /convert/h3-to-pincode/${h3Index}?relationship=${query.relationship}`);
    return this.conversionService.h3ToPincode(h3Index);
  }

  /**
   * 4.3: GET /convert/pincode-to-digipin/:pincode
   * Convert pincode to DIGIPIN Level 6 code(s)
   * Always returns Level 6 (~200m resolution)
   */
  @Get('convert/pincode-to-digipin/:pincode')
  async pincodeToDigipin(
    @Param('pincode') pincode: string,
    @Query() query: PincodeToDigipinQueryDto,
  ): Promise<PincodeToDigipinResponse> {
    this.logger.log(`GET /convert/pincode-to-digipin/${pincode}`);
    return this.conversionService.pincodeToDigipin(pincode);
  }

  /**
   * 4.4: GET /convert/digipin-to-pincode/:digipinCode
   * Convert DIGIPIN cell to all intersecting pincodes
   */
  @Get('convert/digipin-to-pincode/:digipinCode')
  async digipinToPincode(
    @Param('digipinCode') digipinCode: string,
    @Query() query: DigipinToPincodeQueryDto,
  ): Promise<DigipinToPincodeResponse> {
    this.logger.log(`GET /convert/digipin-to-pincode/${digipinCode}?relationship=${query.relationship}`);
    return this.conversionService.digipinToPincode(digipinCode);
  }

  /**
   * STACK 2: DIGIPIN-H3 BRIDGE
   */

  /**
   * 4.5: GET /convert/h3-to-digipin/:h3Index
   * Convert H3 cell to DIGIPIN code(s)
   */
  @Get('convert/h3-to-digipin/:h3Index')
  async h3ToDigipin(
    @Param('h3Index') h3Index: string,
    @Query() query: H3ToDigipinQueryDto,
  ): Promise<H3ToDigipinResponse> {
    this.logger.log(`GET /convert/h3-to-digipin/${h3Index}?level=${query.level}&relationship=${query.relationship}`);
    return this.conversionService.h3ToDigipin(h3Index, query.level);
  }

  /**
   * 4.6: GET /convert/digipin-to-h3/:digipinCode
   * Convert DIGIPIN cell to H3 cells
   */
  @Get('convert/digipin-to-h3/:digipinCode')
  async digipinToH3(
    @Param('digipinCode') digipinCode: string,
    @Query() query: DigipinToH3QueryDto,
  ): Promise<DigipinToH3Response> {
    this.logger.log(`GET /convert/digipin-to-h3/${digipinCode}?resolution=${query.resolution}&relationship=${query.relationship}`);
    return this.conversionService.digipinToH3(digipinCode, query.resolution);
  }

  /**
   * STACK 3: ADVANCED/BULK OPERATIONS
   */

  /**
   * 4.7: POST /convert/bulk/pincode-to-h3
   * Bulk convert pincodes to H3 (up to 50 pincodes)
   */
  @Post('convert/bulk/pincode-to-h3')
  async bulkPincodeToH3(@Body() dto: BulkPincodeToH3Dto): Promise<BulkPincodeToH3Response> {
    this.logger.log(`POST /convert/bulk/pincode-to-h3 (${dto.pincodes.length} pincodes)`);
    return this.advancedService.bulkPincodeToH3(dto.pincodes, dto.resolution);
  }

  /**
   * 4.8: POST /convert/bulk/h3-to-pincode
   * Bulk convert H3 cells to pincodes (up to 100 cells)
   */
  @Post('convert/bulk/h3-to-pincode')
  async bulkH3ToPincode(@Body() dto: BulkH3ToPincodeDto): Promise<BulkH3ToPincodeResponse> {
    this.logger.log(`POST /convert/bulk/h3-to-pincode (${dto.h3Indexes.length} H3 cells)`);
    return this.advancedService.bulkH3ToPincode(dto.h3Indexes);
  }

  /**
   * 4.9: GET /spatial/intersection
   * Find spatial intersection between pincode and coordinate
   */
  @Get('spatial/intersection')
  async spatialIntersection(
    @Query() query: SpatialIntersectionQueryDto,
  ): Promise<SpatialIntersectionResponse> {
    this.logger.log(
      `GET /spatial/intersection?pincode=${query.pincode}&lat=${query.lat}&lng=${query.lng}`,
    );
    return this.advancedService.spatialIntersection(query.pincode, query.lat, query.lng);
  }

  /**
   * 4.10: POST /spatial/polygon-search
   * Find all pincodes within a custom polygon
   */
  @Post('spatial/polygon-search')
  async polygonSearch(@Body() dto: PolygonSearchDto): Promise<PolygonSearchResponse> {
    this.logger.log(`POST /spatial/polygon-search (${dto.includeH3 ? 'with H3' : 'no H3'}, ${dto.includeDigipin ? 'with DIGIPIN' : 'no DIGIPIN'})`);
    return this.advancedService.polygonSearch(
      dto.polygon,
      dto.includeH3,
      dto.includeDigipin,
      dto.h3Resolution,
      dto.digipinLevel,
    );
  }
}
