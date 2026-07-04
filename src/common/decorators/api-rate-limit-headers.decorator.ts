import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

/**
 * Swagger decorator for rate limit response headers
 * 
 * Applies to all authenticated endpoints that use Token Bucket rate limiting.
 * Documents the X-RateLimit-* headers returned by the API.
 */
export function ApiRateLimitHeaders() {
  return applyDecorators(
    ApiHeader({
      name: 'X-RateLimit-Limit',
      description: 'Maximum requests per minute for your tier',
      required: false,
      schema: {
        type: 'integer',
        example: 100,
      },
    }),
    ApiHeader({
      name: 'X-RateLimit-Remaining',
      description: 'Number of requests remaining in current minute',
      required: false,
      schema: {
        type: 'integer',
        example: 95,
      },
    }),
    ApiHeader({
      name: 'X-RateLimit-Reset',
      description: 'Unix timestamp (seconds) when the rate limit resets',
      required: false,
      schema: {
        type: 'integer',
        example: 1678901234,
      },
    }),
  );
}
