# Redis Migration Guide: Single → Dual Instance

**Current Setup**: Single Redis instance (`REDIS_URL`)  
**Target Setup**: Two Redis instances (`REDIS_PERSISTENT_URL` + `REDIS_CACHE_URL`)  
**Estimated Downtime**: ~2 minutes  
**Risk**: Low (H3 index auto-restores from RDB snapshot)

---

## 🎯 Migration Strategy

### Current State
```
┌──────────────────┐
│  PinPoint API    │
└────────┬─────────┘
         │ REDIS_URL
         ▼
┌──────────────────┐
│  Redis Instance  │
│  - H3 Index      │
│  - (Future cache)│
└──────────────────┘
```

### Target State
```
┌──────────────────┐
│  PinPoint API    │
└────┬────────┬────┘
     │        │
     │        │ REDIS_CACHE_URL (new)
     │        ▼
     │   ┌──────────────────┐
     │   │  redis-cache     │
     │   │  - API key cache │
     │   │  - Rate limits   │
     │   └──────────────────┘
     │
     │ REDIS_PERSISTENT_URL (renamed from REDIS_URL)
     ▼
┌──────────────────┐
│ redis-persistent │
│  - H3 Index      │
│  - 32.5M hexes   │
└──────────────────┘
```

---

## 📋 Step-by-Step Migration

### Step 1: Rename Existing Redis Service (No Downtime)

**In Railway Dashboard:**

1. Go to existing Redis service
2. Click service name at top → Rename to **`redis-persistent`**
3. Verify URL changes to: `redis-persistent.railway.internal:6379`

**Backward Compatibility**: The code automatically falls back to `REDIS_URL` if `REDIS_PERSISTENT_URL` is not set, so this won't break anything yet.

---

### Step 2: Add New Redis Service for Cache

**In Railway Dashboard:**

1. Click `New` → `Database` → `Add Redis`
2. Name: **`redis-cache`**
3. Wait for provisioning (~1 minute)
4. Copy the auto-generated `REDIS_URL` from `redis-cache` service

**Configure Cache Settings:**

In `redis-cache` service → `Variables` → Add:
```bash
REDIS_ARGS=--maxmemory-policy allkeys-lru --maxmemory 512mb --save ""
```

---

### Step 3: Update Environment Variables in PinPoint API

**In Railway → `pynpoint` service → Variables:**

1. **Rename existing variable:**
   - Find `REDIS_URL` → Click to edit
   - Change name to: `REDIS_PERSISTENT_URL`
   - Value stays the same (auto-updates to `redis-persistent.railway.internal:6379`)

2. **Add new variable:**
   - Click `New Variable`
   - Name: `REDIS_CACHE_URL`
   - Value: `redis://default:xxx@redis-cache.railway.internal:6379` (from Step 2)

3. **Optional: Keep legacy fallback:**
   - Add `REDIS_URL` → Same value as `REDIS_PERSISTENT_URL`
   - This ensures any legacy code still works

---

### Step 4: Configure Persistent Redis Settings

**In `redis-persistent` service → Variables:**

If not already set, add:
```bash
REDIS_ARGS=--maxmemory-policy noeviction --save 60 1
```

**Verify Persistent Volume:**
- Go to `redis-persistent` → `Settings` → `Volumes`
- Should have volume mounted at `/data`
- If not, create one (10 GB)

---

### Step 5: Deploy and Verify

**Deploy:**
- Railway auto-deploys when env vars change
- Or manually: `git push origin main`

**Check Logs:**
```
✅ Connecting to PERSISTENT Redis (H3 index): redis://...redis-persistent...
✅ PERSISTENT Redis connected (H3 index)
✅ Persistence enabled (H3 index will survive restarts)
   RDB: 60 1
   Path: /data/dump.rdb

✅ Connecting to CACHE Redis (auth, rate-limit): redis://...redis-cache...
✅ CACHE Redis connected (auth, rate-limit)
```

**Verify H3 Index Restored:**
```
✅ H3 index restored from Redis (32,500,000 hexagons) in 0.11s
```

---

### Step 6: Test and Monitor

**Test Endpoints:**
```bash
# Health check
curl https://your-app.railway.app/health

# Test pincode lookup (uses H3 index from persistent Redis)
curl https://your-app.railway.app/api/v1/pincodes/110001
```

