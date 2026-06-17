import { Injectable, Logger } from '@nestjs/common';
import { RedisPersistentService } from '../../redis/redis-persistent.service';

/**
 * RedisStatusService
 * 
 * Checks Redis status and H3 index statistics
 */
@Injectable()
export class RedisStatusService {
  private readonly logger = new Logger(RedisStatusService.name);

  constructor(
    private readonly redis: RedisPersistentService,
  ) {}

  /**
   * Check Redis status and H3 index
   */
  async checkStatus(): Promise<any> {
    const client = this.redis.getClient();

    const results = {
      timestamp: new Date().toISOString(),
      server: await this.getServerInfo(client),
      memory: await this.getMemoryInfo(client),
      persistence: await this.getPersistenceInfo(client),
      h3Index: await this.getH3IndexStats(),
      summary: '',
    };

    results.summary = this.generateSummary(results);

    return results;
  }

  /**
   * Get Redis server info
   */
  private async getServerInfo(client: any): Promise<any> {
    try {
      const info = await client.info('server');
      const version = this.extractInfo(info, 'redis_version');
      const mode = this.extractInfo(info, 'redis_mode');
      const uptime = this.extractInfo(info, 'uptime_in_seconds');

      return {
        version,
        mode,
        uptimeSeconds: parseInt(uptime),
        uptimeDays: Math.floor(parseInt(uptime) / 86400),
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get Redis memory info
   */
  private async getMemoryInfo(client: any): Promise<any> {
    try {
      const info = await client.info('memory');
      const usedMemory = this.extractInfo(info, 'used_memory_human');
      const usedMemoryRss = this.extractInfo(info, 'used_memory_rss_human');
      const usedMemoryPeak = this.extractInfo(info, 'used_memory_peak_human');
      const fragRatio = this.extractInfo(info, 'mem_fragmentation_ratio');

      return {
        usedMemory,
        usedMemoryRss,
        usedMemoryPeak,
        fragmentationRatio: parseFloat(fragRatio),
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get Redis persistence info
   */
  private async getPersistenceInfo(client: any): Promise<any> {
    try {
      const info = await client.info('persistence');
      const rdbLastSave = this.extractInfo(info, 'rdb_last_save_time');
      const aofEnabled = this.extractInfo(info, 'aof_enabled');

      return {
        rdbEnabled: rdbLastSave !== '0',
        rdbLastSave: rdbLastSave !== '0' 
          ? new Date(parseInt(rdbLastSave) * 1000).toISOString()
          : null,
        aofEnabled: aofEnabled === '1',
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get H3 index statistics
   */
  private async getH3IndexStats(): Promise<any> {
    try {
      const client = this.redis.getClient();

      // Get metadata
      const lastBuilt = await this.redis.get('h3:stats:last_built');
      const resolution = await this.redis.get('h3:stats:resolution');
      const totalPincodes = await this.redis.get('h3:stats:total_pincodes');
      const totalHexagons = await this.redis.get('h3:stats:total_hexagons');
      const avgPerPincode = await this.redis.get('h3:stats:avg_hexagons_per_pincode');

      // Count keys (sample scan for performance)
      let h3KeyCount = 0;
      let cursor = '0';
      let iterations = 0;
      const maxIterations = 10; // Limit scan iterations

      do {
        const [newCursor, keys] = await client.scan(
          cursor,
          'MATCH', 'h3:*',
          'COUNT', '10000'
        );
        cursor = newCursor;
        h3KeyCount += keys.filter(k => !k.startsWith('h3:stats:')).length;
        iterations++;
      } while (cursor !== '0' && iterations < maxIterations);

      const isPartialCount = iterations >= maxIterations && cursor !== '0';

      // Get total keys in database
      const totalKeys = await client.dbsize();

      // Sample some data
      const sampleKeys = await this.getSampleH3Data();

      return {
        metadata: {
          lastBuilt,
          resolution: resolution ? parseInt(resolution) : null,
          totalPincodes: totalPincodes ? parseInt(totalPincodes) : null,
          totalHexagons: totalHexagons ? parseInt(totalHexagons) : null,
          avgHexagonsPerPincode: avgPerPincode ? parseInt(avgPerPincode) : null,
        },
        keyCounts: {
          totalKeys,
          h3Keys: h3KeyCount,
          isEstimate: isPartialCount,
          nonH3Keys: totalKeys - h3KeyCount,
        },
        sampleData: sampleKeys,
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Get sample H3 index data
   */
  private async getSampleH3Data(): Promise<any[]> {
    try {
      const client = this.redis.getClient();
      const [_, keys] = await client.scan('0', 'MATCH', 'h3:89*', 'COUNT', '5');
      
      const samples: any[] = [];
      for (const key of keys.slice(0, 3)) {
        const h3Index = key.replace('h3:', '');
        const pincodes = await this.redis.smembers(key);
        samples.push({
          h3Index,
          pincodes,
          pincodeCount: pincodes.length,
        });
      }

      return samples;
    } catch (error) {
      return [];
    }
  }

  /**
   * Extract info from Redis INFO string
   */
  private extractInfo(info: string, key: string): string {
    const match = info.match(new RegExp(`${key}:([^\\r\\n]+)`));
    return match ? match[1] : '';
  }

  /**
   * Generate summary
   */
  private generateSummary(results: any): string {
    const totalKeys = results.h3Index.keyCounts?.totalKeys || 0;
    const h3Keys = results.h3Index.keyCounts?.h3Keys || 0;
    const memory = results.memory.usedMemory;

    if (totalKeys === 0) {
      return 'Redis is empty. Ready for new H3 index build.';
    }

    if (h3Keys > 1000000) {
      return `Large H3 index detected (${h3Keys.toLocaleString()} keys, ${memory}). Ready for migration.`;
    }

    if (h3Keys > 0) {
      return `Small H3 index detected (${h3Keys.toLocaleString()} keys). May need rebuild.`;
    }

    return `Redis has ${totalKeys.toLocaleString()} keys but no H3 index found.`;
  }

  /**
   * Log status on startup
   */
  async logStatusOnStartup(): Promise<void> {
    this.logger.log('🔍 Checking Redis status...');
    
    try {
      const status = await this.checkStatus();
      
      this.logger.log('='.repeat(60));
      this.logger.log('💾 Redis Status Assessment');
      this.logger.log('='.repeat(60));
      
      // Server
      this.logger.log(`Redis version: ${status.server.version}`);
      this.logger.log(`Uptime: ${status.server.uptimeDays} days`);

      // Memory
      this.logger.log(`Memory used: ${status.memory.usedMemory}`);
      this.logger.log(`Memory peak: ${status.memory.usedMemoryPeak}`);
      this.logger.log(`Fragmentation: ${status.memory.fragmentationRatio}`);

      // Persistence
      this.logger.log(`RDB persistence: ${status.persistence.rdbEnabled ? '✅' : '❌'}`);
      if (status.persistence.rdbLastSave) {
        this.logger.log(`Last save: ${status.persistence.rdbLastSave}`);
      }

      // H3 Index
      if (status.h3Index.metadata.lastBuilt) {
        this.logger.log('='.repeat(60));
        this.logger.log('🔷 H3 Index Status');
        this.logger.log(`Last built: ${status.h3Index.metadata.lastBuilt}`);
        this.logger.log(`Resolution: ${status.h3Index.metadata.resolution}`);
        this.logger.log(`Total pincodes: ${status.h3Index.metadata.totalPincodes?.toLocaleString()}`);
        this.logger.log(`Total hexagons: ${status.h3Index.metadata.totalHexagons?.toLocaleString()}`);
        this.logger.log(`H3 keys: ${status.h3Index.keyCounts.h3Keys.toLocaleString()}${status.h3Index.keyCounts.isEstimate ? ' (estimate)' : ''}`);
      } else {
        this.logger.log('H3 Index: Not built');
      }

      // Summary
      this.logger.log('='.repeat(60));
      this.logger.log(`📋 SUMMARY: ${status.summary}`);
      this.logger.log('='.repeat(60));

    } catch (error) {
      this.logger.error('Failed to check Redis status:', error);
    }
  }
}
