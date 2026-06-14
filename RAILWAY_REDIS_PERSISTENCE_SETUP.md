# Railway Redis Persistence Setup

## Quick Setup Guide for Railway.com

Follow these steps to enable Redis persistence on Railway to protect your **32.5M H3 hexagons**.

---

## Step 1: Access Redis Service Settings

1. Go to Railway Dashboard → Your Project
2. Click on your **Redis service**
3. Go to **"Variables"** tab

---

## Step 2: Add Persistence Variables

Click **"+ New Variable"** for each of these:

### **Recommended Configuration** (Balanced Performance + Durability)

```bash
# Variable Name          | Value
# ---------------------|---------------------------
REDIS_SAVE             | "900 1 300 10 60 10000"
REDIS_RDBCOMPRESSION   | yes
REDIS_RDBCHECKSUM      | yes
REDIS_DIR              | /data
REDIS_APPENDONLY       | yes
REDIS_APPENDFSYNC      | everysec
REDIS_AOF_USE_RDB_PREAMBLE | yes
```

### **What These Mean:**

- **REDIS_SAVE**: Creates snapshots:
  - After 15 minutes if ≥1 key changed
  - After 5 minutes if ≥10 keys changed  
  - After 1 minute if ≥10,000 keys changed

- **REDIS_RDBCOMPRESSION**: Compress snapshots (saves disk space)
- **REDIS_RDBCHECKSUM**: Verify snapshot integrity
- **REDIS_DIR**: Persistent storage location (Railway auto-mounts `/data`)
- **REDIS_APPENDONLY**: Enable append-only file for better durability
- **REDIS_APPENDFSYNC**: Sync to disk every second (good balance)
- **REDIS_AOF_USE_RDB_PREAMBLE**: Use RDB for fast restarts, AOF for recent changes

---

## Step 3: Restart Redis Service

After adding variables:

1. Click **"Redeploy"** or **"Restart"** on Redis service
2. Wait for service to come back online (~30 seconds)

---

## Step 4: Verify Configuration

### Via Railway Logs

1. Go to your **API service** → **Logs**
2. After next deployment, look for:

```
✅ Redis ready
✅ Redis persistence enabled
   RDB: 900 1 300 10 60 10000
   Last RDB save: 2026-06-14T05:30:00.000Z
   AOF: enabled (yes)
   AOF size: 0.00 MB
```

### Via Redis CLI (Optional)

```bash
# Install Railway CLI if not already installed
npm install -g @railway/cli

# Connect to Redis
railway run redis-cli -u $REDIS_URL

# Check config
CONFIG GET save
CONFIG GET appendonly
CONFIG GET dir

# Expected output:
# 1) "save"
# 2) "900 1 300 10 60 10000"
# 3) "appendonly"
# 4) "yes"
# 5) "dir"
# 6) "/data"
```

---

## Step 5: Test Persistence

### After H3 Index Build:

1. **Check data size:**
   ```bash
   railway run redis-cli -u $REDIS_URL DBSIZE
   # Should show ~32,500,000 keys
   ```

2. **Restart Redis service:**
   - Railway Dashboard → Redis Service → "Restart"

3. **Wait for restart** (~30 seconds)

4. **Check data is still there:**
   ```bash
   railway run redis-cli -u $REDIS_URL DBSIZE
   # Should still show ~32,500,000 keys!
   ```

If the DBSIZE is the same after restart, **persistence is working!** 🎉

---

## Monitoring Persistence

### Check Persistence Status Anytime

```bash
railway run redis-cli -u $REDIS_URL INFO persistence
```

**Key Metrics:**

- `rdb_last_save_time`: Unix timestamp of last successful RDB save
- `rdb_changes_since_last_save`: Changes since last snapshot (should be low)
- `aof_enabled`: Should be `1`
- `aof_current_size`: Current AOF file size in bytes

---

## Troubleshooting

### Problem: Persistence not working after restart

**Check:**
1. Variables are set on **Redis service**, not API service
2. Redis service was redeployed after adding variables
3. Railway volume is mounted at `/data` (should be automatic)

**Fix:**
```bash
# Check if volume exists
railway service list
railway volumes list

# If no volume, create one
railway volumes create --name redis-data --mount /data --service <redis-service-id>
```

### Problem: High memory usage

**Solution:**
Add memory limits:

```bash
REDIS_MAXMEMORY        | 2gb
REDIS_MAXMEMORY_POLICY | allkeys-lru
```

### Problem: Warning in logs about disabled persistence

**Cause:** Variables not applied or Redis service not restarted.

**Solution:**
1. Double-check all variables are set
2. Redeploy Redis service
3. Check Redis service logs for errors

---

## Alternative: Minimal Setup (Fast, 99% Safe)

If you want simpler configuration with just RDB (no AOF):

```bash
# Variable Name        | Value
# --------------------|---------------------------
REDIS_SAVE           | "900 1 300 10 60 10000"
REDIS_RDBCOMPRESSION | yes
REDIS_DIR            | /data
```

This is **faster** but may lose up to 15 minutes of changes on crash. For PinPoint India, this is fine since H3 index is rebuilt from PostgreSQL if missing.

---

## Summary

✅ **Benefits of Persistence:**
- Avoid 12-minute H3 index rebuilds on Redis restart
- Instant startup times after deployment
- Data survives Redis crashes/restarts

✅ **Railway Auto-Provides:**
- Persistent volume at `/data`
- Redis service with full config support
- Automatic backups (via Railway's infrastructure)

✅ **Expected Results:**
- First H3 index build: ~12 minutes
- Subsequent restarts: ~5 seconds (data loaded from disk)
- No data loss on Redis service restarts

---

**Status**: Ready to configure! 🚀

Follow Steps 1-4 above to enable persistence on your Railway Redis service.
