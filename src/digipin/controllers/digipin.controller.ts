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
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiSecurity, ApiBody } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { TokenBucketRateLimitInterceptor } from '../../auth/interceptors/token-bucket-rate-limit.interceptor';
import { StreamUsageTrackingInterceptor } from '../../auth/interceptors/stream-usage-tracking.interceptor';
import { DigipinService } from '../services/digipin.service';
import { ApiRateLimitHeaders } from '../../common/decorators/api-rate-limit-headers.decorator';
import {
  EncodeDigipinDto,
  DecodeDigipinDto,
  NearbyDigipinQueryDto,
  ValidateDigipinDto,
  DigipinToPincodeDto,
} from '../dto/digipin-request.dto';
import {
  DigipinCellResponse,
  EncodeDigipinResponse,
  DecodeDigipinResponse,
  DigipinNeighborsResponse,
  DigipinNearbyResponse,
  DigipinParentResponse,
  DigipinChildrenResponse,
  DigipinAncestorsResponse,
  ValidateDigipinResponse,
  DigipinToPincodeResponse,
} from '../dto/digipin-response.dto';

/**
 * DigipinController
 *
 * Track 2: DIGIPIN Operations
 *
 * Endpoints for India Post's Digital Postal Index Number (DIGIPIN) system.
 * DIGIPIN is a hierarchical 4x4 grid-based geocoding system with 10 levels.
 *
 * Operations include:
 * - Pure algorithmic calculations (encode, decode, hierarchy)
 * - Reverse geocoding (DIGIPIN → Pincode via PostGIS)
 * - All responses include complete grid geometry (center, bounds)
 *
 * Total endpoints: 10
 * - 4 POST: encode, decode, validate, to-pincode
 * - 6 GET: nearby, neighbors, parent, children, ancestors, cell details
 *
 * All endpoints:
 * - Protected by ApiKeyGuard (requires valid API key)
 * - Rate limited by TokenBucketRateLimitInterceptor (1 Redis op vs 9)
 * - Usage tracked by StreamUsageTrackingInterceptor (0 DB writes)
 */
@Controller({ path: 'digipin', version: '1' })
@ApiTags('digipin')
@ApiSecurity('api-key')
@ApiRateLimitHeaders()
@UseGuards(ApiKeyGuard)
@UseInterceptors(TokenBucketRateLimitInterceptor, StreamUsageTrackingInterceptor)
export class DigipinController {
  private readonly logger = new Logger(DigipinController.name);

  constructor(private readonly digipinService: DigipinService) {}

  /**
   * POST /digipin/encode
   * Convert coordinates to DIGIPIN codes
   *
   * IMPORTANT: POST routes should come before parameterized GET routes
   */
  @Post('encode')
  @ApiBody({
    type: EncodeDigipinDto,
    examples: {
      'single-delhi': {
        summary: 'Encode single location (Delhi)',
        value: {
          coordinates: [{ latitude: 28.6139, longitude: 77.2090 }],
          level: 6
        }
      },
      'batch-cities': {
        summary: 'Batch encode multiple cities',
        value: {
          coordinates: [
            { latitude: 28.6139, longitude: 77.2090 },
            { latitude: 19.0760, longitude: 72.8777 },
            { latitude: 13.0827, longitude: 80.2707 }
          ],
          level: 8
        }
      },
      'high-precision': {
        summary: 'High precision encoding (~4m accuracy)',
        value: {
          coordinates: [{ latitude: 28.6139, longitude: 77.2090 }],
          level: 10
        }
      }
    }
  })
  async encode(@Body() dto: EncodeDigipinDto): Promise<EncodeDigipinResponse> {
    this.logger.log(`POST /digipin/encode (${dto.coordinates.length} coordinates)`);
    return this.digipinService.encode(dto);
  }

  /**
   * POST /digipin/decode
   * Convert DIGIPIN codes to coordinates
   */
  @Post('decode')
  @ApiBody({
    type: DecodeDigipinDto,
    examples: {
      'single-code': {
        summary: 'Decode single DIGIPIN',
        value: {
          digipinCodes: ['C4P8K63M']
        }
      },
      'multiple-codes': {
        summary: 'Decode multiple DIG IPINs',
        value: {
          digipinCodes: ['C4P8K63M', '4QHVFP2G', 'GWVPN64K']
        }
      }
    }
  })
  async decode(@Body() dto: DecodeDigipinDto): Promise<DecodeDigipinResponse> {
    this.logger.log(`POST /digipin/decode (${dto.digipinCodes.length} codes)`);
    return this.digipinService.decode(dto);
  }

