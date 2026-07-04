import { applyDecorators } from '@nestjs/common';

/**
 * Swagger decorator for rate limit response headers
 *
 * DEPRECATED: This decorator incorrectly uses @ApiHeader which creates REQUEST parameters
 * instead of documenting RESPONSE headers. Removed to clean up OpenAPI spec for RapidAPI.
 *
 * Rate limit headers (X-RateLimit-*) are still returned by the API in responses,
 * they're just not documented in the OpenAPI spec anymore.
 *
 * See: pynpoint/docs/api/RATE_LIMITING.md for rate limit documentation
 */
export function ApiRateLimitHeaders() {
  // Return empty decorator - rate limit headers are response headers
  // and should be documented differently if needed
  return applyDecorators();
}
