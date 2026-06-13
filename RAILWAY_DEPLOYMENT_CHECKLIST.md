# Railway Deployment Checklist

## 🚀 Pre-Deployment Setup

### 1. Create Railway Services

Create these services in your Railway project:

- [ ] **PostgreSQL** - Database service
- [ ] **Redis** - Cache service  
- [ ] **Web Service** - The pynpoint application (from GitHub)

### 2. Configure Environment Variables

In Railway Dashboard → Web Service → Variables, set:

```bash
# Application
NODE_ENV=production
PORT=3000

# Database (linked from PostgreSQL service)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (linked from Redis service)
REDIS_URL=${{Redis.REDIS_URL}}

# Migrations - CRITICAL!
RUN_MIGRATIONS=true

# Data Ingestion
PINCODE_DATA_URL=<REPLACE_WITH_ACTUAL_URL>
SKIP_INITIALIZATION=true

# H3 Index
H3_RESOLUTION=9
H3_BUFFER_ENABLED=true
```

### 3. Verify GitHub Connection

- [ ] Repository connected: `rweb22/pynpoint`
- [ ] Branch: `main`
- [ ] Auto-deploy enabled

---

## 📋 Deployment Steps

### Step 1: Initial Deployment

1. Push latest code to GitHub
2. Railway auto-deploys
3. Build runs: `npm install && npm run build`
4. Migrations run automatically (if `RUN_MIGRATIONS=true`)
5. App starts: `npm run start:prod`

**Expected Logs:**
```
✅ Data Source initialized
✅ Migration InitialSchema1718260800000 has been executed successfully
✅ PostGIS version: 3.x.x
✅ Redis connected
⚠️  System initialization skipped (SKIP_INITIALIZATION=true)
Server listening on port 3000
```

### Step 2: Verify Health Endpoints

Test these endpoints:

```bash
# Overall health
curl https://your-app.railway.app/health

# Liveness probe
curl https://your-app.railway.app/health/live

# Readiness probe
curl https://your-app.railway.app/health/ready

# Detailed status
curl https://your-app.railway.app/health/status
```

**Expected Response:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "initialization": { "status": "down", "ready": false }
  }
}
```

Note: `initialization.status = "down"` is expected because `SKIP_INITIALIZATION=true`.

### Step 3: Verify Database Schema

Connect to PostgreSQL and verify:

```bash
# Via Railway CLI
railway link <postgres-service-name>
railway run psql

# Check extensions
SELECT * FROM pg_extension WHERE extname = 'postgis';

# Check tables
\dt

# Check pincodes table structure
\d pincodes

# Check migration history
SELECT * FROM typeorm_migrations;
```

**Expected Output:**
```
Table "public.pincodes"
Column       | Type                      | Modifiers
-------------+---------------------------+----------
id           | integer                   | PRIMARY KEY
pincode      | character varying(6)      | UNIQUE
boundary     | geography(MultiPolygon)   | NOT NULL
state        | character varying(100)    |
...
```

---

## ⚠️ Known Issues & Solutions

### Issue 1: PostGIS Extension Error

**Error:** `ERROR: extension "postgis" does not exist`

**Cause:** Database user lacks CREATE EXTENSION privilege.

**Solution:**
```bash
railway link <postgres-service-name>
railway run psql -c "ALTER DATABASE railway WITH OWNER postgres;"
railway run psql -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Issue 2: Migration Already Exists

**Error:** `Table 'typeorm_migrations' already exists`

**Cause:** Migrations ran before but table wasn't tracked.

**Solution:**
```bash
# Check what migrations ran
railway run npm run migration:show

# If needed, manually insert migration record
railway run psql -c "INSERT INTO typeorm_migrations (timestamp, name) VALUES (1718260800000, 'InitialSchema1718260800000');"
```

### Issue 3: Build Fails

**Error:** Dependency resolution errors

**Cause:** Version conflicts or missing dependencies.

**Solution:**
Check logs, fix package.json, push changes.

---

## 🔄 Post-Deployment Tasks

### Option A: Load Data Manually (Later)

Keep `SKIP_INITIALIZATION=true` and load data when ready via:
- CLI command (when implemented)
- Admin endpoint (when implemented)
- Direct database import

### Option B: Enable Auto-Initialization

⚠️ **Not recommended yet** - data source URL needs to be fixed first.

1. Find correct PINCODE_DATA_URL
2. Update environment variable
3. Set `SKIP_INITIALIZATION=false`
4. Redeploy

---

## ✅ Deployment Success Criteria

- [x] Build completes successfully
- [x] Migrations run (check logs for "Migration ... has been executed")
- [x] PostGIS extension enabled
- [x] Database schema created (pincodes table exists)
- [x] App starts without crashing
- [x] Health endpoints respond
- [x] Database connection works
- [x] Redis connection works
- [ ] Data loaded (deferred to later)
- [ ] H3 index built (deferred to later)

---

## 🎯 What Works After First Deploy

✅ **Working:**
- Application starts and stays running
- Health check endpoints
- Database connectivity
- Redis connectivity
- PostGIS extension enabled
- Schema created via migrations

❌ **Not Working Yet (Expected):**
- No pincode data in database (0 rows)
- No H3 spatial index in Redis
- API endpoints not implemented yet

---

## 📊 Monitoring

Watch these in Railway Dashboard:

1. **Deployment Logs** - Check for migration success
2. **Metrics** - CPU, Memory, Response times
3. **Health Checks** - Should pass after deployment

---

## 🚨 Rollback Plan

If deployment fails:

```bash
# Revert to previous deploy in Railway Dashboard
# OR revert last migration:
railway run npm run migration:revert

# Then redeploy previous commit
```

---

## 📝 Next Steps After Successful Deploy

1. ✅ Verify all health checks pass
2. ✅ Confirm database schema is correct
3. ⏭️ Find correct PINCODE data source URL
4. ⏭️ Implement data loading strategy
5. ⏭️ Build H3 spatial index
6. ⏭️ Implement API endpoints
7. ⏭️ Add API documentation

---

**Last Updated:** 2024-06-13
