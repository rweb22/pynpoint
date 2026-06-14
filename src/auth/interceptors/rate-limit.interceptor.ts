import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { RedisCacheService } from '../../redis/redis-cache.service';

/**
 * RateLimitInterceptor
 * 
 * Enforces tier-based rate limits using Redis token bucket algorithm.
 * 
 * Usage:
 *   @UseInterceptors(RateLimitInterceptor)
 *   @Get('/pincodes')
 *   async getPincodes() { ... }
 * 
 * Rate Limits by Tier (configurable):
 *   FREE:       60 req/min,  1,000 req/day
 *   PRO:       300 req/min, 10,000 req/day
 *   BUSINESS:  600 req/min, 50,000 req/day
 *   ENTERPRISE: Custom limits (from rate_limit_overrides)
 * 
 * Algorithm: Token Bucket (sliding window)
 * 1. Check requests in last minute (window: 60 seconds)
 * 2. Check requests in last day (window: 86400 seconds)
 * 3. Reject if either limit exceeded
 * 4. Increment counter if within limits
 * 
 * Response Headers:
 *   X-RateLimit-Limit-Minute: 60
 *   X-RateLimit-Remaining-Minute: 45
 *   X-RateLimit-Reset-Minute: 1623456789
 *   X-RateLimit-Limit-Day: 1000
 *   X-RateLimit-Remaining-Day: 850
 *   X-RateLimit-Reset-Day: 1623456789
 * 
 * Error Response (429 Too Many Requests):
 *   {
 *     "statusCode": 429,
 *     "message": "Rate limit exceeded. Try again in 45 seconds.",
 *     "error": "Too Many Requests"
 *   }
 */

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
}

const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    requestsPerMinute: 60,
    requestsPerDay: 1000,
  },
  pro: {
    requestsPerMinute: 300,
    requestsPerDay: 10000,
  },
  business: {
    requestsPerMinute: 600,
    requestsPerDay: 50000,
  },
  enterprise: {
    requestsPerMinute: 1000, // Default, can be overridden
    requestsPerDay: 100000, // Default, can be overridden
  },
};

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);

  constructor(private readonly redisCache: RedisCacheService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip rate limiting if no API key (guard will reject anyway)
    if (!request.apiKey) {
      return next.handle();
    }

    const { externalCustomerId, tier, rateLimitOverrides } = request.apiKey;

    // Get rate limits for tier (with overrides)
    const limits = this.getRateLimits(tier, rateLimitOverrides);

    // Check minute-level rate limit
    const minuteKey = `ratelimit:${externalCustomerId}:minute:${this.getCurrentMinute()}`;
    const minuteCount = await this.redisCache.incr(minuteKey);

    // Set expiration on first request in this minute
    if (minuteCount === 1) {
      await this.redisCache.expire(minuteKey, 60);
    }

    // Check day-level rate limit
    const dayKey = `ratelimit:${externalCustomerId}:day:${this.getCurrentDay()}`;
    const dayCount = await this.redisCache.incr(dayKey);

    // Set expiration on first request in this day
    if (dayCount === 1) {
      await this.redisCache.expire(dayKey, 86400);
    }

    // Get TTLs for reset timestamps
    const minuteTTL = await this.redisCache.ttl(minuteKey);
    const dayTTL = await this.redisCache.ttl(dayKey);

    // Calculate reset times (Unix timestamps)
    const minuteReset = Math.floor(Date.now() / 1000) + minuteTTL;
    const dayReset = Math.floor(Date.now() / 1000) + dayTTL;

    // Set response headers
    response.setHeader('X-RateLimit-Limit-Minute', limits.requestsPerMinute);
    response.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, limits.requestsPerMinute - minuteCount));
    response.setHeader('X-RateLimit-Reset-Minute', minuteReset);
    response.setHeader('X-RateLimit-Limit-Day', limits.requestsPerDay);
    response.setHeader('X-RateLimit-Remaining-Day', Math.max(0, limits.requestsPerDay - dayCount));
    response.setHeader('X-RateLimit-Reset-Day', dayReset);

    // Check if rate limit exceeded
    if (minuteCount > limits.requestsPerMinute) {
      this.logger.warn(`Rate limit exceeded (minute) for customer ${externalCustomerId}: ${minuteCount}/${limits.requestsPerMinute}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Rate limit exceeded. You can make ${limits.requestsPerMinute} requests per minute. Try again in ${minuteTTL} seconds.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (dayCount > limits.requestsPerDay) {
      this.logger.warn(`Rate limit exceeded (day) for customer ${externalCustomerId}: ${dayCount}/${limits.requestsPerDay}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Daily rate limit exceeded. You can make ${limits.requestsPerDay} requests per day. Try again tomorrow.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(`Rate limit OK for customer ${externalCustomerId}: ${minuteCount}/${limits.requestsPerMinute} (minute), ${dayCount}/${limits.requestsPerDay} (day)`);

    return next.handle();
  }

  /**
   * Get rate limits for a tier, applying custom overrides if present
   */
  private getRateLimits(tier: string, rateLimitOverrides: any): RateLimitConfig {
    const baseLimits = TIER_LIMITS[tier.toLowerCase()] || TIER_LIMITS.free;

    if (rateLimitOverrides) {
      return {
        requestsPerMinute: rateLimitOverrides.requests_per_minute || baseLimits.requestsPerMinute,
        requestsPerDay: rateLimitOverrides.requests_per_day || baseLimits.requestsPerDay,
      };
    }

    return baseLimits;
  }

  /**
   * Get current minute as Unix timestamp (rounded down to minute)
   */
  private getCurrentMinute(): number {
    return Math.floor(Date.now() / 1000 / 60);
  }

  /**
   * Get current day as Unix timestamp (rounded down to day)
   */
  private getCurrentDay(): number {
    return Math.floor(Date.now() / 1000 / 86400);
  }
}
