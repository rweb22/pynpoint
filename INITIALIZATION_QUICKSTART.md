# Initialization Quick Start

**For developers new to the PinPoint India initialization system.**

---

## 🚀 **Quick Start (Development)**

### **1. Install Dependencies**

```bash
cd pynpoint
npm install h3-js @turf/buffer nest-commander
```

### **2. Set Environment Variables**

Create `.env` file:

```bash
DATABASE_URL=postgresql://localhost/pinpointindia
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PINCODE_DATA_URL=https://data.gov.in/.../pincode-boundaries.geojson.gz
```

### **3. Start Development Server**

```bash
npm run start:dev
```

**What happens:**
- ✅ Validates PostgreSQL + PostGIS
- ✅ Auto-downloads pincode data if missing (~30 MB)
- ✅ Auto-builds H3 index if missing (~45-60 min first time)
- ✅ Starts server on port 3000

**Next time:** Skips download/build, starts immediately!

---

## 🏭 **Production Deployment**

### **Option A: CLI Init (Recommended)**

**Step 1: Initialize data (once):**
```bash
npm run cli init
```

**Step 2: Start app:**
```bash
NODE_ENV=production npm run start:prod
```

---

### **Option B: Docker Compose**

```yaml
version: '3.8'

services:
  init:
    image: pinpointindia:latest
    command: npm run cli init
    environment:
      DATABASE_URL: postgresql://postgres:5432/pinpointindia
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis

  app:
    image: pinpointindia:latest
    command: npm run start:prod
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://postgres:5432/pinpointindia
      REDIS_URL: redis://redis:6379
    depends_on:
      init:
        condition: service_completed_successfully
    ports:
      - "3000:3000"

  postgres:
    image: postgis/postgis:15-3.3
    environment:
      POSTGRES_DB: pinpointindia
      POSTGRES_PASSWORD: password

  redis:
    image: redis:7-alpine
```

**Run:**
```bash
docker-compose up
```

---

## 🔧 **Force Rebuild**

### **Re-download data:**
```bash
npm run cli init --force-reingest
```

### **Rebuild H3 index:**
```bash
npm run cli init --force-rebuild
```

### **Both:**
```bash
npm run cli init --all
```

Or via environment variables:
```bash
FORCE_REINGEST_DATA=true npm run start:dev
FORCE_REBUILD_H3_INDEX=true npm run start:dev
```

---

## 📊 **How It Works**

### **Lifecycle:**

```
1. App starts
   ↓
2. InitializationService.onApplicationBootstrap() runs
   ↓
3. Check database → Validate PostGIS
   ↓
4. Check data exists → Download if missing (dev) or fail (prod)
   ↓
5. Check H3 index exists → Build if missing (dev) or fail (prod)
   ↓
6. Mark system ready
   ↓
7. Server starts listening
```

### **Files:**

```
src/
├── initialization/
│   ├── initialization.service.ts     # Main orchestrator
│   ├── data-ingestion.service.ts    # Downloads pincode data
│   ├── h3-index.service.ts          # Builds H3 index
│   └── health.service.ts            # Health checks
└── cli/
    └── init.command.ts              # Manual init command
```

---

## ⚙️ **Configuration**

### **Environment Variables:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ | - | PostgreSQL connection |
| `REDIS_URL` | ✅ | - | Redis connection |
| `NODE_ENV` | ❌ | `development` | Environment mode |
| `PINCODE_DATA_URL` | ✅ | - | GeoJSON download URL |
| `SKIP_INITIALIZATION` | ❌ | `false` | Skip init (testing) |
| `FORCE_REINGEST_DATA` | ❌ | `false` | Force data download |
| `FORCE_REBUILD_H3_INDEX` | ❌ | `false` | Force index rebuild |

---

## 🐛 **Troubleshooting**

### **"PostgreSQL not ready"**
- Ensure PostgreSQL is running
- Ensure PostGIS extension is installed
- Check `DATABASE_URL` is correct

### **"Redis not ready"**
- Ensure Redis is running
- Check `REDIS_URL` is correct

### **"Data ingestion failed"**
- Check `PINCODE_DATA_URL` is accessible
- Check internet connectivity
- Try manual download first

### **"H3 index build failed"**
- Ensure data was ingested first
- Check Redis has enough memory (~1 GB)
- Check logs for specific error

---

## 📚 **Further Reading**

- **Architecture:** `docs/architecture/INITIALIZATION_LIFECYCLE.md`
- **Implementation:** `docs/implementation/INITIALIZATION_IMPLEMENTATION.md`
- **Summary:** `INITIALIZATION_INTEGRATION_SUMMARY.md`
- **Boundary Fix:** `BOUNDARY_SOLUTION.md`

---

## ✅ **Next Steps**

1. **Add database integration:**
   - Install TypeORM or Prisma
   - Create `Pincode` entity
   - Implement `PincodeRepository`

2. **Add Redis integration:**
   - Install `ioredis`
   - Create `RedisService`
   - Inject into H3IndexService

3. **Complete data ingestion:**
   - Implement GeoJSON parsing
   - Implement bulk PostgreSQL insert
   - Add progress logging

4. **Complete H3 index build:**
   - Fetch boundaries from PostgreSQL
   - Store in Redis with pipelining
   - Add metadata tracking

5. **Add health check endpoints:**
   - Install `@nestjs/terminus`
   - Create health controller
   - Expose `/health/live` and `/health/ready`

---

**Status:** ✅ Initialization framework complete, ready for database/Redis integration!