  /**
   * POST /digipin/validate
   * Validate DIGIPIN code format and geographic bounds
   *
   * UNIQUE FEATURE - No competitor has DIGIPIN validation!
   */
  @Post('validate')
  @ApiBody({
    type: ValidateDigipinDto,
    examples: {
      'valid-code': {
        summary: 'Validate a DIGIPIN code',
        value: {
          digipinCode: 'C4P8K63M'
        }
      }
    }
  })
  async validate(@Body() dto: ValidateDigipinDto): Promise<ValidateDigipinResponse> {
    this.logger.log(`POST /digipin/validate (code: ${dto.digipinCode})`);
    return this.digipinService.validateDigipin(dto);
  }

  /**
   * POST /digipin/to-pincode
   * Convert DIGIPIN code to pincode (reverse geocode)
   *
   * Process:
   * 1. Decode DIGIPIN → coordinates
   * 2. Find pincode containing those coordinates (PostGIS ST_Intersects)
   *
   * IMPORTANT: Must come BEFORE GET routes to avoid route conflicts
   */
  @Post('to-pincode')
  @ApiBody({
    type: DigipinToPincodeDto,
    examples: {
      'digipin-to-pincode': {
        summary: 'Convert DIGIPIN to nearest pincode',
        value: {
          digipinCode: 'C4P8K63M'
        }
      }
    }
  })
  async toPincode(@Body() dto: DigipinToPincodeDto): Promise<DigipinToPincodeResponse> {
    this.logger.log(`POST /digipin/to-pincode (code: ${dto.digipinCode})`);
    return this.digipinService.toPincode(dto);
  }

  /**
   * GET /digipin/nearby
   * Find DIGIPIN cells within radius
   *
   * IMPORTANT: Specific GET routes must come BEFORE parameterized routes like :code
   * Otherwise /nearby would match /:code with code="nearby"
   */
  @Get('nearby')
  async getNearby(@Query() query: NearbyDigipinQueryDto): Promise<DigipinNearbyResponse> {
    this.logger.log(`GET /digipin/nearby?lat=${query.lat}&lng=${query.lng}&radius=${query.radius}`);
    return this.digipinService.getNearby(query);
  }

  /**
   * GET /digipin/neighbors/:code
   * Get neighboring DIGIPIN cells (same level)
   */
  @Get('neighbors/:code')
  async getNeighbors(@Param('code') code: string): Promise<DigipinNeighborsResponse> {
    this.logger.log(`GET /digipin/neighbors/${code}`);
    return this.digipinService.getNeighbors(code);
  }

  /**
   * GET /digipin/:code/parent
   * Get parent DIGIPIN cell (one level up)
   *
   * IMPORTANT: Must come BEFORE /:code route
   */
  @Get(':code/parent')
  async getParent(@Param('code') code: string): Promise<DigipinParentResponse> {
    this.logger.log(`GET /digipin/${code}/parent`);
    return this.digipinService.getParent(code);
  }

  /**
   * GET /digipin/:code/children
   * Get children DIGIPIN cells (one level down, 16 cells in 4x4 grid)
   *
   * IMPORTANT: Must come BEFORE /:code route
   */
  @Get(':code/children')
  async getChildren(@Param('code') code: string): Promise<DigipinChildrenResponse> {
    this.logger.log(`GET /digipin/${code}/children`);
    return this.digipinService.getChildren(code);
  }

  /**
   * GET /digipin/:code/ancestors
   * Get all ancestor DIGIPIN cells (from level 1 to parent)
   *
   * IMPORTANT: Must come BEFORE /:code route
   */
  @Get(':code/ancestors')
  async getAncestors(@Param('code') code: string): Promise<DigipinAncestorsResponse> {
    this.logger.log(`GET /digipin/${code}/ancestors`);
    return this.digipinService.getAncestors(code);
  }

  /**
   * GET /digipin/:code
   * Get detailed information about a DIGIPIN cell
   *
   * IMPORTANT: This route must come LAST among GET routes because it's a catch-all
   */
  @Get(':code')
  async getCell(@Param('code') code: string): Promise<DigipinCellResponse> {
    this.logger.log(`GET /digipin/${code}`);
    return this.digipinService.getCellDetails(code);
  }
}
