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
import { DigipinService } from '../services/digipin.service';
import {
  EncodeDigipinDto,
  DecodeDigipinDto,
  NearbyDigipinQueryDto,
} from '../dto/digipin-request.dto';
import {
  DigipinCellResponse,
  EncodeDigipinResponse,
  DecodeDigipinResponse,
  DigipinNeighborsResponse,
  DigipinNearbyResponse,
} from '../dto/digipin-response.dto';

/**
 * DigipinController
 * 
 * Track 2: DIGIPIN Solo Operations
 * 
 * Endpoints for India Post's Digital Postal Index Number (DIGIPIN) system.
 * DIGIPIN is a hierarchical grid-based geocoding system.
 * 
 * All endpoints:
 * - Protected by ApiKeyGuard (requires valid API key)
 * - Rate limited by RateLimitInterceptor
 * - Usage tracked by UsageTrackingInterceptor
 */
@Controller('api/v1/digipin')
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class DigipinController {
  private readonly logger = new Logger(DigipinController.name);

  constructor(private readonly digipinService: DigipinService) {}

  /**
   * GET /digipin/:code
   * Get detailed information about a DIGIPIN cell
   */
  @Get(':code')
  async getCell(@Param('code') code: string): Promise<DigipinCellResponse> {
    this.logger.log(`GET /digipin/${code}`);
    return this.digipinService.getCellDetails(code);
  }

  /**
   * POST /digipin/encode
   * Convert coordinates to DIGIPIN codes
   */
  @Post('encode')
  async encode(@Body() dto: EncodeDigipinDto): Promise<EncodeDigipinResponse> {
    this.logger.log(`POST /digipin/encode (${dto.coordinates.length} coordinates)`);
    return this.digipinService.encode(dto);
  }

  /**
   * POST /digipin/decode
   * Convert DIGIPIN codes to coordinates
   */
  @Post('decode')
  async decode(@Body() dto: DecodeDigipinDto): Promise<DecodeDigipinResponse> {
    this.logger.log(`POST /digipin/decode (${dto.digipinCodes.length} codes)`);
    return this.digipinService.decode(dto);
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
   * GET /digipin/nearby
   * Find DIGIPIN cells within radius
   */
  @Get('nearby')
  async getNearby(@Query() query: NearbyDigipinQueryDto): Promise<DigipinNearbyResponse> {
    this.logger.log(`GET /digipin/nearby?lat=${query.lat}&lng=${query.lng}&radius=${query.radius}`);
    return this.digipinService.getNearby(query);
  }
}
