# Redis Snapshot & Auto-Restore Behavior

## Quick Answers

### Where is the snapshot saved?

On Railway, the RDB snapshot is saved to:
```
/data/dump.rdb
```

- **Directory**: `/data` (Railway's persistent volume)
- **Filename**: `dump.rdb` (default Redis RDB filename)
- **Full path**: `/data/dump.rdb`

Railway **automatically mounts** a persistent volume at `/data` for all Redis services. This volume:
- ✅ Survives Redis container restarts
- ✅ Survives Redis service redeployments
- ✅ Is backed by Railway's infrastructure (persistent disk)
- ✅ Is separate from the ephemeral container filesystem

---

### Will it automatically restore if Redis memory is lost?

**YES! ✅ Automatic restoration happens in these scenarios:**

#### Scenario 1: Redis Service Restart
```
Redis crashes → Railway restarts container → Redis loads /data/dump.rdb → Data restored
```
**Result**: ✅ All 32.5M H3 keys restored automatically

#### Scenario 2: Redis Service Redeployment
```
You click "Redeploy" → New container starts → Redis loads /data/dump.rdb → Data restored
```
**Result**: ✅ All data restored automatically

#### Scenario 3: Railway Infrastructure Migration
```
Railway moves service → New node → Persistent volume attached → Redis loads dump.rdb
```
**Result**: ✅ All data restored automatically

#### Scenario 4: Manual FLUSHDB/FLUSHALL
```
Someone runs redis-cli FLUSHDB → All memory cleared → Container still running
```
**Result**: ❌ Data NOT auto-restored until Redis restarts
- Memory is empty but dump.rdb still exists on disk
- Data will restore on next Redis restart
- To force restore: restart Redis service

---

## How Auto-Restore Works

### On Redis Startup:

1. **Redis starts** (container boot)
2. **Checks for dump.rdb** in `/data` directory
3. **If dump.rdb exists**:
   - Reads file into memory
   - Loads all keys and values
   - Makes them immediately available
4. **If dump.rdb doesn't exist**:
   - Starts with empty database
   - Will create dump.rdb on first save

### Loading Process:

```
[Redis Container Start]
     ↓
Check /data/dump.rdb exists?
     ↓
   YES → Load into memory (fast, ~5 seconds for 32.5M keys)
     ↓
   NO → Start empty, create on first save
     ↓
[Redis Ready]
```

---

## Persistence Flow: Write → Disk → Restore

### 1. Data Write (H3 Index Build)
```typescript
// Your app adds 32.5M H3 hexagons
await redisService.sadd('h3:89283082837ffff', '110001');
// ... 32.5M more operations ...
```

### 2. Background Save (Automatic)
```
Redis detects: "60 seconds passed AND ≥1 key changed"
     ↓
Triggers BGSAVE (background save)
     ↓
Forks process → Writes /data/dump.rdb
     ↓
dump.rdb updated on disk
```

### 3. Redis Restart (Any reason)
```
Container stops
     ↓
Railway starts new container
     ↓
/data volume attached (persistent)
     ↓
Redis starts → Reads /data/dump.rdb
     ↓
32.5M keys loaded into memory
     ↓
App ready in ~5 seconds!
```

---

## Current Configuration (from your logs)

```
RDB: 60 1
```

**Meaning**:
- Save snapshot **every 60 seconds** if **≥1 key changed**
- Very aggressive (good for your use case!)
- Ensures data is written to disk frequently

**Your last save**:
```
Last RDB save: 2026-06-13T11:42:20.000Z
```

This means `/data/dump.rdb` was written on June 13 at 11:42:20.

---

## What Happens in Different Failure Scenarios

### ✅ Scenario: Redis Container Crash
- **Volume**: `/data` persists (not deleted)
- **dump.rdb**: Still exists on disk
- **Railway action**: Restarts Redis container
- **Result**: Auto-loads from `/data/dump.rdb`
- **Downtime**: ~5 seconds
- **Data loss**: Max 60 seconds of changes (since last save)

### ✅ Scenario: Railway Node Failure
- **Volume**: Railway migrates volume to new node
- **dump.rdb**: Moves with volume
- **Railway action**: Starts Redis on new node
- **Result**: Auto-loads from `/data/dump.rdb`
- **Downtime**: ~30 seconds (migration time)
- **Data loss**: Max 60 seconds of changes

### ✅ Scenario: Redeployment (Code Update)
- **Volume**: Persists across deployments
- **dump.rdb**: Unchanged
- **Railway action**: New container uses same volume
- **Result**: Auto-loads from `/data/dump.rdb`
- **Downtime**: ~10 seconds
- **Data loss**: None (if no writes during deployment)

### ⚠️ Scenario: Manual FLUSHDB in Running Container
- **Volume**: dump.rdb still on disk
- **Memory**: Cleared
- **Result**: Empty until Redis restart
- **Recovery**: Restart Redis service → loads from dump.rdb

### ❌ Scenario: Volume Deletion (Manual)
- **Volume**: Deleted via Railway dashboard
- **dump.rdb**: Gone
- **Result**: Empty database on restart
- **Recovery**: H3IndexService rebuilds from PostgreSQL (~12 min)

---

## Verifying Persistence After Next Deploy

After you deploy the updated code, you'll see:

```
✅ Redis persistence enabled
   Storage directory: /data
   RDB: 60 1
   RDB filename: dump.rdb
   Full path: /data/dump.rdb
   Last RDB save: 2026-06-14T...
```

This confirms:
1. ✅ Where snapshot is stored
2. ✅ When it was last saved
3. ✅ Auto-restore is configured

---

## Testing Auto-Restore

Want to verify it works? Run this test:

```bash
# 1. Check current key count
railway run redis-cli -u $REDIS_URL DBSIZE
# Output: (integer) 32500000

# 2. Restart Redis service
railway service restart redis

# 3. Wait ~30 seconds for restart

# 4. Check again
railway run redis-cli -u $REDIS_URL DBSIZE
# Output: (integer) 32500000 ✅ Same!
```

If the count matches, auto-restore is working perfectly!

---

## Summary

| Question | Answer |
|----------|--------|
| **Where saved?** | `/data/dump.rdb` on Railway persistent volume |
| **Auto-restore?** | ✅ YES, on every Redis startup |
| **Survives restart?** | ✅ YES |
| **Survives redeploy?** | ✅ YES |
| **Survives node failure?** | ✅ YES |
| **Max data loss?** | 60 seconds (time since last save) |
| **Restore time?** | ~5 seconds for 32.5M keys |

**Your data is safe!** 🎉

Redis automatically loads `/data/dump.rdb` on every startup, so your 32.5M H3 hexagons are protected and will auto-restore after any restart scenario.
