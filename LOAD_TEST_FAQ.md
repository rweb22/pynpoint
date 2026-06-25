# Load Testing FAQ

## Q1: What can ApacheBench do that autocannon cannot?

### ApacheBench (ab) Unique Features:

1. **HTTP/1.0 Support**
   - Can test legacy servers/proxies
   - autocannon only supports HTTP/1.1

2. **Simpler Output**
   - Plain text output, easy to parse with grep/awk
   - Standard format recognized by many monitoring tools

3. **Verbose Mode**
   - Shows individual request/response headers with `-v`
   - Good for debugging specific requests

4. **Standard Availability**
   - Pre-installed on many Linux systems
   - Part of apache2-utils package

5. **Basic Authentication**
   - Built-in support for HTTP Basic Auth with `-A`

### autocannon Unique Features:

1. **HTTP/1.1 Pipelining**
   - Better throughput testing
   - More realistic modern load

2. **Better Metrics**
   - Detailed latency percentiles (p50, p75, p90, p99, p99.9)
   - ApacheBench only shows basic stats

3. **Progress Bars**
   - Real-time visual feedback
   - ApacheBench has no progress indication

4. **Node.js Integration**
   - Easy to extend with custom logic
   - Can test multiple endpoints in one script

5. **Richer Output**
   - Color-coded results
   - Automatic error analysis
   - JSON output option

### Recommendation:

- **Use autocannon** for modern HTTP/1.1 APIs (like PinPoint India)
- **Use ApacheBench** when:
  - Testing HTTP/1.0 compatibility
  - You need the simplest possible tool
  - You're on a system without Node.js
  - You want industry-standard output format

---

## Q2: Rate Limits - Per Minute AND Per Day

### Answer: BOTH Limits Are Enforced!

Your API has a **two-tier rate limiting system**:

1. **Per Minute Limit** (sliding window)
2. **Per Day Limit** (daily quota)

Both are checked on **every request**, and if either is exceeded, you get HTTP 429.

### Default Free Tier Limits:

```typescript
free: {
  requestsPerMinute: 60,    // ⚠️ This was blocking your load tests!
  requestsPerDay: 1000,
}
```

### Why Your Load Tests Failed:

**Light Load Test:**
- 10 concurrent connections for 10 seconds
- ~45 RPS × 10s = 450 requests
- **450 requests in 10s = way over 60/min limit**
- Result: 91% HTTP 429 errors

### Solution: Custom Rate Limit Overrides

You can set **custom limits per API key** using the admin API:

```bash
# Set 10M per minute, 100M per day
./scripts/set-high-rate-limit.sh <API_KEY_ID> <ADMIN_SECRET>
```

This updates the `rate_limit_overrides` field in the database, which takes precedence over tier defaults.

---

## Rate Limit Architecture

### How It Works:

<augment_code_snippet path="pynpoint/src/auth/interceptors/rate-limit.interceptor.ts" mode="EXCERPT">
````typescript
// Check minute-level rate limit (Redis)
const minuteKey = `ratelimit:${customerId}:minute:${getCurrentMinute()}`;
const minuteCount = await redisCache.incr(minuteKey);
if (minuteCount === 1) {
  await redisCache.expire(minuteKey, 60); // TTL = 60 seconds
}
if (minuteCount > limits.requestsPerMinute) {
  throw new HttpException(429, 'Rate limit exceeded');
}

// Check day-level rate limit (Redis)
const dayKey = `ratelimit:${customerId}:day:${getCurrentDay()}`;
const dayCount = await redisCache.incr(dayKey);
if (dayCount === 1) {
  await redisCache.expire(dayKey, 86400); // TTL = 24 hours
}
if (dayCount > limits.requestsPerDay) {
  throw new HttpException(429, 'Daily limit exceeded');
}
````
</augment_code_snippet>

### Time Windows:

- **Per Minute:** Rolling 60-second window (resets every minute)
- **Per Day:** Rolling 24-hour window (resets every day)
- **Storage:** Redis with auto-expiring keys

### Response Headers:

Every authenticated request includes rate limit headers:

```http
X-RateLimit-Limit-Minute: 10000000
X-RateLimit-Remaining-Minute: 9999550
X-RateLimit-Reset-Minute: 1719282780
X-RateLimit-Limit-Day: 100000000
X-RateLimit-Remaining-Day: 99999550
X-RateLimit-Reset-Day: 1719366600
```

---

## Setting Custom Limits

### Method 1: Using the Script (Easiest)

```bash
# Get your API key ID from the create response
curl -X POST "https://pynpoint-production.up.railway.app/api/v1/admin/api-keys" \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"externalCustomerId":"load-test","tier":"free"}'

# Copy the "id" field, then run:
./scripts/set-high-rate-limit.sh <API_KEY_ID> <ADMIN_SECRET>
```

### Method 2: Direct Admin API Call

```bash
curl -X PATCH "https://pynpoint-production.up.railway.app/api/v1/admin/api-keys/<KEY_ID>/tier" \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "free",
    "rateLimitOverrides": {
      "requests_per_minute": 10000000,
      "requests_per_day": 100000000
    }
  }'
```

### Method 3: Create Key with Custom Limits

```bash
curl -X POST "https://pynpoint-production.up.railway.app/api/v1/admin/api-keys" \
  -H "X-Admin-Secret: <ADMIN_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "externalCustomerId": "load-test-unlimited",
    "tier": "enterprise",
    "rateLimitOverrides": {
      "requests_per_minute": 10000000,
      "requests_per_day": 100000000
    }
  }'
```

---

## Load Testing Best Practices

### 1. Set High Limits First

Always configure custom limits before load testing to avoid false positives.

### 2. Check Response Headers

Monitor the rate limit headers to see actual usage:

```bash
curl -i "https://pynpoint-production.up.railway.app/api/v1/pincodes/110001" \
  -H "Authorization: Bearer <API_KEY>" | grep X-RateLimit
```

### 3. Redis Cache Invalidation

After updating rate limits, the Redis cache is automatically invalidated, so changes take effect immediately.

### 4. Production Warning

**Don't run heavy load tests on production during peak hours!**

Consider:
- Railway staging environment
- Off-peak hours
- Separate load testing API keys

---

## Quick Reference

### Current API Key Status:

```
API Key ID: d8fc6825-290b-41a2-9f5b-3a130dabf592
Key: ppk_live_sk_8689efc7dc26ba52c54e88c9_5
Tier: free
Limits:
  - Per Minute: 10,000,000 ✅ (custom override)
  - Per Day: 100,000,000 ✅ (custom override)
```

### Run Load Test:

```bash
node scripts/load-test.js ppk_live_sk_8689efc7dc26ba52c54e88c9_5
```

### Expected Results:

With 10M/min limit, you should now see:
- ✅ 0% rate limit errors (no HTTP 429)
- ✅ True server performance metrics
- ✅ Accurate latency measurements
- ✅ Real bottleneck identification

---

## Summary

1. **ApacheBench vs autocannon:** autocannon is better for modern APIs
2. **Rate limits:** BOTH per-minute AND per-day limits are enforced
3. **Solution:** Set `rateLimitOverrides` to 10M/min, 100M/day for load testing
4. **Your key:** Already updated with high limits ✅

**You're now ready to run proper load tests without rate limiting!** 🚀
