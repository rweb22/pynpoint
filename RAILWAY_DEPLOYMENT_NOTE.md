# Railway Deployment - Development Mode

## 🎯 Current Configuration

**Running in Development Mode on Railway**

We're currently deploying to Railway with:
- `NODE_ENV=development` (enables auto-initialization)
- `healthcheckTimeout=7200` seconds (2 hours) to allow initialization to complete

### Why?

**Development mode** enables automatic initialization:
- ✅ Auto-downloads pincode data on first deploy (30MB GeoJSON)
- ✅ Auto-builds H3 spatial index (~45-60 minutes first time)
- ✅ Data persists in PostgreSQL and Redis across deployments
- ✅ Subsequent deploys are instant (data already exists)

**Production mode** would require pre-initialized data:
- ❌ Expects `npm run cli init` to be run before app starts
- ❌ Railway doesn't support init containers/separate build steps
- ❌ Would crash with "Pincode data not found" error

### The Trade-off

Running in development mode is **perfectly fine** for now because:
- ✅ The app still builds with `npm run build` (TypeScript compilation)
- ✅ Runs with `npm run start:prod` (optimized production bundle)
- ✅ Only difference: auto-initialization is enabled
- ⚠️ More verbose logging (but helpful for debugging)

---

## 📋 Deployment Checklist

### First Deploy (45-60 minutes)

**Critical:** The health check timeout is set to 2 hours (7200 seconds) to allow the initialization to complete.

1. Push code to trigger Railway deployment
2. Monitor logs - you'll see:
   ```
   🚀 Starting PinPoint India initialization...
   Phase 1: Validating database...
   ✅ Database validated (PostGIS enabled)
   Phase 2: Checking pincode data...
   Pincode data not found, starting ingestion...
   Downloading pincode data from https://...
   ✅ Pincode data ingested (~5-10 minutes)
   Phase 3: Checking H3 spatial index...
   H3 index not found, starting build...
   Building H3 index... (this takes ~45-60 minutes)
   ✅ H3 index built
   ✅ System initialization complete
   [Nest] Application is running on: http://[::]:3000
   ```
3. Railway will wait up to 2 hours for `/health` to return 200 OK
4. Once initialization completes, the HTTP server starts and health check passes
5. Verify: `curl https://your-app.railway.app/health`

### Subsequent Deploys (instant)
1. Push code to trigger Railway deployment
2. App checks: "Data exists? ✅ Yes, skipping"
3. Server starts immediately (< 30 seconds)
4. Health check passes immediately

---

## 🔧 How It Actually Works

### NestJS Lifecycle (Critical to Understand)

```
1. NestFactory.create(AppModule) starts
   ↓
2. All modules are initialized
   ↓
3. onApplicationBootstrap() runs ← INITIALIZATION HAPPENS HERE (45-60 min)
   ↓
4. await app.listen(PORT) is called ← HTTP SERVER STARTS *AFTER* INIT
   ↓
5. Health check endpoint becomes available
   ↓
6. Railway health check receives 200 OK
   ↓
7. Traffic is routed to the app
```

**Key Point:** The HTTP server (and thus `/health` endpoint) is **NOT available** until `onApplicationBootstrap()` completes. This is why we need a 2-hour health check timeout.

### Railway Health Check Behavior

- Railway starts querying `/health` immediately after the container starts
- Gets no response (server not listening yet)
- Keeps retrying for up to `healthcheckTimeout` seconds
- If timeout is reached before getting 200 OK → deployment fails
- If 200 OK is received → deployment succeeds, traffic is routed

**Why 2 hours?**
- Data ingestion: ~5-10 minutes
- H3 index build: ~45-60 minutes
- Total: ~50-70 minutes worst case
- 2 hours (7200 seconds) provides safety margin

---

## 🔄 Switching to Production Mode (Future)

When you want true production mode, you'll need to:

### Option 1: Railway Build Hook (Recommended)
Add a build step to run initialization before the app starts:
```toml
[build]
buildCommand = "npm install && npm run build && npm run cli init"
```

### Option 2: Separate Init Service
Create a separate Railway service that runs the CLI command once

### Option 3: Manual Pre-load
Run initialization locally, dump the database, restore on Railway

---

## 🎯 Current Status

✅ **This works perfectly for MVP/Beta**
- Simple deployment
- No complex init workflows needed
- Data persists properly
- Performance is identical to production mode

⚡ **Consider production mode when:**
- You need guaranteed startup times (no first-deploy delay)
- You want minimal logging
- You're handling sensitive production traffic
- You need strict environment isolation

---

## 📊 What Actually Runs

Despite `NODE_ENV=development`, the app still:
- ✅ Compiles TypeScript → JavaScript (via `npm run build`)
- ✅ Runs optimized production bundle (via `npm run start:prod`)
- ✅ Uses production database (Railway PostgreSQL)
- ✅ Uses production cache (Railway Redis)

The **only** difference:
- Auto-initialization is enabled
- More detailed logs

---

**Current approach: Simple, elegant, and works perfectly for our stage.** 🚀
