# Redis Persistence Guide

## Overview

PinPoint India stores **32.5M+ H3 hexagons** in Redis for fast reverse geocoding. Without persistence, Redis restarts would require rebuilding the entire index (~12 minutes). This guide explains how to enable Redis persistence to protect this data.

---

## Redis Persistence Options

### 1. **RDB (Redis Database Backup)** ✅ Recommended
- Creates point-in-time snapshots
- Compact, efficient storage
- Fast restarts
- Good balance of performance and durability

### 2. **AOF (Append-Only File)**
- Logs every write operation
- Better durability (no data loss)
- Slower, larger files
- Slower restarts

### 3. **RDB + AOF Hybrid**
- Best of both worlds
- Maximum durability
- Slightly more overhead

---

## Railway.com Redis Configuration

Railway's Redis service supports persistence via environment variables.

### **Enable RDB Persistence**

In Railway Dashboard → Redis Service → Variables:

```bash
# Enable RDB snapshots
REDIS_SAVE="900 1 300 10 60 10000"
# Means:
# - Save after 900 seconds (15 min) if at least 1 key changed
# - Save after 300 seconds (5 min) if at least 10 keys changed
# - Save after 60 seconds (1 min) if at least 10000 keys changed

# RDB filename
REDIS_DBFILENAME=dump.rdb

# Directory for RDB file (Railway provides persistent volume)
REDIS_DIR=/data

# Enable compression
REDIS_RDBCOMPRESSION=yes

# Enable checksum
REDIS_RDBCHECKSUM=yes
```

### **Enable AOF Persistence** (Optional, for maximum durability)

```bash
# Enable AOF
REDIS_APPENDONLY=yes

# AOF filename
REDIS_APPENDFILENAME=appendonly.aof

# AOF sync policy
REDIS_APPENDFSYNC=everysec
# Options:
# - always: sync every write (slowest, safest)
# - everysec: sync every second (good balance)
# - no: let OS decide (fastest, least safe)
```

### **Hybrid Mode** (RDB + AOF)

```bash
# Enable both
REDIS_SAVE="900 1 300 10 60 10000"
REDIS_APPENDONLY=yes
REDIS_APPENDFSYNC=everysec

# Use RDB for fast startup, AOF for durability
REDIS_AOF_USE_RDB_PREAMBLE=yes
```

---

## Application-Level Persistence Verification

Add health checks to verify Redis persistence is configured:

```typescript
// In RedisService.onModuleInit()
async verifyPersistence(): Promise<void> {
  const config = await this.client.config('GET', 'save');
  const aof = await this.client.config('GET', 'appendonly');
  
  this.logger.log(`Redis RDB: ${config[1]}`);
  this.logger.log(`Redis AOF: ${aof[1]}`);
  
  if (config[1] === '' && aof[1] === 'no') {
    this.logger.warn('⚠️  Redis persistence is DISABLED! Data will be lost on restart.');
  }
}
```

---

## Testing Persistence

### 1. **Verify Configuration**

```bash
# Connect to Railway Redis via CLI
railway run redis-cli

# Check current config
CONFIG GET save
CONFIG GET appendonly
CONFIG GET dir

# Should show:
# save: "900 1 300 10 60 10000"
# appendonly: "yes" or "no"
# dir: "/data"
```

### 2. **Test RDB Snapshot**

```bash
# Force a manual save
redis-cli BGSAVE

# Check last save time
redis-cli LASTSAVE

# Check if dump.rdb exists
redis-cli CONFIG GET dir
# Then check that directory for dump.rdb file
```

### 3. **Test Recovery**

```bash
# 1. Build H3 index (wait for completion)
# 2. Check index size
redis-cli DBSIZE

# 3. Restart Redis service
railway service restart redis

# 4. After restart, check if data persisted
redis-cli DBSIZE
# Should show same number of keys!
```

---

## Recommended Configuration for PinPoint India

For **32.5M keys** (H3 index):

```bash
# RDB with aggressive snapshotting (lots of writes during index build)
REDIS_SAVE="900 1 300 10 60 10000"
REDIS_RDBCOMPRESSION=yes
REDIS_RDBCHECKSUM=yes
REDIS_DIR=/data

# AOF for durability (recommended)
REDIS_APPENDONLY=yes
REDIS_APPENDFSYNC=everysec
REDIS_AOF_USE_RDB_PREAMBLE=yes

# Memory management
REDIS_MAXMEMORY=2gb
REDIS_MAXMEMORY_POLICY=allkeys-lru
```

---

## Monitoring

### Application Startup Check

```typescript
// Log persistence status on startup
const info = await this.client.info('persistence');
this.logger.log('Redis Persistence Info:', info);
```

### Check Persistence Metrics

```bash
# Via Redis CLI
redis-cli INFO persistence

# Key metrics:
# - rdb_last_save_time: Unix timestamp of last successful save
# - rdb_changes_since_last_save: Number of changes since last snapshot
# - aof_enabled: 0 or 1
# - aof_current_size: Current AOF file size
```

---

## Troubleshooting

### Issue: Data Lost After Restart

**Cause**: Persistence not enabled or volume not mounted.

**Solution**:
1. Check Railway → Redis Service → Variables for persistence config
2. Verify `/data` volume is mounted (Railway auto-mounts for Redis)
3. Check logs for save errors: `railway logs --service redis`

### Issue: High Memory Usage

**Cause**: AOF file growing large, or no memory eviction policy.

**Solution**:
```bash
# Set max memory and eviction policy
REDIS_MAXMEMORY=2gb
REDIS_MAXMEMORY_POLICY=allkeys-lru

# Trigger AOF rewrite
redis-cli BGREWRITEAOF
```

### Issue: Slow Restarts

**Cause**: Large RDB file or AOF file.

**Solution**:
- Use RDB-only for faster restarts (acceptable to rebuild H3 index if needed)
- Or use AOF with RDB preamble: `REDIS_AOF_USE_RDB_PREAMBLE=yes`

---

## Summary

**Minimum Setup** (Fast, 99.9% safe):
```bash
REDIS_SAVE="900 1 300 10 60 10000"
REDIS_RDBCOMPRESSION=yes
REDIS_DIR=/data
```

**Recommended Setup** (Balanced):
```bash
REDIS_SAVE="900 1 300 10 60 10000"
REDIS_APPENDONLY=yes
REDIS_APPENDFSYNC=everysec
REDIS_AOF_USE_RDB_PREAMBLE=yes
REDIS_DIR=/data
```

**Maximum Durability** (Slower writes):
```bash
REDIS_APPENDONLY=yes
REDIS_APPENDFSYNC=always
REDIS_DIR=/data
```

---

**Next Steps**:
1. Configure Railway Redis with chosen persistence strategy
2. Add persistence verification to `RedisService.onModuleInit()`
3. Test with manual restarts
4. Monitor persistence metrics
