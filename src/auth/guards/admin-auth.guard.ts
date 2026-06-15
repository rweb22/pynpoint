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
 * AdminAuthGuard
 * 
 * Protects admin endpoints with a shared secret.
 * Used by the main website to provision and manage API keys.
 * 
 * Usage:
 *   @UseGuards(AdminAuthGuard)
 *   @Post('/admin/api-keys')
 *   async createApiKey() { ... }
 * 
 * Authentication:
 *   X-Admin-Secret: <ADMIN_API_SECRET from env>
 * 
 * Security:
 * - Shared secret between PinPoint API and main website
 * - Should be a cryptographically secure random string (32+ bytes)
 * - Must be transmitted over HTTPS only
 * - Rotate periodically for best security
 * 
 * Flow:
 * 1. Extract secret from X-Admin-Secret header
 * 2. Compare with ADMIN_API_SECRET environment variable
 * 3. Reject if missing or incorrect (constant-time comparison)
 * 
 * Note: This is NOT for end-user authentication!
 * End users authenticate with API keys (ApiKeyGuard).
 */
@Injectable()
export class AdminAuthGuard implements CanActivate {
  private readonly logger = new Logger(AdminAuthGuard.name);
  private readonly adminSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('ADMIN_API_SECRET');

    if (!secret) {
      this.logger.warn('ADMIN_API_SECRET is not configured! Admin endpoints will be inaccessible.');
      // Don't throw - allow app to start, but admin endpoints will fail at runtime
      this.adminSecret = '';
    } else {
      this.adminSecret = secret;
      this.logger.log('AdminAuthGuard initialized with secret');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // Check if admin secret is configured
    if (!this.adminSecret) {
      this.logger.error('Admin endpoint accessed but ADMIN_API_SECRET is not configured');
      throw new UnauthorizedException('Admin endpoints are not configured. Contact the API administrator.');
    }

    // Extract admin secret from X-Admin-Secret header
    const providedSecret = request.headers['x-admin-secret'] as string;

    if (!providedSecret) {
      this.logger.warn(`Admin endpoint accessed without X-Admin-Secret header from ${request.ip}`);
      throw new UnauthorizedException('Admin authentication required. Please provide X-Admin-Secret header.');
    }

    // Constant-time comparison to prevent timing attacks
    if (!this.constantTimeCompare(providedSecret, this.adminSecret)) {
      this.logger.warn(`Invalid admin secret from ${request.ip}`);
      throw new UnauthorizedException('Invalid admin credentials.');
    }

    this.logger.debug(`Admin request authenticated from ${request.ip}`);

    return true;
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * 
   * @param a - First string
   * @param b - Second string
   * @returns true if strings are equal
   */
  private constantTimeCompare(a: string, b: string): boolean {
    // If lengths differ, still compare to avoid timing leak
    const aLength = Buffer.byteLength(a);
    const bLength = Buffer.byteLength(b);
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);

    // Always compare full length (use longer length)
    const maxLength = Math.max(aLength, bLength);
    let result = aLength === bLength ? 0 : 1;

    for (let i = 0; i < maxLength; i++) {
      // Use XOR to compare bytes (avoids short-circuit)
      result |= (bufferA[i % aLength] || 0) ^ (bufferB[i % bLength] || 0);
    }

    return result === 0;
  }
}
