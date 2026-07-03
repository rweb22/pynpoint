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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiSecurity } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { TokenBucketRateLimitInterceptor } from '../../auth/interceptors/token-bucket-rate-limit.interceptor';
import { StreamUsageTrackingInterceptor } from '../../auth/interceptors/stream-usage-tracking.interceptor';
import { PincodeService } from '../services/pincode.service';
import { AdministrativeService } from '../services/administrative.service';
import {
  PincodeQueryDto,
  BulkPincodeLookupDto,
  DistrictQueryDto,
  RegionQueryDto,
  NearbyPincodeQueryDto,
  ReverseGeocodeDto,
  LocatePincodeDto,
} from '../dto/pincode-query.dto';
import { PincodeValidationPipe } from '../pipes/pincode-validation.pipe';

/**
 * PincodeController
 *
 * Track 1: Pincode Solo Operations
 *
 * All endpoints are protected by:
 * - ApiKeyGuard: Require valid API key
 * - TokenBucketRateLimitInterceptor: Token Bucket rate limiting (1 Redis op vs 9)
 * - StreamUsageTrackingInterceptor: Redis Streams usage tracking (0 DB writes)
 *
 * Base path: /api/v1/pincodes
 */
@Controller({ path: 'pincodes', version: '1' })
@ApiTags('pincodes')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@UseInterceptors(TokenBucketRateLimitInterceptor, StreamUsageTrackingInterceptor)
export class PincodeController {
  private readonly logger = new Logger(PincodeController.name);

  constructor(
    private readonly pincodeService: PincodeService,
    private readonly administrativeService: AdministrativeService,
  ) {}

  /**
   * POST /api/v1/pincodes/reverse-geocode
   * Convert coordinates to nearest pincode(s)
   *
   * IMPORTANT: POST routes should come BEFORE parameterized GET routes
   */
  @Post('reverse-geocode')
  @ApiOperation({
    summary: 'Find nearest pincode(s) by distance',
    description: 'Find the nearest Indian postal code(s) to given GPS coordinates. Returns pincodes sorted by distance from the point, useful when the point might be outside any pincode boundary or for finding nearby delivery options.',
  })
  @ApiResponse({ status: 200, description: 'Nearest pincode(s) found successfully' })
  @ApiResponse({ status: 400, description: 'Invalid coordinates' })
  @ApiResponse({ status: 404, description: 'No pincode found within search radius' })
  async reverseGeocode(@Body() dto: ReverseGeocodeDto) {
    this.logger.log(`POST /pincodes/reverse-geocode (${dto.latitude}, ${dto.longitude})`);
    return this.pincodeService.reverseGeocode(dto);
  }

