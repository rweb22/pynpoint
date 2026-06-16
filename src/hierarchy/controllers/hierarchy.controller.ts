import { Controller, Get, Param, Query, Logger, UseGuards, UseInterceptors } from '@nestjs/common';
import { HierarchyService } from '../services/hierarchy.service';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { UsageTrackingInterceptor } from '../../auth/interceptors/usage-tracking.interceptor';
import { H3ParentQueryDto, H3ChildrenQueryDto } from '../dto/hierarchy-request.dto';
import {
  H3ParentResponse,
  H3ChildrenResponse,
  H3AncestorsResponse,
  DigipinParentResponse,
  DigipinChildrenResponse,
  DigipinAncestorsResponse,
} from '../dto/hierarchy-response.dto';

/**
 * HierarchyController
 * 
 * Track 5: Hierarchy Operations
 * 
 * Provides parent/child/ancestor navigation for H3 and DIGIPIN cells
 * 
 * Endpoints:
 * - GET /hierarchy/h3/:h3Index/parent - Get H3 parent cell
 * - GET /hierarchy/h3/:h3Index/children - Get H3 children cells
 * - GET /hierarchy/h3/:h3Index/ancestors - Get all H3 ancestors
 * - GET /hierarchy/digipin/:code/parent - Get DIGIPIN parent cell
 * - GET /hierarchy/digipin/:code/children - Get DIGIPIN children cells
 * - GET /hierarchy/digipin/:code/ancestors - Get all DIGIPIN ancestors
 */
@Controller({ version: '1' })
@UseGuards(ApiKeyGuard)
@UseInterceptors(UsageTrackingInterceptor)
export class HierarchyController {
  private readonly logger = new Logger(HierarchyController.name);

  constructor(private readonly hierarchyService: HierarchyService) {}

  /**
   * H3 HIERARCHY ENDPOINTS
   */

  /**
   * GET /hierarchy/h3/:h3Index/parent
   * Get parent H3 cell at specified or immediate parent resolution
   */
  @Get('hierarchy/h3/:h3Index/parent')
  async getH3Parent(
    @Param('h3Index') h3Index: string,
    @Query() query: H3ParentQueryDto,
  ): Promise<H3ParentResponse> {
    this.logger.log(`GET /hierarchy/h3/${h3Index}/parent?resolution=${query.resolution}`);
    return this.hierarchyService.getH3Parent(h3Index, query.resolution);
  }

  /**
   * GET /hierarchy/h3/:h3Index/children
   * Get children H3 cells at specified or immediate child resolution
   */
  @Get('hierarchy/h3/:h3Index/children')
  async getH3Children(
    @Param('h3Index') h3Index: string,
    @Query() query: H3ChildrenQueryDto,
  ): Promise<H3ChildrenResponse> {
    this.logger.log(`GET /hierarchy/h3/${h3Index}/children?resolution=${query.resolution}`);
    return this.hierarchyService.getH3Children(h3Index, query.resolution);
  }

  /**
   * GET /hierarchy/h3/:h3Index/ancestors
   * Get all ancestor H3 cells from resolution 0 to current
   */
  @Get('hierarchy/h3/:h3Index/ancestors')
  async getH3Ancestors(
    @Param('h3Index') h3Index: string,
  ): Promise<H3AncestorsResponse> {
    this.logger.log(`GET /hierarchy/h3/${h3Index}/ancestors`);
    return this.hierarchyService.getH3Ancestors(h3Index);
  }

  /**
   * DIGIPIN HIERARCHY ENDPOINTS
   */

  /**
   * GET /hierarchy/digipin/:code/parent
   * Get parent DIGIPIN cell (one level up)
   */
  @Get('hierarchy/digipin/:code/parent')
  async getDigipinParent(
    @Param('code') code: string,
  ): Promise<DigipinParentResponse> {
    this.logger.log(`GET /hierarchy/digipin/${code}/parent`);
    return this.hierarchyService.getDigipinParent(code);
  }

  /**
   * GET /hierarchy/digipin/:code/children
   * Get children DIGIPIN cells (one level down)
   */
  @Get('hierarchy/digipin/:code/children')
  async getDigipinChildren(
    @Param('code') code: string,
  ): Promise<DigipinChildrenResponse> {
    this.logger.log(`GET /hierarchy/digipin/${code}/children`);
    return this.hierarchyService.getDigipinChildren(code);
  }

  /**
   * GET /hierarchy/digipin/:code/ancestors
   * Get all ancestor DIGIPIN cells from level 1 to current
   */
  @Get('hierarchy/digipin/:code/ancestors')
  async getDigipinAncestors(
    @Param('code') code: string,
  ): Promise<DigipinAncestorsResponse> {
    this.logger.log(`GET /hierarchy/digipin/${code}/ancestors`);
    return this.hierarchyService.getDigipinAncestors(code);
  }
}
