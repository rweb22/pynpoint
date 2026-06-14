# Environment Variables Guide

**Last Updated**: 2026-06-14  
**Status**: Phase 1 & 2 Complete (Dual-Redis + Database Schema)

---

## 📋 Required Environment Variables

### Application

```bash
# Node environment (development, production, test)
NODE_ENV=production

# Port for HTTP server
PORT=3000
```

---

### Database (PostgreSQL with PostGIS)

```bash
# PostgreSQL connection string
# Format: postgresql://[user]:[password]@[host]:[port]/[database]
DATABASE_URL=postgresql://postgres:password@localhost:5432/pinpointindia

# Run migrations on startup (set to 'true' in production)
RUN_MIGRATIONS=true
```

**Railway Setup:**
- Railway automatically provides `DATABASE_URL` via Railway PostgreSQL service
- Enable PostGIS extension: Database > Settings > Enable PostGIS
- Set `RUN_MIGRATIONS=true` for automatic schema updates

---

### Redis (Dual-Instance Architecture)

**⚠️ IMPORTANT:** You need **TWO separate Redis instances** (or two databases on the same instance).

```bash
# Redis Instance 1: Persistent (H3 Spatial Index)
# - Purpose: Store 32.5M H3 hexagons permanently
# - Config: maxmemory-policy noeviction, RDB snapshots enabled
# - Size: 4-6 GB memory
REDIS_PERSISTENT_URL=redis://default:password@redis-persistent.railway.internal:6379

# Redis Instance 2: Cache (API Auth & Rate Limiting)
# - Purpose: API key cache, rate limit counters
# - Config: maxmemory-policy allkeys-lru, NO persistence
# - Size: 512 MB memory
REDIS_CACHE_URL=redis://default:password@redis-cache.railway.internal:6379

# Legacy fallback (deprecated - use specific URLs above)
REDIS_URL=redis://default:password@localhost:6379
```

**Railway Setup (Two Redis Services):**

1. **Create First Redis Service: "redis-persistent"**
   ```bash
   # Railway Dashboard:
   # 1. New > Database > Add Redis
   # 2. Name: redis-persistent
   # 3. Copy the REDIS_URL and set as REDIS_PERSISTENT_URL
   ```

2. **Create Second Redis Service: "redis-cache"**
   ```bash
   # Railway Dashboard:
   # 1. New > Database > Add Redis
   # 2. Name: redis-cache
   # 3. Copy the REDIS_URL and set as REDIS_CACHE_URL
   ```

**Local Development (Single Redis Instance, Two Databases):**
```bash
# If you only have one Redis locally, use different database numbers:
REDIS_PERSISTENT_URL=redis://localhost:6379/0  # Database 0 for H3 index
REDIS_CACHE_URL=redis://localhost:6379/1       # Database 1 for cache
```

**Why Two Instances?**
- H3 index needs `noeviction` policy (never delete data)
- Cache needs `allkeys-lru` policy (evict least recently used)
- These policies conflict in a single instance
- See `docs/architecture/REDIS_DUAL_INSTANCE_ARCHITECTURE.md`

---

### API Authentication (NEW - Phase 3)

```bash
# Admin API Secret (for main website to provision keys)
# Generate with: openssl rand -base64 32
ADMIN_API_SECRET=your-super-secret-admin-key-change-this-in-production

# JWT Secret for playground tokens (optional, for interactive docs)
# Generate with: openssl rand -base64 32
JWT_SECRET=your-jwt-secret-change-this-in-production

# API Key Settings
API_KEY_SALT=your-random-salt-for-key-generation  # openssl rand -base64 16
```

**Security Notes:**
- `ADMIN_API_SECRET`: Shared secret between main website and PinPoint API
- **NEVER** commit these secrets to git
- Use Railway's secret variables (they won't be logged)
- Rotate secrets periodically (every 90 days)

---

### Data Ingestion

```bash
# GeoJSON boundary data URL
PINCODE_DATA_URL=https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/postal/boundaries/Datagov_Pincode_Boundaries.geojson

# Optional: Checksum for data integrity verification
PINCODE_DATA_CHECKSUM=

# Force re-download and re-ingest data on startup (set to 'false' in production)
FORCE_REINGEST_DATA=false
```

---

### H3 Spatial Index

```bash
# H3 resolution level (9 = ~0.1km² hexagons)
# DO NOT CHANGE unless you rebuild the entire index
H3_RESOLUTION=9

# Enable boundary buffering for edge cases
H3_BUFFER_ENABLED=true

# Force rebuild H3 index on startup (set to 'false' in production)
FORCE_REBUILD_H3_INDEX=false
```

