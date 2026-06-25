# Load Testing Guide

## Overview

This guide covers load testing for PinPoint India API to measure:
- **Maximum concurrent requests** the server can handle
- **Response time** under various load conditions
- **Error rates** and reliability
- **Throughput** (requests per second)
- **Latency percentiles** (p50, p75, p90, p99)

---

## Quick Start

### Option 1: Node.js Script (Recommended)

**Most comprehensive with detailed metrics:**

```bash
# Install dependencies (first time only)
cd pynpoint
npm install

# Run load tests
node scripts/load-test.js <API_KEY>
```

**Features:**
- ✅ Progressive load testing (ramp up from light to stress)
- ✅ Detailed latency percentiles (p50, p75, p90, p99, p99.9)
- ✅ Real-time progress bars
- ✅ Multiple endpoint testing
- ✅ Color-coded results
- ✅ Automatic error rate analysis

---

### Option 2: Shell Script (ApacheBench, wrk, hey)

**Simple and lightweight:**

```bash
# Using ApacheBench (default)
./scripts/load-test.sh <API_KEY>

# Using hey (Go-based, modern)
./scripts/load-test.sh <API_KEY> hey

# Using wrk (high-performance)
./scripts/load-test.sh <API_KEY> wrk
```

---

## Test Levels

The load tests run progressively increasing loads:

| Test | Duration | Concurrent | Total Requests | Purpose |
|------|----------|------------|----------------|---------|
| Warm-up | 5s | 1 | ~50 | Cache warming |
| Light Load | 10s | 10 | ~500 | Baseline performance |
| Medium Load | 20s | 50 | ~2,500 | Typical production load |
| Heavy Load | 30s | 100 | ~5,000 | Peak traffic simulation |
| Stress Test | 30s | 200 | ~10,000 | Stress limits |
| Ultra Stress | 30s | 500 | ~25,000 | Breaking point |

---

## Interpreting Results

### Key Metrics

**Requests Per Second (RPS):**
- **Good:** > 100 RPS
- **Acceptable:** 50-100 RPS
- **Poor:** < 50 RPS

**Latency (p99):**
- **Excellent:** < 100ms
- **Good:** 100-500ms
- **Acceptable:** 500-1000ms
- **Poor:** > 1000ms

**Error Rate:**
- **Excellent:** 0%
- **Good:** < 1%
- **Acceptable:** 1-5%
- **Poor:** > 5%

### Expected Performance (Based on Railway Free Tier)

**Cached Endpoints (e.g., `/administrative/states`):**
- RPS: 200-500
- p50 latency: 20-50ms
- p99 latency: 100-200ms

**Database Queries (e.g., `/pincodes/110001`):**
- RPS: 100-300
- p50 latency: 50-150ms
- p99 latency: 200-500ms

**Complex Queries (e.g., reverse geocode):**
- RPS: 50-150
- p50 latency: 200-500ms
- p99 latency: 500-1000ms

---

## Installation of Tools

### ApacheBench (ab)
```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install httpd
```

### hey (Modern HTTP load generator)
```bash
# Install Go first, then:
go install github.com/rakyll/hey@latest
```

### wrk (High-performance)
```bash
# Ubuntu/Debian
sudo apt-get install wrk

# macOS
brew install wrk
```

### autocannon (Node.js)
```bash
# Already installed via npm install in project
npm install -g autocannon  # For global CLI
```

---

## Sample Output

### Node.js Script Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 Medium Load - Single Pincode Lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Duration: 20s | Connections: 50

┌──────────────────────────┬──────────────────────────┐
│ Metric                   │ Value                    │
├──────────────────────────┼──────────────────────────┤
│ Total Requests           │ 4,521                    │
│ Requests/sec (avg)       │ 226.05                   │
│ Latency p50              │ 187ms                    │
│ Latency p99              │ 412ms                    │
│ Throughput (avg)         │ 89.45 KB/s               │
│ 2xx responses            │ 4521                     │
│ Errors                   │ 0                        │
└──────────────────────────┴──────────────────────────┘

✅ Low error rate: 0.00%
✅ Low latency: 187ms average
```

---

## Best Practices

1. **Start Small:** Always begin with warm-up tests
2. **Monitor Railway:** Watch Railway dashboard during tests for resource usage
3. **Recovery Time:** Wait 30-60s between heavy tests
4. **Production Warning:** Don't run ultra-stress tests on production during peak hours
5. **Rate Limits:** Be aware of your API tier rate limits

---

## Troubleshooting

### High Error Rates

**Symptom:** > 5% errors during load tests

**Possible Causes:**
- Rate limiting triggered
- Database connection pool exhausted
- Railway resource limits hit
- Network issues

**Solutions:**
- Reduce concurrent connections
- Check Railway logs for errors
- Verify database connection pool size
- Check Redis connection limits

### High Latency

**Symptom:** p99 > 1000ms

**Possible Causes:**
- Cold start (first requests after deployment)
- Database queries not optimized
- Redis cache misses
- Railway scaling up

**Solutions:**
- Run warm-up tests first
- Check query execution plans
- Verify cache hit rates
- Monitor Railway metrics

---

## Advanced Usage

### Test Specific Endpoint

```javascript
// Edit scripts/load-test.js
const endpoints = [
  { path: '/api/v1/pincodes/560001', name: 'Bangalore Pincode' },
];
```

### Custom Load Profile

```bash
# Using autocannon CLI directly
npx autocannon -c 100 -d 30 \
  -H "Authorization: Bearer <API_KEY>" \
  https://pynpoint-production.up.railway.app/api/v1/pincodes/110001
```

---

## Expected Limits (Railway Free Tier)

- **Concurrent Connections:** ~100-200 before degradation
- **Requests/Second:** ~200-300 sustained
- **Peak Burst:** ~500 RPS for short duration
- **Memory:** 512MB limit
- **CPU:** Shared, throttled under sustained load

**Note:** Upgrade to Railway Pro for better performance and higher limits.