**Monitor Redis Memory:**
- Railway Dashboard → `redis-persistent` → `Metrics`
- Should see ~4-6 GB used (H3 index)
- Railway Dashboard → `redis-cache` → `Metrics`
- Should see ~10-50 MB used (initially empty)

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong:

1. **Revert Environment Variables:**
   - Remove `REDIS_PERSISTENT_URL` and `REDIS_CACHE_URL`
   - Add back `REDIS_URL` pointing to `redis-persistent`

2. **Code Automatically Falls Back:**
   - `RedisPersistentService` uses `REDIS_URL` if `REDIS_PERSISTENT_URL` is missing
   - `RedisCacheService` uses `REDIS_URL` database 1 if `REDIS_CACHE_URL` is missing

3. **Redeploy:**
   - Railway auto-deploys on env var change
   - H3 index auto-restores from RDB snapshot (~0.1s)

**Note**: Rolling back is safe because:
- H3 index is persisted in RDB snapshot
- Cache data is ephemeral (OK to lose)
- No data migration needed

---

## ✅ Verification Checklist

After migration, verify:

- [ ] Two Redis services exist: `redis-persistent` and `redis-cache`
- [ ] `REDIS_PERSISTENT_URL` set in PinPoint API
- [ ] `REDIS_CACHE_URL` set in PinPoint API
- [ ] Logs show both Redis connections successful
- [ ] H3 index restored successfully (32.5M hexagons)
- [ ] API endpoints working (test pincode lookup)
- [ ] `redis-persistent` has ~4-6 GB memory usage
- [ ] `redis-cache` has < 100 MB memory usage
- [ ] No error logs related to Redis connections

---

## 💡 Why This Migration is Safe

1. **No Data Loss Risk**:
   - H3 index is in RDB snapshot (`/data/dump.rdb`)
   - Auto-restores in ~0.1 seconds on restart

2. **Backward Compatible Code**:
   - Falls back to `REDIS_URL` if new vars not set
   - Can run with single instance temporarily

3. **Zero-Downtime Possible**:
   - Renaming service doesn't disconnect clients
   - Railway updates internal DNS automatically

4. **Easy Rollback**:
   - Just revert env vars
   - No database migrations needed

---

## 📊 Expected Behavior

### Before Migration (Single Instance)
```
REDIS_URL → Single Redis
  ├─ H3 Index (32.5M hexes, ~5 GB)
  └─ (No cache yet)
```

### After Migration (Dual Instance)
```
REDIS_PERSISTENT_URL → redis-persistent
  └─ H3 Index (32.5M hexes, ~5 GB)

REDIS_CACHE_URL → redis-cache
  └─ (Empty initially, fills as API keys are validated)
```

---

## 🆘 Troubleshooting

### Issue: "Cannot connect to redis-persistent"

**Solution**: Railway may not have updated internal DNS
- Wait 1-2 minutes
- Or use direct Railway-provided `REDIS_URL` from `redis-persistent` service

### Issue: "H3 index empty after migration"

**Cause**: RDB snapshot not found

**Solution**:
1. Check `redis-persistent` has persistent volume at `/data`
2. Restart `redis-persistent` service
3. If still empty, H3 index will rebuild (~12 minutes)

### Issue: "REDIS_PERSISTENT_URL not set" warning

**Expected**: Shows during migration before you rename the variable  
**Fix**: Rename `REDIS_URL` → `REDIS_PERSISTENT_URL` in Step 3

---

## 🎯 Post-Migration Optimization

After successful migration:

1. **Set `SKIP_INITIALIZATION=true`** (speeds up restarts)
2. **Monitor cache hit rate** (add metrics in Phase 4)
3. **Adjust cache size if needed** (currently 512 MB)
4. **Remove legacy `REDIS_URL`** (optional, after testing)

---

## 📅 Timeline

| Step | Duration | Risk |
|------|----------|------|
| Rename service | 10 seconds | None |
| Create new Redis | 1 minute | None |
| Update env vars | 1 minute | Low |
| Deploy + restart | 2 minutes | Low |
| Verify | 2 minutes | None |
| **Total** | **~6 minutes** | **Low** |

**Recommended Time**: During low-traffic period (though not critical)

---

## ✅ Ready to Migrate?

The migration is **safe and reversible**. The code already supports both configurations, so you can migrate without code changes.

**Next**: After migration, we can proceed with Phase 3 (ApiKeyService) knowing we have the proper Redis infrastructure! 🚀