---

### Initialization

```bash
# Skip data ingestion and H3 indexing on startup
# Set to 'true' after initial deployment to speed up restarts
SKIP_INITIALIZATION=false
```

---

## 🚀 Railway Deployment Checklist

### Step 1: Create PostgreSQL Database
- [ ] Create PostgreSQL service in Railway
- [ ] Enable PostGIS extension (Settings > Extensions)
- [ ] Copy `DATABASE_URL` to environment variables

### Step 2: Create Two Redis Instances
- [ ] Create Redis service #1: "redis-persistent"
  - [ ] Copy URL → `REDIS_PERSISTENT_URL`
  - [ ] Configure: `maxmemory-policy noeviction`
  - [ ] Configure: `save 60 1` (RDB snapshots)
  - [ ] Attach persistent volume

- [ ] Create Redis service #2: "redis-cache"
  - [ ] Copy URL → `REDIS_CACHE_URL`
  - [ ] Configure: `maxmemory-policy allkeys-lru`
  - [ ] Configure: `maxmemory 512mb`
  - [ ] Configure: `save ""` (disable RDB)
  - [ ] No persistent volume needed

### Step 3: Set Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `RUN_MIGRATIONS=true`
- [ ] `DATABASE_URL` (auto-provided by Railway)
- [ ] `REDIS_PERSISTENT_URL` (from redis-persistent service)
- [ ] `REDIS_CACHE_URL` (from redis-cache service)
- [ ] `ADMIN_API_SECRET` (generate new: `openssl rand -base64 32`)
- [ ] `JWT_SECRET` (generate new: `openssl rand -base64 32`)
- [ ] `API_KEY_SALT` (generate new: `openssl rand -base64 16`)
- [ ] `SKIP_INITIALIZATION=false` (first deploy)

### Step 4: Deploy
- [ ] Push to GitHub
- [ ] Railway auto-deploys
- [ ] Check logs for successful initialization
- [ ] Verify H3 index built successfully (32.5M hexagons)
- [ ] After successful deploy, set `SKIP_INITIALIZATION=true`

---

## 🔐 Security Best Practices

1. **Never commit secrets to git**
   - Use `.env` locally (already in `.gitignore`)
   - Use Railway secret variables in production

2. **Rotate secrets regularly**
   - `ADMIN_API_SECRET`: Every 90 days
   - `JWT_SECRET`: Every 90 days

3. **Use strong random values**
   ```bash
   # Generate strong secrets
   openssl rand -base64 32  # For ADMIN_API_SECRET, JWT_SECRET
   openssl rand -base64 16  # For API_KEY_SALT
   ```

4. **Railway Secret Variables**
   - Mark sensitive vars as "secret" in Railway dashboard
   - They won't appear in logs or build output

---

## 📝 Summary

| Variable | Required | Phase | Default | Notes |
|----------|----------|-------|---------|-------|
| `NODE_ENV` | ✅ | All | development | Set to `production` in Railway |
| `PORT` | ✅ | All | 3000 | Railway auto-assigns |
| `DATABASE_URL` | ✅ | All | - | Auto-provided by Railway |
| `RUN_MIGRATIONS` | ✅ | All | false | Set to `true` in production |
| `REDIS_PERSISTENT_URL` | ✅ | 1+ | - | H3 index storage |
| `REDIS_CACHE_URL` | ✅ | 1+ | - | Auth/rate-limit cache |
| `ADMIN_API_SECRET` | ✅ | 3+ | - | 🔐 **Generate new!** |
| `JWT_SECRET` | ⚠️ | 3+ | - | Optional (playground) |
| `API_KEY_SALT` | ✅ | 3+ | - | 🔐 **Generate new!** |
| `H3_RESOLUTION` | ✅ | All | 9 | DO NOT CHANGE |
| `SKIP_INITIALIZATION` | ⚠️ | All | false | Set to `true` after first deploy |
| `FORCE_REINGEST_DATA` | ⚠️ | All | false | Use for data updates |
| `FORCE_REBUILD_H3_INDEX` | ⚠️ | All | false | Use for index rebuild |

**Legend:**
- ✅ Required
- ⚠️ Optional or situational
- 🔐 Security-sensitive (never commit!)

---

## 🛠️ Quick Reference: Generate Secrets

```bash
# Generate all required secrets at once
echo "ADMIN_API_SECRET=$(openssl rand -base64 32)"
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "API_KEY_SALT=$(openssl rand -base64 16)"
```

Copy the output and paste into Railway environment variables.
