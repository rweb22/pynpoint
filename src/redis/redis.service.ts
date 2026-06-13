import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisService
 * 
 * Wrapper around ioredis client with lifecycle management.
 * 
 * Features:
 * - Automatic connection on module init
 * - Graceful disconnection on shutdown
 * - Error handling and reconnection
 * - Pipeline support for bulk operations
 * 
 * Usage:
 * ```typescript
 * // Single operations
 * await this.redisService.set('key', 'value');
 * const value = await this.redisService.get('key');
 * 
 * // Bulk operations with pipeline
 * const pipeline = this.redisService.pipeline();
 * pipeline.set('key1', 'value1');
 * pipeline.set('key2', 'value2');
 * await pipeline.exec();
 * 
 * // Sets (for H3 index)
 * await this.redisService.sadd('h3:89283082837ffff', '110001');
 * const pincodes = await this.redisService.smembers('h3:89283082837ffff');
 * ```
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
    
    this.logger.log(`Connecting to Redis: ${redisUrl}`);

    this.client = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Redis connection retry #${times}, delay: ${delay}ms`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    this.client.on('connect', () => {
      this.logger.log('✅ Redis connected');
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis error:', err);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('Redis reconnecting...');
    });

    // Wait for ready
    await this.client.ping();
    this.logger.log('✅ Redis ready');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting from Redis...');
    await this.client.quit();
    this.logger.log('✅ Redis disconnected');
  }

  /**
   * Get the underlying ioredis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Create a pipeline for bulk operations
   */
  pipeline(): ReturnType<Redis['pipeline']> {
    return this.client.pipeline();
  }

  // Delegate common operations to the client
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string | number, expiryMode?: 'EX', time?: number): Promise<'OK'> {
    if (expiryMode && time) {
      return this.client.set(key, value, expiryMode, time);
    }
    return this.client.set(key, value);
  }

  async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async scard(key: string): Promise<number> {
    return this.client.scard(key);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async flushdb(): Promise<'OK'> {
    return this.client.flushdb();
  }

  async exists(...keys: string[]): Promise<number> {
    return this.client.exists(...keys);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
