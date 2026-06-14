import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response } from 'express';
import { ApiUsage } from '../../database/entities/api-usage.entity';

/**
 * UsageTrackingInterceptor
 * 
 * Tracks API usage for analytics, billing, and monitoring.
 * Aggregates usage by day in the api_usage table.
 * 
 * Usage:
 *   @UseInterceptors(UsageTrackingInterceptor)
 *   @Get('/pincodes')
 *   async getPincodes() { ... }
 * 
 * Tracked Metrics:
 * - Total requests per day
 * - Success count (2xx responses)
 * - Error count (4xx, 5xx responses)
 * - Total response time (for average calculation)
 * 
 * Database Schema (api_usage):
 *   - external_customer_id: Customer ID from main website
 *   - date: YYYY-MM-DD
 *   - endpoint: API endpoint path
 *   - request_count: Total requests
 *   - success_count: 2xx responses
 *   - error_count: 4xx/5xx responses
 *   - avg_response_time_ms: Average response time
 *   - status_codes: Distribution of HTTP status codes
 * 
 * Performance:
 * - Fire-and-forget (doesn't block response)
 * - Uses UPSERT (INSERT ON CONFLICT DO UPDATE)
 * - Aggregates daily (reduces DB writes)
 * 
 * Analytics Queries:
 *   -- Daily usage for a customer
 *   SELECT date, request_count, success_count
 *   FROM api_usage
 *   WHERE api_key_id IN (SELECT id FROM api_keys WHERE external_customer_id = 'cust_123')
 *   ORDER BY date DESC;
 * 
 *   -- Average response time
 *   SELECT date, total_response_time_ms / request_count AS avg_response_time
 *   FROM api_usage;
 */
@Injectable()
export class UsageTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(UsageTrackingInterceptor.name);

  constructor(
    @InjectRepository(ApiUsage)
    private readonly apiUsageRepository: Repository<ApiUsage>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Skip tracking if no API key (guard will reject anyway)
    if (!request.apiKey) {
      return next.handle();
    }

    const startTime = Date.now();
    const { externalCustomerId } = request.apiKey;
    const endpoint = request.route?.path || request.path;

    return next.handle().pipe(
      tap({
        next: () => {
          // Success (2xx response)
          const responseTime = Date.now() - startTime;
          this.trackUsage(externalCustomerId, endpoint, response.statusCode, responseTime);
        },
        error: (error) => {
          // Error (4xx/5xx response)
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;
          this.trackUsage(externalCustomerId, endpoint, statusCode, responseTime);
        },
      }),
    );
  }

  /**
   * Track usage in database (fire-and-forget)
   *
   * Uses UPSERT to aggregate daily usage:
   * - If record exists for today, increment counters
   * - If record doesn't exist, create new record
   *
   * @param externalCustomerId - Customer ID from main website
   * @param endpoint - API endpoint path
   * @param statusCode - HTTP status code
   * @param responseTimeMs - Response time in milliseconds
   */
  private async trackUsage(
    externalCustomerId: string,
    endpoint: string,
    statusCode: number,
    responseTimeMs: number,
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      const isSuccess = statusCode >= 200 && statusCode < 300;
      const isError = statusCode >= 400;

      // Find existing record
      const existing = await this.apiUsageRepository.findOne({
        where: {
          external_customer_id: externalCustomerId,
          date: new Date(today),
          endpoint: endpoint,
        },
      });

      if (existing) {
        // Update existing record
        existing.request_count += 1;
        if (isSuccess) existing.success_count += 1;
        if (isError) existing.error_count += 1;

        // Update running average for response time
        const totalRequests = existing.request_count;
        const currentAvg = existing.avg_response_time_ms;
        existing.avg_response_time_ms =
          (currentAvg * (totalRequests - 1) + responseTimeMs) / totalRequests;

        // Update status code distribution
        const statusKey = statusCode.toString();
        if (!existing.status_codes) existing.status_codes = {};
        existing.status_codes[statusKey] = (existing.status_codes[statusKey] || 0) + 1;

        await this.apiUsageRepository.save(existing);
      } else {
        // Create new record
        const newUsage = this.apiUsageRepository.create({
          external_customer_id: externalCustomerId,
          date: new Date(today),
          endpoint: endpoint,
          request_count: 1,
          success_count: isSuccess ? 1 : 0,
          error_count: isError ? 1 : 0,
          avg_response_time_ms: responseTimeMs,
          status_codes: { [statusCode.toString()]: 1 },
          metadata: null,
        });

        await this.apiUsageRepository.save(newUsage);
      }

      this.logger.debug(
        `Tracked usage for customer ${externalCustomerId} on ${endpoint}: ${statusCode} (${responseTimeMs}ms)`,
      );
    } catch (error) {
      // Don't throw - tracking failures shouldn't affect the response
      this.logger.error(
        `Failed to track usage for customer ${externalCustomerId}:`,
        error.message,
      );
    }
  }
}
