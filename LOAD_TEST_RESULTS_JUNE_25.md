# Load Test Results - June 25, 2026

## 🎯 Test Configuration

**Date:** 2026-06-25 (Post-Performance Fixes)  
**Tool:** autocannon (Node.js HTTP benchmarking)  
**API Key:** ppk_live_sk_8689efc7dc26ba52c54e88c9_5 (10M/min rate limit)  
**Fixes Applied:**
- ✅ Database connection pool: 10 → 50 max connections
- ✅ Redis auto-pipelining enabled
- ✅ N+1 query optimization for post offices

---

## 📊 Results Summary

### Single Pincode Lookup (`/pincodes/110001`)

| Concurrent | Duration | Total Reqs | RPS (avg) | Errors | Error % | p50 | p99 | p99.9 | Status |
|-----------|----------|------------|-----------|--------|---------|-----|-----|-------|--------|
| 1 | 5s | 15 | 3 | 0 | **0%** | 204ms | 1645ms | 1645ms | ✅ PASS |
| 10 | 10s | 445 | 44.5 | 0 | **0%** | 160ms | 1520ms | 2070ms | ✅ PASS |
| 50 | 20s | 2,670 | 133.5 | 0 | **0%** | 336ms | 3710ms | 7523ms | ✅ PASS |
| 100 | 30s | 3,790 | 126.3 | 102 | **2.69%** | 420ms | 3900ms | 9360ms | ⚠️ DEGRADED |
| 200 | 30s | 3,422 | 114.1 | 414 | **12.1%** | 421ms | 3558ms | 9144ms | 🔴 FAIL |
| 500 | 30s | 0 | 0 | 1432 | **100%** | 0ms | 0ms | 0ms | 💀 DEAD |

### Search Pincodes (`/pincodes?state=Delhi&limit=10`)

| Concurrent | Duration | Total Reqs | RPS (avg) | Errors | Error % | p50 | p99 | p99.9 | Status |
|-----------|----------|------------|-----------|--------|---------|-----|-----|-------|--------|
| 1 | 5s | 0 | 0 | 0 | 0% | 0ms | 0ms | 0ms | ⚠️ TIMEOUT |
| 10 | 10s | 0 | 0 | 10 | **100%** | 0ms | 0ms | 0ms | 💀 DEAD |
| 50 | 20s | 0 | 0 | 97 | **100%** | 0ms | 0ms | 0ms | 💀 DEAD |
| 100 | 30s | 1,843 | 61.4 | 206 | **11.2%** | 269ms | 6212ms | 9893ms | 🔴 FAIL |
| 200 | 30s | 1,813 | 60.4 | 531 | **29.3%** | 256ms | 2076ms | 9532ms | 🔴 FAIL |
| 500 | 30s | 0 | 0 | 1486 | **100%** | 0ms | 0ms | 0ms | 💀 DEAD |

### Administrative States (`/administrative/states`)

All tests returned **100% timeout/failure** - Server crashed during heavy pincode tests.

---

## 📈 Comparison: Before vs After Fixes

### At 100 Concurrent Connections (Pincode Lookup)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Error Rate** | 2.92% | **2.69%** | ✅ 8% reduction |
| **p99 Latency** | 3,497ms | **3,900ms** | ❌ 11% worse |
| **Total Requests** | ~3,800 | 3,790 | ~same |
| **RPS** | ~132 | 126.3 | ❌ Slight drop |

### At 200 Concurrent Connections (Pincode Lookup)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Error Rate** | 11.81% | **12.1%** | ❌ Slightly worse |
| **p99 Latency** | ~9s+ | **3,558ms** | ✅ 60% better |
| **Total Requests** | ~3,600 | 3,422 | ❌ Slight drop |
| **RPS** | ~120 | 114.1 | ❌ Slight drop |

---

## 🔍 Key Findings

### ✅ Successes

1. **0% error rate at 10-50 concurrent** - Fixes worked for light-medium load
2. **p99 latency improved at 200 concurrent** - N+1 fix helped (9s → 3.5s)
3. **RPS plateau confirmed** - Consistently ~126-133 RPS (Railway limit)
4. **No connection pool exhaustion** - Would have seen higher error rates

### 🚨 Critical Issues

1. **Server crash at 500 concurrent** - Complete failure, likely Railway container restart
2. **Search endpoint completely failed** - 100% timeout on all tests except 100/200 concurrent
3. **Error rate NOT eliminated at 100+ concurrent** - Still 2.69% errors
4. **High p99 latency spikes** - 3-9 seconds (unacceptable for production)

---

## 💡 Root Cause Analysis

### Why Fixes Didn't Fully Work

1. **Railway Free Tier CPU Throttling**
   - RPS plateaus at ~130 regardless of concurrency
   - Under sustained load, Railway throttles shared CPU
   - Container likely OOM-killed at 500 concurrent

2. **N+1 Fix Not Applied Everywhere**
   - Search endpoint still slow (p99: 6-9s)
   - May have other N+1 queries we didn't catch

3. **Database Pool Still Too Small**
   - 50 connections may not be enough for 200+ concurrent
   - PostgreSQL max_connections on Railway might be limited

4. **Missing Indexes on Search Queries**
   - `/pincodes?state=Delhi` performing poorly
   - May need composite index on (state, district, city)

---

## 🎯 Next Steps (Priority Order)

### 1. Check Railway Logs for Crash Reason (URGENT)
```bash
# SSH into Railway or check dashboard logs
# Look for OOM kills, database connection errors
```

### 2. Add Missing Indexes for Search Performance
```sql
CREATE INDEX CONCURRENTLY idx_pincodes_search 
ON pincodes (state, district, city, is_active);
```

### 3. Increase Database Pool Further
```typescript
// Try 100 max connections
max: 100,
min: 10,
```

### 4. Add Query Timeout Protection
```typescript
// Prevent long-running queries from blocking
connectionTimeoutMillis: 5000,
statementTimeout: 5000,  // 5 second query timeout
```

### 5. Consider Railway Pro Upgrade ($20/mo)
- Dedicated CPU (no throttling)
- 8GB memory (vs 512MB)
- Expected: 3-5x RPS improvement

---

## ✅ Success Criteria (Not Met)

| Criterion | Target | Actual | Met? |
|-----------|--------|--------|------|
| 100 concurrent @ 0% errors | 0% | **2.69%** | ❌ |
| 200 concurrent @ <2% errors | <2% | **12.1%** | ❌ |
| p99 latency @ 100 concurrent | <500ms | **3,900ms** | ❌ |
| Max RPS | >200 | **126** | ❌ |

**Overall: FAIL** - Partial improvement but not production-ready.

---

## 📝 Recommendations

**SHORT TERM (Do Now):**
1. ✅ Investigate Railway logs for crash reason
2. ✅ Add composite index for search queries
3. ✅ Increase connection pool to 100
4. ✅ Add statement timeouts

**MEDIUM TERM (This Week):**
1. Upgrade to Railway Pro tier for dedicated resources
2. Set up query performance monitoring
3. Add slow query logging (>100ms)

**LONG TERM (Future):**
1. Implement horizontal scaling (load balancer + multiple instances)
2. Add read replicas for heavy queries
3. Implement aggressive caching (60s TTL for search results)

---

**Status:** Fixes provided SOME improvement but system is NOT production-ready for >50 concurrent users.
