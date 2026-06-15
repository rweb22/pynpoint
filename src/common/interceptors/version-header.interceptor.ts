import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * VersionHeaderInterceptor
 * 
 * Adds API versioning metadata to all HTTP responses.
 * 
 * Headers Added:
 * - X-API-Version: Current API version (e.g., "v1")
 * - X-API-Stability: API stability level ("stable", "beta", "deprecated")
 * - X-API-Deprecated: Whether this version is deprecated ("true" or "false")
 * - X-API-Deprecation-Date: ISO date when version was deprecated (if applicable)
 * - X-API-Sunset-Date: ISO date when version will be removed (if deprecated)
 * - X-API-Migration-Guide: URL to migration documentation (if deprecated)
 * 
 * Usage:
 * Apply globally in AppModule or per-controller basis.
 * 
 * @example
 * // Global registration in main.ts
 * app.useGlobalInterceptors(new VersionHeaderInterceptor());
 * 
 * // Or per-controller
 * @Controller()
 * @UseInterceptors(VersionHeaderInterceptor)
 * export class MyController {}
 */
@Injectable()
export class VersionHeaderInterceptor implements NestInterceptor {
  // Configuration - Update these when deprecating versions
  private readonly API_VERSION = 'v1';
  private readonly API_STABILITY: 'stable' | 'beta' | 'deprecated' = 'stable';
  private readonly IS_DEPRECATED = false;
  
  // Only set these when deprecating
  private readonly DEPRECATION_DATE: string | null = null; // ISO date: "2026-01-01"
  private readonly SUNSET_DATE: string | null = null;      // ISO date: "2027-01-01"
  private readonly MIGRATION_GUIDE_URL: string | null = null; // "https://docs.pinpoint.in/migration/v1-to-v2"

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        
        // Always add these headers
        response.setHeader('X-API-Version', this.API_VERSION);
        response.setHeader('X-API-Stability', this.API_STABILITY);
        response.setHeader('X-API-Deprecated', this.IS_DEPRECATED.toString());
        
        // Add deprecation headers if applicable
        if (this.IS_DEPRECATED) {
          if (this.DEPRECATION_DATE) {
            response.setHeader('X-API-Deprecation-Date', this.DEPRECATION_DATE);
          }
          
          if (this.SUNSET_DATE) {
            response.setHeader('X-API-Sunset-Date', this.SUNSET_DATE);
          }
          
          if (this.MIGRATION_GUIDE_URL) {
            response.setHeader('X-API-Migration-Guide', this.MIGRATION_GUIDE_URL);
          }
        }
      }),
    );
  }
}
