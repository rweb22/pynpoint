# 🚨 Railway Redis Setup Guide - URGENT!

## ⚠️ **Current Issue: No Caching!**

**Problem**: All API requests are taking 500ms-5s because Redis is not configured.

**Symptoms**:
- ❌ Slow response times (500ms-5s instead of 1-50ms)
- ❌ No performance improvement on repeated requests
- ❌ Database being hit on every request

**Root Cause**: `REDIS_CACHE_URL` is not set in Railway environment variables.

---

## 🚀 **Quick Fix (Railway Dashboard)**

### Step 1: Add Redis Service to Your Project

1. Go to Railway dashboard: https://railway.app/dashboard
2. Select your project: `pynpoint-production`
3. Click **"+ New"** → **"Database"** → **"Add Redis"**
4. Name it: `redis-cache`
5. Wait for it to provision (~30 seconds)

---

### Step 2: Copy the Redis URL

1. Click on the new `redis-cache` service
2. Go to **"Variables"** tab
3. Find `REDIS_URL` (looks like: `redis://default:XXXX@containers-us-west-XX.railway.app:6379`)
4. **Copy the entire URL**

---

### Step 3: Add Environment Variable to Your API Service

1. Go back to your `pynpoint` service (the NestJS API)
2. Go to **"Variables"** tab
3. Click **"+ New Variable"**
4. Name: `REDIS_CACHE_URL`
5. Value: Paste the Redis URL you copied in Step 2
6. Click **"Add"**

---

### Step 4: Configure Redis for Caching (Optional but Recommended)

While still in the `redis-cache` service:

1. Go to **"Settings"** tab
2. Add **"Config"** (if available):
   ```
   maxmemory-policy allkeys-lru
   maxmemory 256mb
   ```

This tells Redis to evict least-recently-used keys when memory is full (perfect for caching).

---

### Step 5: Redeploy

Railway should automatically redeploy when you add the variable.

If not:
1. Go to **"Deployments"** tab
2. Click **"Deploy"** or trigger a redeploy

---

## ✅ **Verify It's Working**

After deployment completes (~2 minutes):

### Test 1: Check Logs

Look for this in Railway logs:

```
[RedisCacheService] Connecting to CACHE Redis (auth, rate-limit): redis://...
[RedisCacheService] ✅ CACHE Redis connected (auth, rate-limit)
[RedisCacheService] ✅ CACHE Redis ready
```

### Test 2: Run the test script again

```bash
./scripts/test-track1-endpoints.sh ppk_live_sk_9126d370214ccc5afe102ceb_5
```

**Expected Results:**
- **First run**: 50-200ms (database queries + cache set)
- **Second run** (immediately after): **1-20ms** (cache hits! 🎉)

Example:
```
Test 1: Single Pincode Lookup
━━━ GET /api/v1/pincodes/110001 ━━━
Latency: 35ms  ← First request (DB + cache)

# Run again immediately:
Latency: 2ms   ← Second request (cache hit!)
```

---

## 📊 **Expected Performance After Redis**

| Endpoint | Cold (No Cache) | Warm (Cached) | Cache TTL |
|----------|----------------|---------------|-----------|
| Single pincode | 20-50ms | **1-5ms** | 1 hour |
| Search | 30-80ms | **5-15ms** | 10 min |
| Bulk (3 pins) | 20-50ms | **2-10ms** | 1 hour |
| States list | 30-50ms | **<1ms** | 24 hours |
| State details | 20-40ms | **<1ms** | 24 hours |
| Districts | 20-40ms | **<1ms** | 24 hours |

---

## 🔍 **Troubleshooting**

### Issue: Still slow after adding Redis

**Check Railway Logs:**
```
Error: ECONNREFUSED redis://...
```

**Solution**: Make sure the Redis service is running and the URL is correct.

---

### Issue: "Redis connection failed"

**Solution**: 
1. Verify both services are in the same Railway project
2. Use the **Private Network URL** (ends with `.railway.internal:6379`) if available
3. Make sure the Redis service is not paused

---

### Issue: Cache is not persisting between requests

**Check**: Make sure you're testing quickly (within TTL window):
- Pincode cache: 1 hour
- States cache: 24 hours

---

## 🎯 **Quick Test Without Waiting for Deployment**

If you have the Railway CLI installed:

```bash
# Check if Redis is reachable
railway run redis-cli -u $REDIS_CACHE_URL ping
# Should return: PONG
```

---

## 📝 **Summary**

**Before Redis**:
- ❌ Every request: 500ms-5s (database hit)
- ❌ No performance improvement

**After Redis**:
- ✅ First request: 20-50ms (database hit + cache set)
- ✅ Subsequent requests: **1-20ms** (cache hit! 🚀)
- ✅ **10x-500x faster** on repeated requests!

---

## 🚀 **Next Steps After Redis is Working**

1. ✅ Verify latencies drop to 1-20ms on cached requests
2. ✅ Add second Redis instance for H3 spatial index (future)
3. ✅ Implement Track 5 (Distance operations)
4. ✅ Implement Track 3 (H3 operations)

---

**DO THIS NOW** to fix the performance issues! 🔥
