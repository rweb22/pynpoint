import { Injectable, Logger } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';

/**
 * UsageStreamsService
 * 
 * High-performance usage tracking using Redis Streams.
 * 
 * Architecture:
 * - HOT PATH: Append events to Redis Streams (non-blocking, ~1ms)
 * - COLD PATH: Background worker consumes streams and batches to PostgreSQL
 * 
 * Benefits:
 * - Zero database writes on hot path
 * - Complete usage data preserved
 * - Handles millions of events per second
 * - Automatic retry and persistence (Redis Streams are AOF/RDB persisted)
 * 
 * Redis Streams:
 * - api_usage_events: All API requests (for billing/analytics)
 * - rate_limit_violations: Rate limit exceeded events (for monitoring/alerts)
 * - api_key_last_seen: Last usage timestamps (for dashboard)
 * 
 * Stream Structure:
 *   XADD api_usage_events * customer cust_123 endpoint /pincodes status 200 timestamp 1234567890
 * 
 * Background Worker:
 * - Reads 10,000 events per batch
 * - Aggregates in memory
 * - Bulk writes to PostgreSQL (COPY or multi-row INSERT)
 * - Runs every 60 seconds
 */

export interface UsageEvent {
  customerId: string;
  endpoint: string;
  statusCode: number;
  responseTimeMs: number;
  timestamp?: number; // Optional, defaults to Date.now()
}

export interface RateLimitViolation {
  customerId: string;
  endpoint: string;
  limit: number;
  retryAfterSeconds: number;
  timestamp?: number;
}

export interface LastSeenEvent {
  apiKeyId: string;
  customerId: string;
  timestamp?: number;
}

@Injectable()
export class UsageStreamsService {
  private readonly logger = new Logger(UsageStreamsService.name);

  // Redis Stream keys
  private readonly USAGE_STREAM = 'api_usage_events';
  private readonly VIOLATIONS_STREAM = 'rate_limit_violations';
  private readonly LAST_SEEN_STREAM = 'api_key_last_seen';

  constructor(private readonly redisCache: RedisCacheService) {}

  /**
   * Log API usage event to Redis Stream
   * 
   * Fire-and-forget, non-blocking operation.
   * Background worker will consume and persist to PostgreSQL.
   * 
   * @param event - Usage event details
   */
  async logUsage(event: UsageEvent): Promise<void> {
    try {
      const client = this.redisCache.getClient();
      const timestamp = event.timestamp || Date.now();

      await client.xadd(
        this.USAGE_STREAM,
        '*', // Auto-generate ID (timestamp-sequence)
        'customer', event.customerId,
        'endpoint', event.endpoint,
        'status', String(event.statusCode),
        'responseTime', String(event.responseTimeMs),
        'timestamp', String(timestamp),
      );

      this.logger.debug(`Logged usage event for ${event.customerId} (${event.endpoint})`);
    } catch (error) {
      // Don't throw - usage tracking failures shouldn't affect request
      this.logger.error('Failed to log usage event:', error);
    }
  }

  /**
   * Log rate limit violation to Redis Stream
   * 
   * These events are processed immediately by background worker
   * for real-time alerts and monitoring.
   * 
   * @param violation - Rate limit violation details
   */
  async logViolation(violation: RateLimitViolation): Promise<void> {
    try {
      const client = this.redisCache.getClient();
      const timestamp = violation.timestamp || Date.now();

      await client.xadd(
        this.VIOLATIONS_STREAM,
        '*',
        'customer', violation.customerId,
        'endpoint', violation.endpoint,
        'limit', String(violation.limit),
        'retryAfter', String(violation.retryAfterSeconds),
        'timestamp', String(timestamp),
      );

      this.logger.warn(`Rate limit violation: ${violation.customerId} on ${violation.endpoint}`);
    } catch (error) {
      this.logger.error('Failed to log rate limit violation:', error);
    }
  }

  /**
   * Log API key last seen timestamp to Redis Stream
   * 
   * Background worker batches these and updates last_used_at
   * every 60 seconds instead of on every request.
   * 
   * @param event - Last seen event details
   */
  async logLastSeen(event: LastSeenEvent): Promise<void> {
    try {
      const client = this.redisCache.getClient();
      const timestamp = event.timestamp || Date.now();

      await client.xadd(
        this.LAST_SEEN_STREAM,
        '*',
        'keyId', event.apiKeyId,
        'customer', event.customerId,
        'timestamp', String(timestamp),
      );

      this.logger.debug(`Logged last seen for API key ${event.apiKeyId}`);
    } catch (error) {
      this.logger.error('Failed to log last seen event:', error);
    }
  }

