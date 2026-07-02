# Load Testing Guide

Complete guide for load testing PinPoint India API.

---

## Quick Start

### 1. Get API Key ID

```bash
curl -s -H "X-Admin-Secret: $ADMIN_API_SECRET" \
  https://pynpoint-production.up.railway.app/api/v1/admin/api-keys | \
  jq '.[] | {id: .id, prefix: .prefix, tier: .tier}'
```

### 2. Set Unlimited Rate Limits

```bash
# Replace with your actual key ID
./scripts/set-unlimited-rate-limit.sh eceb6f30-4f5f-4000-865a-261a7e290107
```

### 3. Run Load Test

```bash
cd pynpoint
node scripts/load-test.js ppk_live_sk_39eac7181b1422ef95bd0174_1
```

---

## Understanding the Results

### Load Test Output

```
🔥 Medium Load - Single Pincode Lookup
Duration: 20s | Connections: 50

Total Requests               1,280
Requests/sec (avg)           64.00
Latency p50                  160ms
Latency p99                  1038ms
2xx responses                1,280
Errors                       0
```

**Key Metrics:**
- **Total Requests**: Total successfully sent
- **Requests/sec**: Sustainable throughput (RPS)
- **Latency p50**: Median response time
- **Latency p99**: 99th percentile (worst case for most users)
- **Errors**: Timeouts or connection failures

---

## Railway Metrics Analysis

After load testing, check Railway dashboard:

1. Go to https://railway.app
2. Navigate to your project → Metrics tab
3. Look for the time window when you ran the test

### What to Look For:

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| **CPU** | < 50% | 50-80% | > 80% |
| **Memory** | < 500 MB | 500 MB - 1 GB | > 1 GB |
| **Network RX** | Stable | Spiky | Dropping |

**From our test:**
- ✅ CPU: 31% (plenty of headroom)
- ✅ Memory: 160 MB (very stable)
- ✅ Network: 10 MB total (no issues)

---

## Rate Limit Testing Scenarios

### Scenario 1: Default Limits (PRO tier)

**Setup:**
```bash
# No changes needed - use existing PRO key
```

**Expected:**
- ✅ Light load (10 connections): Success
- ⚠️ Medium load (50 connections): Partial success (~14%)
- ❌ Heavy load (100+ connections): High failure rate

**Purpose:** Test realistic traffic patterns

---

### Scenario 2: Unlimited Limits

**Setup:**
```bash
./scripts/set-unlimited-rate-limit.sh <key-id>
```

**Expected:**
- ✅ All loads successful (limited only by infrastructure)

**Purpose:** Test infrastructure capacity

---

### Scenario 3: Custom Environment Limits

**Setup (.env or Railway):**
```bash
RATE_LIMIT_PRO_PER_MINUTE=10000
RATE_LIMIT_PRO_PER_DAY=1000000
```

**Expected:**
- Higher success rate at medium/heavy loads
- Good for staging environments

**Purpose:** Test with production-like but higher limits

---

## Interpreting Errors

### HTTP 429 (Too Many Requests)

**Cause:** Rate limit exceeded

**Solution:**
- Increase rate limits (environment variables or per-key overrides)
- Reduce concurrent connections in load test
- Implement client-side rate limiting

---

### Timeouts

**Cause:** Server overloaded or network issues

**Check:**
1. Railway CPU/Memory usage (should be < 80%)
2. Network latency (ping the server)
3. Database connection pool exhausted

**Solution:**
- Scale up Railway plan
- Optimize database queries
- Increase connection pool size

---

### Connection Refused

**Cause:** Too many concurrent connections

**Check:**
- Railway connection limits
- NestJS worker configuration

**Solution:**
- Reduce concurrent connections in test
- Enable cluster mode in NestJS

---

## Best Practices

### For Testing

1. **Start Small**: Begin with 1-10 connections
2. **Ramp Up Gradually**: Increase load incrementally
3. **Monitor First**: Watch Railway metrics during test
4. **Set Baselines**: Record normal performance metrics
5. **Test Endpoints Individually**: Don't test all endpoints at once

### For Production

1. **Keep Rate Limits Realistic**: Don't set unlimited in production
2. **Monitor Usage**: Track which customers hit limits
3. **Set Alerts**: Get notified at 80% CPU/Memory
4. **Cache Aggressively**: Redis for frequent queries
5. **Document Limits**: Communicate clearly to API users

---

## Load Test Script Customization

Edit `scripts/load-test.js` to test specific scenarios:

```javascript
// Test only one endpoint
const endpoints = [
  { path: '/api/v1/pincodes/110001', name: 'Single Pincode Lookup' },
];

// Adjust load levels
const tests = [
  { name: 'Light', duration: 10, connections: 10, pipelining: 1 },
  { name: 'Medium', duration: 20, connections: 50, pipelining: 1 },
];
```

---

## Troubleshooting

### Build Fails After Changes

```bash
cd pynpoint
npm run build
```

### Environment Variables Not Working

```bash
# Check if ConfigModule is imported in AuthModule
# Verify .env file exists and is loaded
node -e "console.log(process.env.RATE_LIMIT_PRO_PER_MINUTE)"
```

### Rate Limits Not Applied

```bash
# Check logs on Railway for rate limit configuration
# Look for: "Rate limits configured:"
```

---

## See Also

- [Rate Limiting Documentation](../api/RATE_LIMITING.md)
- [Railway Deployment Guide](../deployment/RAILWAY_DEPLOYMENT.md)
- [Environment Variables Reference](../deployment/ENVIRONMENT_VARIABLES.md)
