import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { AdminAuthGuard } from '../guards/admin-auth.guard';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { UpdateApiKeyTierDto } from '../dto/update-api-key-tier.dto';
import { ApiKeyResponseDto, ApiKeyCreatedResponseDto } from '../dto/api-key-response.dto';
import { Public } from '../decorators/public.decorator';

/**
 * AdminApiKeyController
 *
 * Admin endpoints for API key provisioning and management.
 * Protected by AdminAuthGuard (requires X-Admin-Secret header).
 *
 * Used by the main website (codesense.in) to:
 * - Create API keys when customers subscribe
 * - Update tiers when customers upgrade/downgrade
 * - Revoke keys when customers cancel
 * - List keys for a customer
 *
 * Security:
 * - All endpoints require X-Admin-Secret header
 * - Full API key only returned once on creation
 * - Subsequent responses only show prefix
 */
@Controller('admin/api-keys')
@Public()  // Bypass global ApiKeyGuard - uses AdminAuthGuard instead
@UseGuards(AdminAuthGuard)
export class AdminApiKeyController {
  private readonly logger = new Logger(AdminApiKeyController.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * Create a new API key
   *
   * Called by main website when:
   * - Customer subscribes to a paid plan
   * - Customer requests a new API key
   *
   * Returns the full API key ONCE - must be stored securely!
   */
  @Post()
  async createApiKey(@Body() dto: CreateApiKeyDto): Promise<ApiKeyCreatedResponseDto> {
    this.logger.log(`Creating API key for customer ${dto.externalCustomerId} (tier: ${dto.tier})`);

    const result = await this.apiKeyService.generateKey(
      dto.externalCustomerId,
      dto.tier,
      dto.environment || 'live',
      {
        rateLimitOverrides: dto.rateLimitOverrides,
        metadata: dto.metadata,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    );

    return {
      id: result.entity.id,
      externalCustomerId: result.entity.external_customer_id,
      key: result.key, // Full key - returned ONCE only!
      prefix: result.prefix,
      tier: result.entity.tier,
      environment: result.entity.environment,
      isActive: result.entity.is_active,
      lastUsedAt: result.entity.last_used_at,
      expiresAt: result.entity.expires_at,
      rateLimitOverrides: result.entity.rate_limit_overrides,
      metadata: result.entity.metadata,
      createdAt: result.entity.created_at,
      updatedAt: result.entity.updated_at,
      warning: 'This API key will only be displayed once. Store it securely!',
    };
  }

  /**
   * List all API keys for a customer
   *
   * Called by main website to display keys in customer dashboard.
   * Does NOT return full keys, only prefixes.
   */
  @Get()
  async listApiKeys(@Query('customerId') customerId: string): Promise<ApiKeyResponseDto[]> {
    this.logger.log(`Listing API keys for customer ${customerId}`);

    const keys = await this.apiKeyService.listKeysByCustomer(customerId);

    return keys.map((key) => ({
      id: key.id,
      externalCustomerId: key.external_customer_id,
      prefix: key.prefix,
      tier: key.tier,
      environment: key.environment,
      isActive: key.is_active,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      rateLimitOverrides: key.rate_limit_overrides,
      metadata: key.metadata,
      createdAt: key.created_at,
      updatedAt: key.updated_at,
    }));
  }

  /**
   * Update API key tier
   *
   * Called by main website when customer upgrades/downgrades subscription.
   * Invalidates Redis cache to force re-fetch with new tier.
   */
  @Patch(':id/tier')
  async updateKeyTier(
    @Param('id') keyId: string,
    @Body() dto: UpdateApiKeyTierDto,
  ): Promise<ApiKeyResponseDto> {
    this.logger.log(`Updating API key ${keyId} to tier ${dto.tier}`);

    try {
      const updated = await this.apiKeyService.updateKeyTier(
        keyId,
        dto.tier,
        dto.rateLimitOverrides,
      );

      return {
        id: updated.id,
        externalCustomerId: updated.external_customer_id,
        prefix: updated.prefix,
        tier: updated.tier,
        environment: updated.environment,
        isActive: updated.is_active,
        lastUsedAt: updated.last_used_at,
        expiresAt: updated.expires_at,
        rateLimitOverrides: updated.rate_limit_overrides,
        metadata: updated.metadata,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      };
    } catch (error) {
      throw new NotFoundException(`API key not found: ${keyId}`);
    }
  }

  /**
   * Revoke an API key
   *
   * Called by main website when:
   * - Customer cancels subscription
   * - Customer explicitly revokes a key
   * - Security incident (compromised key)
   *
   * Soft delete - sets is_active = false and invalidates cache.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(@Param('id') keyId: string): Promise<void> {
    this.logger.log(`Revoking API key ${keyId}`);

    const success = await this.apiKeyService.revokeKey(keyId);

    if (!success) {
      throw new NotFoundException(`API key not found: ${keyId}`);
    }
  }
}