  /**
   * POST /api/v1/pincodes/locate
   * Find pincode that contains the given coordinates (point-in-polygon)
   *
   * IMPORTANT: POST routes should come BEFORE parameterized GET routes
   */
  @Post('locate')
  @ApiOperation({
    summary: 'Find pincode from GPS coordinates',
    description: 'Find the pincode whose boundary polygon contains the given GPS coordinates. Uses exact point-in-polygon matching. Returns the pincode you are currently located in. Perfect for "Where am I?" queries.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully located pincode or confirmed no pincode contains the point',
    schema: {
      example: {
        coordinates: { latitude: 28.6139, longitude: 77.2090, withinIndiaBounds: true },
        pincode: "110001",
        found: true,
        details: {
          pincode: "110001",
          officeName: "Connaught Place H.O",
          state: "Delhi",
          district: "Central Delhi"
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid coordinates' })
  async locatePincode(@Body() dto: LocatePincodeDto) {
    this.logger.log(`POST /pincodes/locate (${dto.latitude}, ${dto.longitude})`);
    return this.pincodeService.locatePincode(dto);
  }

  /**
   * GET /api/v1/pincodes/:pincode/validate
   * Validate pincode format, existence, and geographic bounds
   *
   * IMPORTANT: This route must come BEFORE /:pincode to avoid matching "validate" as a pincode
   */
  @Get(':pincode/validate')
  async validatePincode(
    @Param('pincode', PincodeValidationPipe) pincode: string,
  ) {
    this.logger.log(`GET /pincodes/${pincode}/validate`);
    return this.pincodeService.validatePincode(pincode);
  }

  /**
   * GET /api/v1/pincodes/:pincode/nearby
   * Find pincodes within radius of a given pincode
   *
   * IMPORTANT: This route must come BEFORE /:pincode to avoid matching "nearby" as a pincode
   */
  @Get(':pincode/nearby')
  async getNearbyPincodes(
    @Param('pincode', PincodeValidationPipe) pincode: string,
    @Query() query: NearbyPincodeQueryDto,
  ) {
    this.logger.log(`GET /pincodes/${pincode}/nearby?radius=${query.radius}${query.unit}`);
    return this.pincodeService.findNearbyPincodes(pincode, query);
  }

  /**
   * GET /api/v1/pincodes/:pincode
   * Get details of a single pincode
   */
  @Get(':pincode')
  @ApiOperation({
    summary: 'Get pincode details',
    description: 'Retrieve complete information for a specific 6-digit Indian postal code including location, administrative boundaries, and post office details.',
  })
  @ApiParam({
    name: 'pincode',
    description: '6-digit Indian postal code',
    example: '110001',
  })
  @ApiQuery({
    name: 'includePostOffices',
    required: false,
    description: 'Include associated post offices in the response',
    example: 'true',
  })
  @ApiResponse({ status: 200, description: 'Pincode details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Pincode not found' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getPincode(
    @Param('pincode', PincodeValidationPipe) pincode: string,
    @Query('includePostOffices') includePostOffices?: string,
  ) {
    this.logger.log(`GET /pincodes/${pincode}`);

    return this.pincodeService.findByPincode(
      pincode,
      includePostOffices === 'true',
    );
  }

  /**
   * GET /api/v1/pincodes
   * Search/filter pincodes by state, district
   */
  @Get()
  async searchPincodes(@Query() query: PincodeQueryDto) {
    this.logger.log(`GET /pincodes?${JSON.stringify(query)}`);
    return this.pincodeService.findPincodes(query);
  }

  /**
   * POST /api/v1/pincodes/bulk/lookup
   * Bulk pincode lookup (up to 100 pincodes)
   */
  @Post('bulk/lookup')
  async bulkLookup(@Body() dto: BulkPincodeLookupDto) {
    this.logger.log(`POST /pincodes/bulk/lookup (${dto.pincodes.length} pincodes)`);
    return this.pincodeService.bulkLookup(dto);
  }
}

/**
 * AdministrativeController
 *
 * Administrative endpoints for states and districts
 *
 * Base path: /api/v1/administrative
 */
@Controller({ path: 'administrative', version: '1' })
@ApiTags('administrative')
@ApiSecurity('api-key')
@UseGuards(ApiKeyGuard)
@UseInterceptors(TokenBucketRateLimitInterceptor, StreamUsageTrackingInterceptor)
export class AdministrativeController {
  private readonly logger = new Logger(AdministrativeController.name);

  constructor(private readonly administrativeService: AdministrativeService) {}

  /**
   * GET /api/v1/administrative/states
   * Get all states with metadata
   */
  @Get('states')
  async getStates() {
    this.logger.log('GET /administrative/states');
    return this.administrativeService.getStates();
  }

  /**
   * GET /api/v1/administrative/states/:code
   * Get state details by code (e.g., "DL", "MH")
   */
  @Get('states/:code')
  async getStateDetails(@Param('code') code: string) {
    this.logger.log(`GET /administrative/states/${code}`);
    return this.administrativeService.getStateDetails(code);
  }

  /**
   * GET /api/v1/administrative/districts
   * Get districts (optionally filtered by state)
   */
  @Get('districts')
  async getDistricts(@Query() query: DistrictQueryDto) {
    this.logger.log(`GET /administrative/districts?${JSON.stringify(query)}`);
    return this.administrativeService.getDistricts(query);
  }

  /**
   * GET /api/v1/administrative/regions
   * Get regions (optionally filtered by state and/or circle)
   */
  @Get('regions')
  async getRegions(@Query() query: RegionQueryDto) {
    this.logger.log(`GET /administrative/regions?${JSON.stringify(query)}`);
    return this.administrativeService.getRegions(query);
  }
}
