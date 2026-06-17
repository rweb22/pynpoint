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
import { H3Service } from '../services/h3.service';
import {
  EncodeH3Dto,
  DecodeH3Dto,
  NearbyH3QueryDto,
} from '../dto/h3-request.dto';
import {
  H3CellResponse,
  EncodeH3Response,
  DecodeH3Response,
  H3NeighborsResponse,
  H3NearbyResponse,
  H3ParentResponse,
  H3ChildrenResponse,
  H3AncestorsResponse,
} from '../dto/h3-response.dto';

/**
 * H3Controller
 * 
 * Track 3: H3 Solo Operations
 * 
 * Endpoints for Uber's H3 Hexagonal Hierarchical Spatial Index.
 * H3 provides hierarchical hexagonal geospatial indexing.
 * 
 * All endpoints:
 * - Protected by ApiKeyGuard (requires valid API key)
 * - Rate limited by RateLimitInterceptor
 * - Usage tracked by UsageTrackingInterceptor
 * 
 * IMPORTANT: Route ordering matters! Specific routes (encode, decode, nearby, 
 * neighbors) must come BEFORE the parameterized :h3Index route.
 */
@Controller({ path: 'h3', version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class H3Controller {
  private readonly logger = new Logger(H3Controller.name);

  constructor(private readonly h3Service: H3Service) {}

  /**
   * POST /h3/encode
   * Convert coordinates to H3 indices
   * 
   * IMPORTANT: POST routes should come before parameterized GET routes
   */
  @Post('encode')
  async encode(@Body() dto: EncodeH3Dto): Promise<EncodeH3Response> {
    this.logger.log(`POST /h3/encode (${dto.coordinates.length} coordinates)`);
    return this.h3Service.encode(dto);
  }

  /**
   * POST /h3/decode
   * Convert H3 indices to coordinates
   */
  @Post('decode')
  async decode(@Body() dto: DecodeH3Dto): Promise<DecodeH3Response> {
    this.logger.log(`POST /h3/decode (${dto.h3Indices.length} indices)`);
    return this.h3Service.decode(dto);
  }

  /**
   * GET /h3/nearby
   * Find H3 cells within radius
   * 
   * IMPORTANT: Specific GET routes must come BEFORE parameterized routes like :h3Index
   * Otherwise /nearby would match /:h3Index with h3Index="nearby"
   */
  @Get('nearby')
  async getNearby(@Query() query: NearbyH3QueryDto): Promise<H3NearbyResponse> {
    this.logger.log(`GET /h3/nearby?lat=${query.lat}&lng=${query.lng}&radius=${query.radius}`);
    return this.h3Service.getNearby(query);
  }

  /**
   * GET /h3/neighbors/:h3Index
   * Get neighboring H3 cells
   */
  @Get('neighbors/:h3Index')
  async getNeighbors(@Param('h3Index') h3Index: string): Promise<H3NeighborsResponse> {
    this.logger.log(`GET /h3/neighbors/${h3Index}`);
    return this.h3Service.getNeighbors(h3Index);
  }

  /**
   * GET /h3/:h3Index/parent
   * Get parent H3 cell at coarser resolution
   *
   * IMPORTANT: Specific parameterized routes must come BEFORE the catch-all :h3Index route
   */
  @Get(':h3Index/parent')
  async getParent(
    @Param('h3Index') h3Index: string,
    @Query('resolution') resolutionParam?: string,
  ): Promise<H3ParentResponse> {
    this.logger.log(`GET /h3/${h3Index}/parent`);
    const resolution = resolutionParam !== undefined ? parseInt(resolutionParam, 10) : undefined;
    return this.h3Service.getParent(h3Index, resolution);
  }

  /**
   * GET /h3/:h3Index/children
   * Get children H3 cells at finer resolution
   */
  @Get(':h3Index/children')
  async getChildren(
    @Param('h3Index') h3Index: string,
    @Query('resolution') resolutionParam?: string,
  ): Promise<H3ChildrenResponse> {
    this.logger.log(`GET /h3/${h3Index}/children`);
    const resolution = resolutionParam !== undefined ? parseInt(resolutionParam, 10) : undefined;
    return this.h3Service.getChildren(h3Index, resolution);
  }

  /**
   * GET /h3/:h3Index/ancestors
   * Get all ancestor H3 cells from child to resolution 0
   */
  @Get(':h3Index/ancestors')
  async getAncestors(@Param('h3Index') h3Index: string): Promise<H3AncestorsResponse> {
    this.logger.log(`GET /h3/${h3Index}/ancestors`);
    return this.h3Service.getAncestors(h3Index);
  }

  /**
   * GET /h3/:h3Index
   * Get detailed information about an H3 cell
   *
   * IMPORTANT: This route must come LAST among GET routes because it's a catch-all
   */
  @Get(':h3Index')
  async getCell(@Param('h3Index') h3Index: string): Promise<H3CellResponse> {
    this.logger.log(`GET /h3/${h3Index}`);
    return this.h3Service.getCellDetails(h3Index);
  }
}
