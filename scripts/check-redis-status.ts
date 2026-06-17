import Redis from 'ioredis';
import * as dotenv from 'dotenv';

/**
 * Check Redis status and H3 index statistics
 * 
 * This script checks:
 * 1. Redis connection and version
 * 2. Memory usage
 * 3. H3 index key count
 * 4. Sample H3 index data
 * 5. Persistence configuration
 */

dotenv.config();

async function checkRedisStatus() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  try {
    console.log('✅ Connected to Redis\n');

    // 1. Redis version and server info
    console.log('📊 Redis Server Info:');
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    const mode = info.match(/redis_mode:([^\r\n]+)/)?.[1];
    console.log(`   Version: ${version}`);
    console.log(`   Mode: ${mode}`);
    console.log();

    // 2. Memory usage
    console.log('💾 Memory Usage:');
    const memory = await redis.info('memory');
    const usedMemory = memory.match(/used_memory_human:([^\r\n]+)/)?.[1];
    const usedMemoryRss = memory.match(/used_memory_rss_human:([^\r\n]+)/)?.[1];
    const usedMemoryPeak = memory.match(/used_memory_peak_human:([^\r\n]+)/)?.[1];
    const memFragRatio = memory.match(/mem_fragmentation_ratio:([^\r\n]+)/)?.[1];
    console.log(`   Used memory: ${usedMemory}`);
    console.log(`   RSS memory: ${usedMemoryRss}`);
    console.log(`   Peak memory: ${usedMemoryPeak}`);
    console.log(`   Fragmentation ratio: ${memFragRatio}`);
    console.log();

    // 3. Persistence configuration
    console.log('💿 Persistence Configuration:');
    const persistence = await redis.info('persistence');
    const rdbEnabled = persistence.match(/rdb_last_save_time:([^\r\n]+)/)?.[1];
    const aofEnabled = persistence.match(/aof_enabled:([^\r\n]+)/)?.[1];
    const lastSave = rdbEnabled ? new Date(parseInt(rdbEnabled) * 1000).toISOString() : 'N/A';
    console.log(`   RDB enabled: ${rdbEnabled ? 'Yes' : 'No'}`);
    console.log(`   AOF enabled: ${aofEnabled === '1' ? 'Yes' : 'No'}`);
    console.log(`   Last RDB save: ${lastSave}`);
    console.log();

    // 4. Count H3 keys
    console.log('🔷 H3 Index Statistics:');
    console.log('   Counting h3:* keys (this may take a moment)...');
    
    let h3KeyCount = 0;
    let h3StatsCount = 0;
    let otherKeyCount = 0;
    let cursor = '0';
    
    do {
      const [newCursor, keys] = await redis.scan(
        cursor,
        'MATCH', 'h3:*',
        'COUNT', '1000'
      );
      cursor = newCursor;
      
      for (const key of keys) {
        if (key.startsWith('h3:stats:')) {
          h3StatsCount++;
        } else {
          h3KeyCount++;
        }
      }
      
      // Show progress every 100k keys
      if ((h3KeyCount + h3StatsCount) % 100000 === 0 && h3KeyCount > 0) {
        process.stdout.write(`\r   Progress: ${(h3KeyCount + h3StatsCount).toLocaleString()} keys counted...`);
      }
    } while (cursor !== '0');
    
    console.log(`\r   H3 cell keys (h3:{cell}): ${h3KeyCount.toLocaleString()}`);
    console.log(`   H3 metadata keys (h3:stats:*): ${h3StatsCount}`);
    console.log();

    // 5. H3 index metadata
    if (h3StatsCount > 0) {
      console.log('📋 H3 Index Metadata:');
      const lastBuilt = await redis.get('h3:stats:last_built');
      const resolution = await redis.get('h3:stats:resolution');
      const totalPincodes = await redis.get('h3:stats:total_pincodes');
      const totalHexagons = await redis.get('h3:stats:total_hexagons');
      const avgPerPincode = await redis.get('h3:stats:avg_hexagons_per_pincode');
      
      console.log(`   Last built: ${lastBuilt || 'N/A'}`);
      console.log(`   Resolution: ${resolution || 'N/A'}`);
      console.log(`   Total pincodes indexed: ${totalPincodes || 'N/A'}`);
      console.log(`   Total hexagons: ${totalHexagons ? parseInt(totalHexagons).toLocaleString() : 'N/A'}`);
      console.log(`   Avg hexagons per pincode: ${avgPerPincode || 'N/A'}`);
      console.log();
    }

    // 6. Sample H3 index data
    console.log('🔍 Sample H3 Index Data:');
    cursor = '0';
    const [_, sampleKeys] = await redis.scan(cursor, 'MATCH', 'h3:8*', 'COUNT', '5');
    
    if (sampleKeys.length > 0) {
      for (const key of sampleKeys.slice(0, 3)) {
        const pincodes = await redis.smembers(key);
        const h3Index = key.replace('h3:', '');
        console.log(`   ${h3Index} → [${pincodes.join(', ')}] (${pincodes.length} pincodes)`);
      }
    } else {
      console.log('   No sample data found');
    }
    console.log();

    // 7. Total key count (all types)
    console.log('🔑 Total Keys in Redis:');
    const dbsize = await redis.dbsize();
    console.log(`   Total keys: ${dbsize.toLocaleString()}`);
    otherKeyCount = dbsize - h3KeyCount - h3StatsCount;
    console.log(`   Non-H3 keys: ${otherKeyCount.toLocaleString()}`);
    console.log();

    // 8. Estimated memory per key
    if (h3KeyCount > 0 && usedMemory) {
      const memoryBytes = parseFloat(usedMemory.replace(/[^0-9.]/g, '')) * 1024 * 1024; // Assuming MB
      const avgBytesPerKey = memoryBytes / h3KeyCount;
      console.log('📊 Memory Estimates:');
      console.log(`   Avg bytes per H3 key: ${Math.round(avgBytesPerKey)} bytes`);
      console.log();
    }

    console.log('='.repeat(60));
    console.log('📋 Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Redis is running with ${dbsize.toLocaleString()} total keys`);
    console.log(`🔷 H3 index contains ${h3KeyCount.toLocaleString()} cell mappings`);
    console.log(`💾 Using ${usedMemory} of memory`);
    
    if (h3KeyCount > 0) {
      console.log(`\n⚠️  To clear the H3 index, we need to delete ${h3KeyCount.toLocaleString()} keys`);
      console.log(`   This will free approximately ${usedMemory} of memory`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await redis.quit();
  }
}

checkRedisStatus().catch(console.error);
