import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * MarketplaceProxyGuard
 * 
 * Validates requests from API marketplace platforms (RapidAPI, AWS Marketplace, etc.)
 * If valid marketplace headers are present, authenticates the request and skips ApiKeyGuard.
 * If no marketplace headers, passes through to ApiKeyGuard.
 * 
 * Supported Marketplaces:
 * - RapidAPI (X-RapidAPI-Proxy-Secret, X-RapidAPI-User)
 * - AWS Marketplace (future: X-AWS-Marketplace-Token)
 * - Azure Marketplace (future: X-Azure-Marketplace-Token)
 * 
 * Environment Variables:
 * - RAPIDAPI_PROXY_SECRET: Secret from RapidAPI dashboard
 * - RAPIDAPI_ENABLED: Enable/disable RapidAPI authentication
 * - AWS_MARKETPLACE_ENABLED: Enable/disable AWS Marketplace (future)
 * - AZURE_MARKETPLACE_ENABLED: Enable/disable Azure Marketplace (future)
 * 
 * Flow:
 * 1. Check for marketplace headers (RapidAPI, AWS, Azure, etc.)
 * 2. If present, validate the secret
 * 3. If valid, attach user info to request and return true (authenticated)
 * 4. If no marketplace headers, return true (pass through to ApiKeyGuard)
 * 5. If invalid marketplace headers, throw 401
 * 
 * Request Enhancement (on successful marketplace auth):
 *   - request.user.marketplace: 'rapidapi' | 'aws' | 'azure'
 *   - request.user.customerId: marketplace customer ID
 *   - request.user.tier: 'marketplace' (marketplace handles their own tiers)
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

  constructor(private readonly configService: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Try RapidAPI authentication
    const rapidApiResult = this.validateRapidAPI(request);
    if (rapidApiResult !== null) {
      return rapidApiResult;
    }

    // Try AWS Marketplace authentication (future)
    // const awsResult = this.validateAWSMarketplace(request);
    // if (awsResult !== null) {
    //   return awsResult;
    // }

    // Try Azure Marketplace authentication (future)
    // const azureResult = this.validateAzureMarketplace(request);
    // if (azureResult !== null) {
    //   return azureResult;
    // }

    // No marketplace headers found - pass through to ApiKeyGuard
    return true;
  }

  /**
   * Validate RapidAPI proxy request
   * 
   * @param request - Express request
   * @returns true if valid, false if invalid headers present, null if no RapidAPI headers
   */
  private validateRapidAPI(request: Request): boolean | null {
    const proxySecret = request.headers['x-rapidapi-proxy-secret'] as string;
    const rapidApiUser = request.headers['x-rapidapi-user'] as string;

    // No RapidAPI headers - not a RapidAPI request
    if (!proxySecret) {
      return null;
    }

    // Check if RapidAPI is enabled
    const enabled = this.configService.get<boolean>('RAPIDAPI_ENABLED', false);
    if (!enabled) {
      this.logger.warn('RapidAPI headers present but RAPIDAPI_ENABLED=false');
      throw new UnauthorizedException('RapidAPI integration is not enabled');
    }

    // Validate the proxy secret
    const expectedSecret = this.configService.get<string>('RAPIDAPI_PROXY_SECRET');
    if (!expectedSecret) {
      this.logger.error('RAPIDAPI_PROXY_SECRET not configured but RAPIDAPI_ENABLED=true');
      throw new UnauthorizedException('RapidAPI is misconfigured');
    }

    if (proxySecret !== expectedSecret) {
      this.logger.warn(
        `Invalid RapidAPI proxy secret from ${request.ip}. ` +
        `Expected: ${expectedSecret.substring(0, 10)}..., ` +
        `Got: ${proxySecret.substring(0, 10)}...`
      );
      throw new UnauthorizedException('Invalid RapidAPI proxy secret');
    }

    // Valid RapidAPI request - attach user info
    request.user = {
      marketplace: 'rapidapi',
      customerId: rapidApiUser || 'anonymous',
      tier: 'marketplace',
      authType: 'marketplace-proxy',
    };

    this.logger.log(
      `Authenticated RapidAPI request from user: ${rapidApiUser || 'anonymous'} (IP: ${request.ip})`
    );

    return true;
  }

  /**
   * Validate AWS Marketplace request (future implementation)
   * 
   * @param request - Express request
   * @returns true if valid, false if invalid headers present, null if no AWS headers
   */
  // private validateAWSMarketplace(request: Request): boolean | null {
  //   const marketplaceToken = request.headers['x-aws-marketplace-token'] as string;
  //   
  //   if (!marketplaceToken) {
  //     return null;
  //   }
  //   
  //   // AWS Marketplace token validation logic here
  //   // ...
  //   
  //   return true;
  // }
}