  /**
   * Read usage events from stream (for background worker)
   *
   * @param lastId - Last processed event ID (use '0' for first read)
   * @param count - Max events to read (default: 10000)
   * @returns Array of events with their IDs
   */
  async readUsageEvents(lastId: string = '0', count: number = 10000): Promise<Array<{ id: string; data: UsageEvent }>> {
    try {
      const client = this.redisCache.getClient();
      const result = await client.xread('COUNT', count, 'STREAMS', this.USAGE_STREAM, lastId);

      if (!result || result.length === 0) {
        return [];
      }

      // Parse Redis Stream response
      // Format: [[stream_name, [[id, [field1, value1, field2, value2, ...]]]]]
      const [, messages] = result[0];
      return messages.map(([id, fields]: [string, string[]]) => ({
        id,
        data: this.parseUsageEvent(fields),
      }));
    } catch (error) {
      this.logger.error('Failed to read usage events:', error);
      return [];
    }
  }

  /**
   * Read rate limit violations from stream
   */
  async readViolations(lastId: string = '0', count: number = 10000): Promise<Array<{ id: string; data: RateLimitViolation }>> {
    try {
      const client = this.redisCache.getClient();
      const result = await client.xread('COUNT', count, 'STREAMS', this.VIOLATIONS_STREAM, lastId);

      if (!result || result.length === 0) {
        return [];
      }

      const [, messages] = result[0];
      return messages.map(([id, fields]: [string, string[]]) => ({
        id,
        data: this.parseViolationEvent(fields),
      }));
    } catch (error) {
      this.logger.error('Failed to read violation events:', error);
      return [];
    }
  }

  /**
   * Read last seen events from stream
   */
  async readLastSeenEvents(lastId: string = '0', count: number = 10000): Promise<Array<{ id: string; data: LastSeenEvent }>> {
    try {
      const client = this.redisCache.getClient();
      const result = await client.xread('COUNT', count, 'STREAMS', this.LAST_SEEN_STREAM, lastId);

      if (!result || result.length === 0) {
        return [];
      }

      const [, messages] = result[0];
      return messages.map(([id, fields]: [string, string[]]) => ({
        id,
        data: this.parseLastSeenEvent(fields),
      }));
    } catch (error) {
      this.logger.error('Failed to read last seen events:', error);
      return [];
    }
  }

  /**
   * Acknowledge/delete processed events from stream
   *
   * @param streamKey - Stream name
   * @param ids - Event IDs to delete
   */
  async deleteEvents(streamKey: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    try {
      const client = this.redisCache.getClient();
      await client.xdel(streamKey, ...ids);
      this.logger.debug(`Deleted ${ids.length} events from ${streamKey}`);
    } catch (error) {
      this.logger.error(`Failed to delete events from ${streamKey}:`, error);
    }
  }

  /**
   * Get stream statistics (for monitoring)
   */
  async getStreamStats(): Promise<{ usage: number; violations: number; lastSeen: number }> {
    try {
      const client = this.redisCache.getClient();
      const [usageLen, violationsLen, lastSeenLen] = await Promise.all([
        client.xlen(this.USAGE_STREAM),
        client.xlen(this.VIOLATIONS_STREAM),
        client.xlen(this.LAST_SEEN_STREAM),
      ]);

      return {
        usage: usageLen,
        violations: violationsLen,
        lastSeen: lastSeenLen,
      };
    } catch (error) {
      this.logger.error('Failed to get stream stats:', error);
      return { usage: 0, violations: 0, lastSeen: 0 };
    }
  }

  // Helper methods to parse stream data
  private parseUsageEvent(fields: string[]): UsageEvent {
    const data: any = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return {
      customerId: data.customer,
      endpoint: data.endpoint,
      statusCode: parseInt(data.status, 10),
      responseTimeMs: parseInt(data.responseTime, 10),
      timestamp: parseInt(data.timestamp, 10),
    };
  }

  private parseViolationEvent(fields: string[]): RateLimitViolation {
    const data: any = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return {
      customerId: data.customer,
      endpoint: data.endpoint,
      limit: parseInt(data.limit, 10),
      retryAfterSeconds: parseInt(data.retryAfter, 10),
      timestamp: parseInt(data.timestamp, 10),
    };
  }

  private parseLastSeenEvent(fields: string[]): LastSeenEvent {
    const data: any = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return {
      apiKeyId: data.keyId,
      customerId: data.customer,
      timestamp: parseInt(data.timestamp, 10),
    };
  }
}
