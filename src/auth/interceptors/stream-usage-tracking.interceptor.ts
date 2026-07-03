import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { UsageStreamsService } from '../../redis/usage-streams.service';

/**
 * StreamUsageTrackingInterceptor
 * 
 * High-performance usage tracking using Redis Streams.
 * 
 * Architecture:
 * - HOT PATH: Append events to Redis Streams (~1ms, fire-and-forget)
 * - COLD PATH: Background worker consumes streams and batches to PostgreSQL
 * 
 * Benefits:
 * - Zero database connections on hot path
 * - Handles millions of events per second
 * - Complete usage data preserved
 * - Non-blocking (doesn't slow down requests)
 * 
 * Performance:
 * - Before: 3 DB operations per request (READ + WRITE + UPDATE)
 * - After: 2 Redis XADD operations (~2ms total)
 * - No DB connection pool exhaustion
 * 
 * Tracked Metrics:
 * - Total requests per day (for billing/analytics)
 * - Success count (2xx responses)
 * - Error count (4xx, 5xx responses)
 * - Response time distribution
 * - Status code distribution
 * 
 * Background Worker:
 * - Reads events every 60 seconds
 * - Aggregates by (customer, date, endpoint)
 * - Bulk writes to api_usage table
 */

@Injectable()
export class StreamUsageTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StreamUsageTrackingInterceptor.name);

  constructor(private readonly usageStreams: UsageStreamsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip tracking if no API key
    if (!request.apiKey) {
      return next.handle();
    }

    const startTime = Date.now();
    const { externalCustomerId, keyId } = request.apiKey;
    const endpoint = request.route?.path || request.path;

    return next.handle().pipe(
      tap({
        next: () => {
          // Success (2xx response)
          const responseTime = Date.now() - startTime;
          this.trackUsage(externalCustomerId, keyId, endpoint, response.statusCode, responseTime);
        },
        error: (error) => {
          // Error (4xx/5xx response)
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;
          this.trackUsage(externalCustomerId, keyId, endpoint, statusCode, responseTime);
        },
      }),
    );
  }

  /**
   * Track usage by logging to Redis Streams
   * 
   * Fire-and-forget, non-blocking operations:
   * 1. Log usage event → api_usage_events stream
   * 2. Log last seen → api_key_last_seen stream
   * 
   * Background worker will consume these and persist to PostgreSQL
   */
  private async trackUsage(
    externalCustomerId: string,
    keyId: string,
    endpoint: string,
    statusCode: number,
    responseTimeMs: number,
  ): Promise<void> {
    try {
      // Log usage event to stream (for billing/analytics)
      await this.usageStreams.logUsage({
        customerId: externalCustomerId,
        endpoint,
        statusCode,
        responseTimeMs,
      });

      // Log last seen event (for API key last_used_at)
      await this.usageStreams.logLastSeen({
        apiKeyId: keyId,
        customerId: externalCustomerId,
      });

      this.logger.debug(
        `Tracked usage for ${externalCustomerId} on ${endpoint}: ${statusCode} (${responseTimeMs}ms)`
      );
    } catch (error) {
      // Don't throw - tracking failures shouldn't affect the response
      this.logger.error(`Failed to track usage for ${externalCustomerId}:`, error);
    }
  }
}
