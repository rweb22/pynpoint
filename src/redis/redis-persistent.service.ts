import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * RedisPersistentService
 * 
 * Dedicated Redis client for H3 spatial index storage.
 * 
 * Configuration:
 * - maxmemory-policy: noeviction (never evict data)
 * - RDB snapshots: enabled (save 60 1)
 * - Persistent volume: /data/dump.rdb
 * 
 * Purpose:
 * - H3 hexagon → pincode mapping (32.5M entries)
 * - Long-term storage
 * - Must survive restarts
 * 
 * Use this service ONLY for H3 operations.
 * For caching and rate-limiting, use RedisCacheService.
 */
@Injectable()
export class RedisPersistentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPersistentService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('REDIS_PERSISTENT_URL') 
      || this.configService.get<string>('REDIS_URL') 
      || 'redis://localhost:6379';
    
    this.logger.log(`Connecting to PERSISTENT Redis (H3 index): ${redisUrl}`);

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
      this.logger.log('✅ PERSISTENT Redis connected (H3 index)');
    });

    this.client.on('error', (err) => {
      this.logger.error('PERSISTENT Redis error:', err);
    });

    this.client.on('reconnecting', () => {
      this.logger.warn('PERSISTENT Redis reconnecting...');
    });

    // Wait for ready
    await this.client.ping();
    this.logger.log('✅ PERSISTENT Redis ready');

    // Verify persistence configuration
    await this.verifyPersistence();
  }

  /**
   * Verify Redis persistence is configured for H3 index
   */
  private async verifyPersistence(): Promise<void> {
    try {
      const saveConfig = (await this.client.config('GET', 'save')) as [string, string];
      const rdbEnabled = saveConfig[1] !== '';
      const dirConfig = (await this.client.config('GET', 'dir')) as [string, string];
      const dbFilenameConfig = (await this.client.config('GET', 'dbfilename')) as [string, string];

      if (rdbEnabled) {
        this.logger.log('✅ Persistence enabled (H3 index will survive restarts)');
        this.logger.log(`   RDB: ${saveConfig[1]}`);
        this.logger.log(`   Path: ${dirConfig[1]}/${dbFilenameConfig[1]}`);
      } else {
        this.logger.warn('⚠️  Persistence DISABLED - H3 index will be lost on restart!');
      }
    } catch (error) {
      this.logger.error('Failed to verify persistence:', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Disconnecting PERSISTENT Redis...');
    await this.client.quit();
    this.logger.log('✅ PERSISTENT Redis disconnected');
  }

  /**
   * Get the underlying ioredis client
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Create a pipeline for bulk H3 operations
   */
  pipeline(): ReturnType<Redis['pipeline']> {
    return this.client.pipeline();
  }

  // H3-specific operations
  async setH3(hexId: string, pincode: string): Promise<'OK'> {
    return this.client.set(`h3:${hexId}`, pincode);
  }

  async getH3(hexId: string): Promise<string | null> {
    return this.client.get(`h3:${hexId}`);
  }

  async mgetH3(hexIds: string[]): Promise<(string | null)[]> {
    if (hexIds.length === 0) return [];
    const keys = hexIds.map(id => `h3:${id}`);
    return this.client.mget(...keys);
  }

  async existsH3(...hexIds: string[]): Promise<number> {
    if (hexIds.length === 0) return 0;
    const keys = hexIds.map(id => `h3:${id}`);
    return this.client.exists(...keys);
  }

  async countH3Keys(): Promise<number> {
    const keys = await this.client.keys('h3:*');
    return keys.length;
  }

  // Generic operations (use sparingly)
  async ping(): Promise<string> {
    return this.client.ping();
  }

  async flushdb(): Promise<'OK'> {
    this.logger.warn('⚠️  Flushing PERSISTENT Redis - H3 index will be deleted!');
    return this.client.flushdb();
  }
}
