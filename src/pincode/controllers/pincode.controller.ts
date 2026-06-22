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
import { PincodeService } from '../services/pincode.service';
import { AdministrativeService } from '../services/administrative.service';
import {
  PincodeQueryDto,
  BulkPincodeLookupDto,
  DistrictQueryDto,
  CityQueryDto,
  NearbyPincodeQueryDto,
  ReverseGeocodeDto,
} from '../dto/pincode-query.dto';

/**
 * PincodeController
 * 
 * Track 1: Pincode Solo Operations
 * 
 * All endpoints are protected by:
 * - ApiKeyGuard: Require valid API key
 * - RateLimitInterceptor: Enforce tier-based rate limits
 * - UsageTrackingInterceptor: Track API usage
 * 
 * Base path: /api/v1/pincodes
 */
@Controller({ path: 'pincodes', version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class PincodeController {
  private readonly logger = new Logger(PincodeController.name);

  constructor(
    private readonly pincodeService: PincodeService,
    private readonly administrativeService: AdministrativeService,
  ) {}

  /**
   * POST /api/v1/pincodes/reverse-geocode
   * Convert coordinates to nearest pincode
   *
   * IMPORTANT: POST routes should come BEFORE parameterized GET routes
   */
  @Post('reverse-geocode')
  async reverseGeocode(@Body() dto: ReverseGeocodeDto) {
    this.logger.log(`POST /pincodes/reverse-geocode (${dto.latitude}, ${dto.longitude})`);
    return this.pincodeService.reverseGeocode(dto);
  }

  /**
   * GET /api/v1/pincodes/:pincode/validate
   * Validate pincode format, existence, and geographic bounds
   *
   * IMPORTANT: This route must come BEFORE /:pincode to avoid matching "validate" as a pincode
   */
  @Get(':pincode/validate')
  async validatePincode(@Param('pincode') pincode: string) {
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
    @Param('pincode') pincode: string,
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
  async getPincode(
    @Param('pincode') pincode: string,
    @Query('includePostOffices') includePostOffices?: string,
    @Query('includeBoundary') includeBoundary?: string,
  ) {
    this.logger.log(`GET /pincodes/${pincode}`);

    return this.pincodeService.findByPincode(
      pincode,
      includePostOffices === 'true',
      includeBoundary === 'true',
    );
  }

  /**
   * GET /api/v1/pincodes
   * Search/filter pincodes by state, district, city
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
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
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
   * GET /api/v1/administrative/cities
   * Get cities (optionally filtered by state and/or district)
   */
  @Get('cities')
  async getCities(@Query() query: CityQueryDto) {
    this.logger.log(`GET /administrative/cities?${JSON.stringify(query)}`);
    return this.administrativeService.getCities(query);
  }
}
