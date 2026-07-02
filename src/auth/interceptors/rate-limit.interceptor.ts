import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { RedisCacheService } from '../../redis/redis-cache.service';

/**
 * RateLimitInterceptor
 *
 * Enforces tier-based rate limits using Redis token bucket algorithm.
 *
 * IMPORTANT: Rate limiting is SKIPPED for marketplace proxy requests
 * (RapidAPI, AWS Marketplace, Azure Marketplace) as they handle their own
 * rate limiting based on customer subscription plans.
 *
 * Usage:
 *   @UseInterceptors(RateLimitInterceptor)
 *   @Get('/pincodes')
 *   async getPincodes() { ... }
 *
 * Rate Limits by Tier (configurable via environment variables):
 *   FREE:       10 req/min,    100 req/day,   1,000 req/month (RapidAPI standard)
 *   PRO:       100 req/min,  1,000 req/day,  10,000 req/month (10x FREE)
 *   BUSINESS:  500 req/min,  5,000 req/day, 100,000 req/month (100x FREE)
 *   ENTERPRISE: 1,000 req/min, 10,000 req/day, 1,000,000 req/month (1000x FREE, + custom overrides)
 *
 * Algorithm: Token Bucket (sliding window)
 * 1. Check requests in last minute (window: 60 seconds)
 * 2. Check requests in last day (window: 86400 seconds)
 * 3. Check requests in last month (window: 30 days)
 * 4. Reject if any limit exceeded
 * 5. Increment counters if within limits
 *
 * Response Headers:
 *   X-RateLimit-Limit-Minute: 300
 *   X-RateLimit-Remaining-Minute: 245
 *   X-RateLimit-Reset-Minute: 1623456789
 *   X-RateLimit-Limit-Day: 10000
 *   X-RateLimit-Remaining-Day: 8750
 *   X-RateLimit-Reset-Day: 1623456789
 *   X-RateLimit-Limit-Month: 250000
 *   X-RateLimit-Remaining-Month: 187500
 *   X-RateLimit-Reset-Month: 1709740800
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
  requestsPerMonth: number;
}

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);
  private readonly tierLimits: Record<string, RateLimitConfig>;

  constructor(
    private readonly redisCache: RedisCacheService,
    private readonly configService: ConfigService,
  ) {
    // Load rate limits from environment variables with fallback defaults
    // Defaults aligned with RapidAPI standards (FREE = 1000 req/month baseline)
    this.tierLimits = {
      free: {
        requestsPerMinute: this.configService.get<number>('RATE_LIMIT_FREE_PER_MINUTE', 10),
        requestsPerDay: this.configService.get<number>('RATE_LIMIT_FREE_PER_DAY', 100),
        requestsPerMonth: this.configService.get<number>('RATE_LIMIT_FREE_PER_MONTH', 1000),
      },
      pro: {
        requestsPerMinute: this.configService.get<number>('RATE_LIMIT_PRO_PER_MINUTE', 100),
        requestsPerDay: this.configService.get<number>('RATE_LIMIT_PRO_PER_DAY', 1000),
        requestsPerMonth: this.configService.get<number>('RATE_LIMIT_PRO_PER_MONTH', 10000),
      },
      business: {
        requestsPerMinute: this.configService.get<number>('RATE_LIMIT_BUSINESS_PER_MINUTE', 500),
        requestsPerDay: this.configService.get<number>('RATE_LIMIT_BUSINESS_PER_DAY', 5000),
        requestsPerMonth: this.configService.get<number>('RATE_LIMIT_BUSINESS_PER_MONTH', 100000),
      },
      enterprise: {
        requestsPerMinute: this.configService.get<number>('RATE_LIMIT_ENTERPRISE_PER_MINUTE', 1000),
        requestsPerDay: this.configService.get<number>('RATE_LIMIT_ENTERPRISE_PER_DAY', 10000),
        requestsPerMonth: this.configService.get<number>('RATE_LIMIT_ENTERPRISE_PER_MONTH', 1000000),
      },
    };

    this.logger.log('Rate limits configured:');
    Object.entries(this.tierLimits).forEach(([tier, limits]) => {
      this.logger.log(`  ${tier.toUpperCase()}: ${limits.requestsPerMinute} req/min, ${limits.requestsPerDay} req/day, ${limits.requestsPerMonth} req/month`);
    });
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip rate limiting for marketplace proxy requests
    // (RapidAPI, AWS Marketplace, Azure Marketplace handle their own rate limiting)
    if (request.user && request.user.authType === 'marketplace-proxy') {
      this.logger.debug(`Skipping rate limit for ${request.user.marketplace} request - marketplace handles rate limiting`);
      return next.handle();
    }

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

    // Check month-level rate limit
    const monthKey = `ratelimit:${externalCustomerId}:month:${this.getCurrentMonth()}`;
    const monthCount = await this.redisCache.incr(monthKey);

    // Set expiration on first request in this month (30 days = 2,592,000 seconds)
    if (monthCount === 1) {
      await this.redisCache.expire(monthKey, 2592000);
    }

    // Get TTLs for reset timestamps
    const minuteTTL = await this.redisCache.ttl(minuteKey);
    const dayTTL = await this.redisCache.ttl(dayKey);
    const monthTTL = await this.redisCache.ttl(monthKey);

    // Calculate reset times (Unix timestamps)
    const minuteReset = Math.floor(Date.now() / 1000) + minuteTTL;
    const dayReset = Math.floor(Date.now() / 1000) + dayTTL;
    const monthReset = Math.floor(Date.now() / 1000) + monthTTL;

    // Set response headers
    response.setHeader('X-RateLimit-Limit-Minute', limits.requestsPerMinute);
    response.setHeader('X-RateLimit-Remaining-Minute', Math.max(0, limits.requestsPerMinute - minuteCount));
    response.setHeader('X-RateLimit-Reset-Minute', minuteReset);
    response.setHeader('X-RateLimit-Limit-Day', limits.requestsPerDay);
    response.setHeader('X-RateLimit-Remaining-Day', Math.max(0, limits.requestsPerDay - dayCount));
    response.setHeader('X-RateLimit-Reset-Day', dayReset);
    response.setHeader('X-RateLimit-Limit-Month', limits.requestsPerMonth);
    response.setHeader('X-RateLimit-Remaining-Month', Math.max(0, limits.requestsPerMonth - monthCount));
    response.setHeader('X-RateLimit-Reset-Month', monthReset);

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

    if (monthCount > limits.requestsPerMonth) {
      const daysRemaining = Math.ceil(monthTTL / 86400);
      this.logger.warn(`Rate limit exceeded (month) for customer ${externalCustomerId}: ${monthCount}/${limits.requestsPerMonth}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Monthly rate limit exceeded. You can make ${limits.requestsPerMonth} requests per month. Resets in ${daysRemaining} day(s).`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.logger.debug(`Rate limit OK for customer ${externalCustomerId}: ${minuteCount}/${limits.requestsPerMinute} (minute), ${dayCount}/${limits.requestsPerDay} (day), ${monthCount}/${limits.requestsPerMonth} (month)`);

    return next.handle();
  }

  /**
   * Get rate limits for a tier, applying custom overrides if present
   */
  private getRateLimits(tier: string, rateLimitOverrides: any): RateLimitConfig {
    const baseLimits = this.tierLimits[tier.toLowerCase()] || this.tierLimits.free;

    if (rateLimitOverrides) {
      return {
        requestsPerMinute: rateLimitOverrides.requests_per_minute || baseLimits.requestsPerMinute,
        requestsPerDay: rateLimitOverrides.requests_per_day || baseLimits.requestsPerDay,
        requestsPerMonth: rateLimitOverrides.requests_per_month || baseLimits.requestsPerMonth,
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

  /**
   * Get current month as YYYY-MM string for tracking monthly limits
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
