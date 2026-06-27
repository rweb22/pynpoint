import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { MarketplaceConfigService } from '../services/marketplace-config.service';

/**
 * MarketplaceProxyGuard
 *
 * Validates requests from API marketplace platforms using database-driven configuration.
 * Marketplace configs are loaded from database on startup and cached in memory.
 *
 * If valid marketplace headers are present, authenticates the request and skips ApiKeyGuard.
 * If no marketplace headers, passes through to ApiKeyGuard.
 *
 * Supported Marketplaces (configured in database):
 * - RapidAPI: x-rapidapi-proxy-secret, x-rapidapi-user
 * - AWS Marketplace: x-aws-marketplace-token, x-aws-marketplace-customer-id
 * - Azure Marketplace: x-azure-marketplace-token, x-azure-marketplace-customer-id
 * - Any custom marketplace: configure in marketplace_configs table
 *
 * Database Table: marketplace_configs
 * - marketplace_id: Identifier (e.g., 'rapidapi')
 * - secret_key: The secret to validate
 * - header_name: Header to check (e.g., 'x-rapidapi-proxy-secret')
 * - user_header_name: Header for user ID (e.g., 'x-rapidapi-user')
 * - is_active: Enable/disable this marketplace
 *
 * Flow:
 * 1. Check all configured marketplace headers
 * 2. If found, validate the secret against database config
 * 3. If valid, attach user info to request and return true (authenticated)
 * 4. If no marketplace headers, return true (pass through to ApiKeyGuard)
 * 5. If invalid marketplace secret, throw 401
 *
 * Request Enhancement (on successful marketplace auth):
 *   - request.user.marketplace: marketplace_id from database
 *   - request.user.customerId: from user header
 *   - request.user.tier: 'marketplace'
 *   - request.user.authType: 'marketplace-proxy'
 */

// Extend Express Request to include user from marketplace
declare module 'express' {
  interface Request {
    user?: {
      marketplace?: string;
      customerId?: string;
      tier?: string;
      authType?: string;
    };
  }
}

@Injectable()
export class MarketplaceProxyGuard implements CanActivate {
  private readonly logger = new Logger(MarketplaceProxyGuard.name);

  constructor(
    private readonly marketplaceConfigService: MarketplaceConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Get all known marketplace headers from the service
    const knownHeaders = this.marketplaceConfigService.getKnownHeaders();

    // Check each known marketplace header
    for (const headerName of knownHeaders) {
      const secretValue = request.headers[headerName] as string;

      if (secretValue) {
        // Found a marketplace header - validate secret with O(1) lookup
        const config = this.marketplaceConfigService.validateSecret(secretValue);

        if (config) {
          // Valid marketplace request
          const userId = request.headers[config.user_header_name] as string;

          request.user = {
            marketplace: config.marketplace_id,
            customerId: userId || 'anonymous',
            tier: 'marketplace',
            authType: 'marketplace-proxy',
          };

          this.logger.log(
            `✅ Authenticated ${config.marketplace_name} request from user: ${userId || 'anonymous'} (IP: ${request.ip})`
          );

          return true;
        } else {
          // Invalid secret for this marketplace
          this.logger.warn(
            `❌ Invalid ${headerName} secret from ${request.ip}`
          );
          throw new UnauthorizedException(
            `Invalid marketplace authentication token`
          );
        }
      }
    }

    // No marketplace headers found - pass through to ApiKeyGuard
    return true;
  }

}
