# Railway Dual-Redis Setup Guide

**Purpose**: Configure two separate Redis instances for PinPoint API  
**Date**: 2026-06-14  
**Estimated Time**: 10 minutes

---

## Why Two Redis Instances?

The PinPoint API has two conflicting Redis use cases:

| Use Case | Policy | Persistence | Size |
|----------|--------|-------------|------|
| **H3 Spatial Index** | noeviction (never delete) | RDB snapshots | 4-6 GB |
| **API Auth/Rate-Limit** | allkeys-lru (evict LRU) | None | 512 MB |

**These policies cannot coexist in a single Redis instance!**

---

## 📋 Step-by-Step Setup

### Step 1: Create First Redis Instance (Persistent)

1. **Open Railway Dashboard**
   - Navigate to your PinPoint project

2. **Add Redis Database**
   - Click `New` → `Database` → `Add Redis`
   - Name: `redis-persistent`

3. **Configure Persistence**
   - Go to `redis-persistent` service
   - Click `Variables` tab
   - Add custom configuration:
   
   ```bash
   # Add these as "New Variable" in Railway
   REDIS_ARGS=--maxmemory-policy noeviction --save 60 1
   ```

4. **Attach Persistent Volume**
   - Click `Settings` tab
   - Scroll to `Volumes`
   - Click `New Volume`
   - Mount Path: `/data`
   - Size: `10 GB`

5. **Copy Connection URL**
   - Click `Variables` tab
   - Find `REDIS_URL` (auto-generated)
   - Copy the value (e.g., `redis://default:xxx@redis-persistent.railway.internal:6379`)

---

### Step 2: Create Second Redis Instance (Cache)

1. **Add Another Redis Database**
   - Click `New` → `Database` → `Add Redis`
   - Name: `redis-cache`

2. **Configure LRU Eviction**
   - Go to `redis-cache` service
   - Click `Variables` tab
   - Add custom configuration:
   
   ```bash
   # Add these as "New Variable" in Railway
   REDIS_ARGS=--maxmemory-policy allkeys-lru --maxmemory 512mb --save ""
   ```

3. **No Persistent Volume Needed**
   - Skip volume creation (cache is ephemeral)

4. **Copy Connection URL**
   - Click `Variables` tab
   - Find `REDIS_URL` (auto-generated)
   - Copy the value (e.g., `redis://default:yyy@redis-cache.railway.internal:6379`)

---

### Step 3: Configure PinPoint API Service

1. **Go to PinPoint API Service**
   - Click on your `pynpoint` service

2. **Add Environment Variables**
   - Click `Variables` tab
   - Click `New Variable`
   
   Add these variables:
   
   ```bash
   # Redis Instance 1: Persistent (H3 Index)
   REDIS_PERSISTENT_URL=redis://default:xxx@redis-persistent.railway.internal:6379
   
   # Redis Instance 2: Cache (Auth/Rate-Limit)
   REDIS_CACHE_URL=redis://default:yyy@redis-cache.railway.internal:6379
   
   # Legacy fallback (optional, keep for backward compatibility)
   REDIS_URL=redis://default:xxx@redis-persistent.railway.internal:6379
   ```

3. **Generate and Add Secrets**
   
   Run locally:
   ```bash
   ./scripts/generate-secrets.sh
   ```
   
   Copy output and add to Railway:
   ```bash
   ADMIN_API_SECRET=<generated-value>
   JWT_SECRET=<generated-value>
   API_KEY_SALT=<generated-value>
   ```
   
   **Mark these as "Secret"** by clicking the eye icon (they won't be logged)

4. **Verify Other Required Variables**
   ```bash
   NODE_ENV=production
   RUN_MIGRATIONS=true
   DATABASE_URL=<auto-provided-by-railway>
   H3_RESOLUTION=9
   SKIP_INITIALIZATION=false  # Set to 'true' after first successful deploy
   ```

---

### Step 4: Deploy and Verify

1. **Deploy**
   - Push to GitHub (Railway auto-deploys)
   - Or click `Deploy` in Railway dashboard

2. **Check Logs**
   - Click `Deployments` tab
   - Click on latest deployment
   - Watch logs for:
   
   ```
   ✅ PERSISTENT Redis connected (H3 index)
   ✅ PERSISTENT Redis ready
   ✅ Persistence enabled (H3 index will survive restarts)
   
   ✅ CACHE Redis connected (auth, rate-limit)
   ✅ CACHE Redis ready
   ```

3. **Verify H3 Index**
   - Wait for initialization to complete (~12 minutes first time)
   - Look for: `✅ H3 index built: 32,500,000 hexagons`

4. **After Successful Deploy**
   - Set `SKIP_INITIALIZATION=true` to speed up future restarts

---

## 🔍 Troubleshooting

### Issue: "Redis connection refused"

**Solution**: Check service names match internal hostnames
- Verify `redis-persistent.railway.internal` is correct
- Try using Railway's provided `REDIS_URL` directly

### Issue: "H3 index lost on restart"

**Solution**: Verify persistent Redis has RDB enabled
- Check `redis-persistent` has volume mounted at `/data`
- Check `REDIS_ARGS` includes `--save 60 1`
- Verify logs show: `✅ Persistence enabled`

### Issue: "Cache growing too large"

**Solution**: Verify cache Redis has LRU eviction
- Check `redis-cache` has `--maxmemory-policy allkeys-lru`
- Check `--maxmemory 512mb` is set
- Monitor memory usage in Railway dashboard

---

## 💰 Cost Estimate

| Resource | Plan | Monthly Cost |
|----------|------|--------------|
| PostgreSQL | Pro | ~$10 |
| Redis Persistent (8 GB) | Pro | ~$20 |
| Redis Cache (512 MB) | Starter | ~$5 |
| PinPoint API Service | - | ~$5 |
| **Total** | - | **~$40/month** |

**Cost Optimization Tips:**
- Use `SKIP_INITIALIZATION=true` after first deploy (reduces startup time)
- Monitor Redis cache hit rate (adjust size if needed)
- Consider smaller persistent Redis if H3 index is < 4 GB

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Two Redis services created (`redis-persistent`, `redis-cache`)
- [ ] `redis-persistent` has persistent volume mounted
- [ ] `redis-persistent` configured with `noeviction` and `save 60 1`
- [ ] `redis-cache` configured with `allkeys-lru` and `maxmemory 512mb`
- [ ] `REDIS_PERSISTENT_URL` set in PinPoint API
- [ ] `REDIS_CACHE_URL` set in PinPoint API
- [ ] `ADMIN_API_SECRET` generated and set (marked as secret)
- [ ] `JWT_SECRET` generated and set (marked as secret)
- [ ] `API_KEY_SALT` generated and set (marked as secret)
- [ ] Deployment successful
- [ ] Logs show both Redis connections successful
- [ ] H3 index built successfully
- [ ] H3 index survives service restart (verify persistence)

---

## 📚 Related Documentation

- **Architecture**: `docs/architecture/REDIS_DUAL_INSTANCE_ARCHITECTURE.md`
- **Environment Variables**: `docs/deployment/ENVIRONMENT_VARIABLES.md`
- **Redis Persistence**: `docs/architecture/REDIS_PERSISTENCE_GUIDE.md`

---

## 🆘 Need Help?

If you encounter issues:
1. Check Railway service logs
2. Verify Redis connection URLs are correct
3. Ensure persistent volume is mounted correctly
4. Review `REDIS_ARGS` configuration
5. Check that secrets are properly set

**Common Fix**: Restart both Redis services after config changes.
