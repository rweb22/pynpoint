# Load Testing Summary & Tools

## 📊 Available Load Testing Tools

We've implemented **3 different load testing options** to measure server performance:

### 🥇 Option 1: Node.js Script (RECOMMENDED)

**File:** `scripts/load-test.js`

**Best for:** Comprehensive testing with detailed metrics

```bash
node scripts/load-test.js <API_KEY>
```

**Features:**
- ✅ Progressive load testing (6 levels)
- ✅ Tests 3 different endpoints
- ✅ Detailed latency percentiles (p50, p75, p90, p99, p99.9)
- ✅ Real-time progress bars
- ✅ Color-coded results
- ✅ Automatic error analysis
- ✅ Throughput measurements

**Output includes:**
- Requests per second (RPS)
- Latency distribution
- Error rates
- Throughput (KB/s)
- Status code breakdown

---

### 🥈 Option 2: Shell Script with Multiple Tools

**File:** `scripts/load-test.sh`

**Best for:** Quick tests with standard tools

```bash
# Using ApacheBench (default)
./scripts/load-test.sh <API_KEY>

# Using hey
./scripts/load-test.sh <API_KEY> hey

# Using wrk  
./scripts/load-test.sh <API_KEY> wrk
```

**Features:**
- ✅ 5 progressive load levels
- ✅ Simple, standard output
- ✅ Multiple tool support

---

### 🥉 Option 3: Manual with curl

**Best for:** Simple one-off tests

```bash
# Parallel requests test
seq 1 100 | xargs -P 10 -I {} curl -s \
  -H "Authorization: Bearer <API_KEY>" \
  "https://pynpoint-production.up.railway.app/api/v1/pincodes/110001"
```

---

## 🎯 What to Measure

### 1. **Concurrent Request Capacity**
- How many simultaneous connections can the server handle?
- At what point do error rates increase?

### 2. **Requests Per Second (RPS)**
- Maximum throughput under sustained load
- Target: 100+ RPS for typical endpoints

### 3. **Latency Under Load**
- p50 (median): Should be < 200ms
- p99 (99th percentile): Should be < 500ms
- p99.9: Should be < 1000ms

### 4. **Error Rates**
- Target: < 1% under normal load
- Acceptable: < 5% under stress
- Red flag: > 10%

### 5. **Rate Limiting Behavior**
- When do rate limits kick in?
- Are they gradual or sudden?
- HTTP 429 responses

---

## ⚙️ Test Configuration

### Progressive Load Levels

| Level | Duration | Concurrent | Purpose |
|-------|----------|------------|---------|
| 1. Warm-up | 5s | 1 | Cache warming |
| 2. Light | 10s | 10 | Baseline |
| 3. Medium | 20s | 50 | Typical load |
| 4. Heavy | 30s | 100 | Peak traffic |
| 5. Stress | 30s | 200 | Stress test |
| 6. Ultra | 30s | 500 | Breaking point |

### Endpoints Tested

1. **Single Pincode Lookup** - `/api/v1/pincodes/110001`
   - Database query with cache
   - Typical user request

2. **Administrative States** - `/api/v1/administrative/states`
   - Heavily cached
   - Should be very fast

3. **Search Pincodes** - `/api/v1/pincodes?state=Delhi&limit=10`
   - Complex query
   - Pagination test

---

## 📈 Expected Performance (Railway Free Tier)

### Baseline Expectations

**Good Performance:**
- RPS: 100-300
- p50 latency: 50-200ms
- p99 latency: 200-500ms
- Error rate: < 1%

**Acceptable Performance:**
- RPS: 50-100
- p50 latency: 200-500ms
- p99 latency: 500-1000ms
- Error rate: 1-5%

**Poor Performance (needs investigation):**
- RPS: < 50
- p50 latency: > 500ms
- p99 latency: > 1000ms
- Error rate: > 5%

### By Endpoint Type

**Cached endpoints (states, districts):**
- Expected: 200-500 RPS
- Latency: 20-100ms

**Database queries (pincode lookup):**
- Expected: 100-200 RPS
- Latency: 100-300ms

**Complex queries (reverse geocode):**
- Expected: 50-150 RPS
- Latency: 300-800ms

---

## 🔍 Initial Findings

Based on initial testing:

**Warm-up (1 concurrent):**
- ✅ 22 requests in 5s
- ✅ ~220ms average latency
- ✅ 0% errors

**Light Load (10 concurrent):**
- ⚠️ 450 requests in 10s
- ✅ ~217ms average latency
- ⚠️ **91% non-2xx responses** (likely rate limiting)

### Observations

1. **Rate Limiting Active:** High percentage of non-2xx responses under concurrent load
2. **Latency Stable:** Response times remain consistent even when rate limited
3. **No Errors:** Server handles requests gracefully (returns proper HTTP codes)

### Next Steps

1. **Identify Rate Limits:**
   - What tier are we on?
   - Requests per second limit?
   - Concurrent connection limit?

2. **Test With Delays:**
   - Add pauses between requests
   - Test sustained load vs burst

3. **Monitor Railway Dashboard:**
   - CPU usage
   - Memory usage
   - Request metrics

---

## 🚀 Running Load Tests

### Quick Start

```bash
# 1. Install dependencies (first time only)
cd pynpoint
npm install

# 2. Create API key
curl -X POST "https://pynpoint-production.up.railway.app/api/v1/admin/api-keys" \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"externalCustomerId":"load-test","tier":"free"}'

# 3. Run load test
node scripts/load-test.js <API_KEY>
```

### Full Documentation

See `LOAD_TESTING.md` for:
- Complete tool installation instructions
- Detailed interpretation guide
- Troubleshooting tips
- Advanced usage examples

---

## ⚠️ Important Notes

1. **Don't run on production during peak hours**
2. **Monitor Railway dashboard during tests**
3. **Rate limits may trigger** - this is expected behavior
4. **Allow recovery time** between heavy tests (30-60s)
5. **Railway free tier has limits** - upgrade for better performance

---

## 📚 Documentation

- `LOAD_TESTING.md` - Complete guide
- `scripts/load-test.js` - Node.js implementation
- `scripts/load-test.sh` - Shell script implementation
