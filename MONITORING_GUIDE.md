# Performance Monitoring Guide

## 🎯 Overview

Your PinPoint India API now has comprehensive performance monitoring that tracks:
- **Concurrent requests** - Real-time active connections
- **Database pool usage** - Connection utilization (out of 50 max)
- **Memory consumption** - Critical for Railway's 512MB limit
- **Redis operations** - Cache performance
- **Request rate** - Requests per minute with peak tracking
- **Slow requests** - Any request taking >1 second

---

## 📊 What You'll See in Logs

### Every Minute - Metrics Summary

```
[PerformanceMonitor] 📊 Metrics | 
  Requests: 5 active, 23 RPM (peak: 45) | 
  DB: 3/50 active (6%) | 
  Memory: 145MB RSS, 78MB heap | 
  Redis: 156 ops/sec
```

**Reading the metrics:**
- `5 active` - 5 concurrent requests right now
- `23 RPM` - 23 requests in the last minute
- `(peak: 45)` - Highest RPM since server start
- `DB: 3/50 active (6%)` - 3 database connections in use out of 50 max
- `145MB RSS` - Total memory used (Railway limit: 512MB)
- `78MB heap` - JavaScript heap memory
- `156 ops/sec` - Redis operations per second

---

### When Approaching Limits - Warnings

```
[PerformanceMonitor] ⚠️  PERFORMANCE WARNING:
  • DB pool at 82.0% capacity
  • RSS memory at 425MB (Railway limit: 512MB)
  • High concurrent requests: 85
```

**This means:**
- Database connections are running out
- Memory is approaching Railway's 512MB limit
- Server is handling high load

**Action:** If you see these warnings **sustained for >10 minutes**, it's time to upgrade.

---

### Slow Requests

```
[RequestTrackingInterceptor] 🐌 Slow request: GET /api/v1/pincodes?state=Delhi took 1234ms
```

**This means:**
- A specific request took over 1 second
- May indicate missing index, N+1 query, or database slowness

**Action:** If you see many of these, investigate the endpoint

---

## 🔍 How to View Logs

### Option 1: Railway Dashboard (Recommended)

1. Go to: https://railway.app/project/pynpoint-production/deployments
2. Click on your deployment
3. Click "View Logs" tab
4. Filter by:
   - `📊 Metrics` - See metrics summaries
   - `⚠️ PERFORMANCE WARNING` - See warnings only
   - `🐌 Slow request` - See slow requests

### Option 2: Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View live logs
railway logs
```

---

## ⚠️ Warning Thresholds

The monitoring will automatically warn you when:

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| **DB Pool** | >80% | >40 of 50 connections in use |
| **Memory RSS** | >400MB | Approaching Railway's 512MB limit |
| **Heap Utilization** | >85% | JavaScript memory pressure |
| **Concurrent Requests** | >80 | High load on server |

---

## 🚨 When to Upgrade to Railway Pro

Upgrade when you see **any of these patterns sustained for >10 minutes:**

1. ⚠️ **DB pool at 80%+** during business hours
2. ⚠️ **Memory >400MB** sustained
3. ⚠️ **Concurrent requests >80** frequently
4. ⚠️ **RPM >100** consistently
5. 🐌 **Many slow requests** (>10 per minute)

**Cost:** $20/month for Railway Pro

**Expected improvement:**
- Handle 200+ concurrent connections
- 500+ RPS capacity
- p99 latency <500ms
- Dedicated CPU (no throttling)
- 8GB memory (vs 512MB)

---

## 📈 Example Monitoring Scenarios

### Scenario 1: Healthy System (Current State)

```
[PerformanceMonitor] 📊 Metrics | 
  Requests: 3 active, 12 RPM (peak: 28) | 
  DB: 2/50 active (4%) | 
  Memory: 142MB RSS, 76MB heap | 
  Redis: 89 ops/sec
```

**Status:** ✅ **Healthy** - Well within limits
**Action:** None needed, system running smoothly

---

### Scenario 2: Moderate Load

```
[PerformanceMonitor] 📊 Metrics | 
  Requests: 45 active, 89 RPM (peak: 112) | 
  DB: 28/50 active (56%) | 
  Memory: 287MB RSS, 198MB heap | 
  Redis: 456 ops/sec
```

**Status:** ⚠️ **Watch Closely** - Moderate load
**Action:** Monitor for trends, prepare for upgrade if sustained

---

### Scenario 3: Approaching Limits (Time to Upgrade)

```
[PerformanceMonitor] ⚠️  PERFORMANCE WARNING:
  • DB pool at 84.0% capacity
  • RSS memory at 412MB (Railway limit: 512MB)

[PerformanceMonitor] 📊 Metrics | 
  Requests: 87 active, 134 RPM (peak: 156) | 
  DB: 42/50 active (84%) | 
  Memory: 412MB RSS, 289MB heap | 
  Redis: 678 ops/sec
```

**Status:** 🚨 **UPGRADE NEEDED** - At capacity
**Action:** Upgrade to Railway Pro immediately

---

## 🧪 Testing Monitoring

To generate traffic and see monitoring in action:

```bash
./scripts/test-monitoring.sh
```

This sends 20 concurrent requests, then wait 60 seconds to see the metrics log.

---

## 📝 Interpreting Trends

### Good Trends (Stay Free)
- Concurrent requests: 5-30 most of the time
- RPM: 20-80 average
- DB pool: <50% utilization
- Memory: <300MB RSS

### Warning Trends (Plan Upgrade)
- Concurrent requests: 40-70 during peak hours
- RPM: 80-120 sustained
- DB pool: 60-80% during business hours
- Memory: 300-400MB sustained

### Critical Trends (Upgrade Now)
- Concurrent requests: >80 frequently
- RPM: >120 sustained for >10 minutes
- DB pool: >80% for >5 minutes
- Memory: >400MB sustained
- Multiple warnings per hour

---

## 🔧 Advanced: Export Metrics

To send metrics to external monitoring (Datadog, New Relic, etc.):

Edit `src/monitoring/performance.monitor.ts`:

```typescript
private async gatherMetrics() {
  const metrics = await this.gatherMetrics();
  
  // Send to external service
  await fetch('https://your-monitoring-service.com/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metrics),
  });
  
  this.analyzeAndLog(metrics);
}
```

---

## 📊 Metrics Reference

| Metric | Description | Healthy Range | Warning Level |
|--------|-------------|---------------|---------------|
| **active** | Current concurrent requests | 0-50 | >80 |
| **RPM** | Requests per minute | 10-100 | >120 |
| **DB active** | Active database connections | 1-25 | >40 (80%) |
| **RSS** | Total memory used | 100-300MB | >400MB |
| **heap** | JavaScript heap memory | 50-200MB | >85% of total |
| **Redis ops/sec** | Cache operations | 50-500 | N/A |

---

## ✅ Summary

**You now have:**
- ✅ Real-time performance monitoring
- ✅ Automated warnings when approaching limits
- ✅ Clear upgrade signals based on actual usage
- ✅ Historical peak tracking
- ✅ Slow request detection

**Check your logs:**
https://railway.app/project/pynpoint-production/deployments

**Upgrade when sustained warnings appear for >10 minutes during business hours.**
