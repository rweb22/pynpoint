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

    // Verify persistence configuration
    await this.verifyPersistence();
  }

  /**
   * Verify Redis persistence is configured to prevent data loss
   * Logs warnings if persistence is disabled
   */
  private async verifyPersistence(): Promise<void> {
    try {
      // Check RDB (snapshot) persistence
      const saveConfig = (await this.client.config('GET', 'save')) as [string, string];
      const rdbEnabled = saveConfig[1] !== '';

      // Check AOF (append-only file) persistence
      const aofConfig = (await this.client.config('GET', 'appendonly')) as [string, string];
      const aofEnabled = aofConfig[1] === 'yes';

      // Get persistence info
      const info = await this.client.info('persistence');
      const lines = info.split('\r\n');
      const persistenceInfo: Record<string, string> = {};

      for (const line of lines) {
        const [key, value] = line.split(':');
        if (key && value) {
          persistenceInfo[key.trim()] = value.trim();
        }
      }

      // Log persistence status
      if (rdbEnabled || aofEnabled) {
        this.logger.log('✅ Redis persistence enabled');
        if (rdbEnabled) {
          this.logger.log(`   RDB: ${saveConfig[1]}`);
          if (persistenceInfo['rdb_last_save_time']) {
            const lastSave = new Date(parseInt(persistenceInfo['rdb_last_save_time']) * 1000);
            this.logger.log(`   Last RDB save: ${lastSave.toISOString()}`);
          }
        }
        if (aofEnabled) {
          this.logger.log(`   AOF: enabled (${aofConfig[1]})`);
          if (persistenceInfo['aof_current_size']) {
            const sizeBytes = parseInt(persistenceInfo['aof_current_size']);
            const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
            this.logger.log(`   AOF size: ${sizeMB} MB`);
          }
        }
      } else {
        this.logger.warn('⚠️  Redis persistence is DISABLED!');
        this.logger.warn('   Data will be lost on Redis restart.');
        this.logger.warn('   See docs/architecture/REDIS_PERSISTENCE_GUIDE.md for configuration.');
      }
    } catch (error) {
      this.logger.error('Failed to verify Redis persistence:', error);
      // Don't throw - persistence verification is informational
    }
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
