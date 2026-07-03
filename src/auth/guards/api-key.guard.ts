import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ApiKeyService } from '../services/api-key.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * ApiKeyGuard
 * 
 * Validates API keys from the Authorization header.
 * 
 * Usage:
 *   @UseGuards(ApiKeyGuard)
 *   @Get('/pincodes')
 *   async getPincodes() { ... }
 * 
 * Authorization Header Format:
 *   Authorization: Bearer ppk_live_sk_a8f2c1d4e5f6g7h8i9j0k1l2_7
 * 
 * Flow:
 * 1. Extract API key from Authorization header
 * 2. Validate key format and checksum (fast, no I/O)
 * 3. Validate key against database (with Redis cache)
 * 4. Attach key data to request.apiKey for downstream use
 * 5. Record usage (fire-and-forget)
 * 
 * Request Enhancement:
 *   After successful validation, request object contains:
 *   - request.apiKey.keyId
 *   - request.apiKey.externalCustomerId
 *   - request.apiKey.tier
 *   - request.apiKey.environment
 *   - request.apiKey.rateLimitOverrides
 *   - request.apiKey.metadata
 */

// Extend Express Request to include apiKey
declare module 'express' {
  interface Request {
    apiKey?: {
      keyId: string;
      externalCustomerId: string;
      tier: string;
      environment: string;
      rateLimitOverrides: any;
      metadata: any;
    };
  }
}

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();

    // Skip if already authenticated by marketplace proxy guard
    if (request.user && request.user.authType === 'marketplace-proxy') {
      this.logger.debug(`Request already authenticated via ${request.user.marketplace} - skipping API key validation`);
      return true;
    }

    // Extract API key from Authorization header
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      this.logger.warn(`Missing or invalid Authorization header from ${request.ip}`);
      throw new UnauthorizedException('API key is required. Please provide a valid API key in the Authorization header.');
    }

    // Validate API key
    const keyData = await this.apiKeyService.validateKey(apiKey);

    if (!keyData) {
      this.logger.warn(`Invalid API key: ${apiKey.substring(0, 15)}*** from ${request.ip}`);
      throw new UnauthorizedException('Invalid or expired API key.');
    }

    // Attach key data to request for downstream use
    request.apiKey = keyData;

    // NOTE: Usage tracking (including last_used_at) is now handled by
    // StreamUsageTrackingInterceptor via Redis Streams + background worker.
    // This eliminates 3 DB operations per request (1 UPDATE + 2 for api_usage).

    this.logger.debug(`Authenticated request from customer ${keyData.externalCustomerId} (tier: ${keyData.tier})`);

    return true;
  }

  /**
   * Extract API key from Authorization header
   * 
   * Supports:
   * - Bearer token: "Authorization: Bearer ppk_live_sk_..."
   * - Direct key: "Authorization: ppk_live_sk_..."
   * 
   * @param request - Express request object
   * @returns API key string or null
   */
  private extractApiKey(request: Request): string | null {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return null;
    }

    // Check for "Bearer <token>" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7).trim();
    }

    // Check for direct key format
    if (authHeader.startsWith('ppk_')) {
      return authHeader.trim();
    }

    return null;
  }
}
