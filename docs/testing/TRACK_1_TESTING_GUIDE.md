# Track 1 Testing Guide

## 🧪 Testing Pincode Solo Operations

This guide walks through testing all 6 Track 1 endpoints with latency measurements.

---

## Prerequisites

1. **Running API**: https://pynpoint-production.up.railway.app
2. **Valid API Key**: Required for all authenticated endpoints
3. **Tools**: curl, jq (for JSON parsing)

---

## Step 1: Create a Test API Key

You'll need the `ADMIN_API_SECRET` from Railway environment variables.

### Option A: Using the script

```bash
# Get ADMIN_API_SECRET from Railway dashboard
export ADMIN_API_SECRET="your-admin-secret-here"

# Create test API key
./scripts/create-test-api-key.sh
```

### Option B: Manual curl

```bash
curl -X POST https://pynpoint-production.up.railway.app/admin/api-keys \
  -H "X-Admin-Secret: $ADMIN_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "externalCustomerId": "test-user-001",
    "tier": "pro",
    "environment": "live"
  }'
```

**Save the returned API key!** It will only be shown once.

---

## Step 2: Test All Track 1 Endpoints

### Option A: Using the automated script

```bash
# Run comprehensive test suite
./scripts/test-track1-endpoints.sh ppk_live_sk_xxxxx

# This will test:
# - Root endpoint (GET /)
# - Single pincode lookup
# - Search by state
# - Bulk lookup
# - States list
# - State details
# - Districts list
```

### Option B: Manual testing

#### Test 0: Root Endpoint (No auth required)

```bash
curl -s -w "\nLatency: %{time_total}s\n" \
  https://pynpoint-production.up.railway.app/ | jq .
```

**Expected**: API information, < 500ms latency

---

#### Test 1: Single Pincode Lookup

```bash
API_KEY="ppk_live_sk_xxxxx"

curl -s -w "\nLatency: %{time_total}s\n" \
  -H "Authorization: Bearer $API_KEY" \
  https://pynpoint-production.up.railway.app/api/v1/pincodes/110001 | jq .
```

**Expected Response**:
```json
{
  "pincode": "110001",
  "officeName": "Parliament House",
  "state": "Delhi",
  "district": "Central Delhi",
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "isActive": true
}
```

**Performance Target**:
- First request (cold cache): 10-50ms
- Subsequent requests (cached): 1-10ms

---

#### Test 2: Search Pincodes by State

```bash
curl -s -w "\nLatency: %{time_total}s\n" \
  -H "Authorization: Bearer $API_KEY" \
  "https://pynpoint-production.up.railway.app/api/v1/pincodes?state=Delhi&limit=5" | jq .
```

**Expected**: List of 5 pincodes from Delhi

**Performance Target**: 20-50ms

---

#### Test 3: Bulk Pincode Lookup

```bash
curl -s -w "\nLatency: %{time_total}s\n" \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pincodes":["110001","400001","560001"]}' \
  https://pynpoint-production.up.railway.app/api/v1/pincodes/bulk/lookup | jq .
```

**Expected**: Results for Delhi, Mumbai, Bangalore pincodes

**Performance Target**: 5-50ms (depends on cache hits)

---

#### Test 4: List All States

```bash
curl -s -w "\nLatency: %{time_total}s\n" \
  -H "Authorization: Bearer $API_KEY" \
  https://pynpoint-production.up.railway.app/api/v1/administrative/states | jq .
```

**Expected**: List of all 36 states/UTs with pincode counts

**Performance Target**:
- First request: ~20ms
- Cached (24h TTL): ~1ms

---

#### Test 5: Get State Details

```bash
curl -s -w "\nLatency: %{time_total}s\n" \
  -H "Authorization: Bearer $API_KEY" \
  https://pynpoint-production.up.railway.app/api/v1/administrative/states/DL | jq .
```

**Expected**: Delhi state details with districts list

**Performance Target**: 1-20ms (cached)

---

#### Test 6: List Districts

```bash
curl -s -w "\nLatency: %{time_total}s\n" \
  -H "Authorization: Bearer $API_KEY" \
  "https://pynpoint-production.up.railway.app/api/v1/administrative/districts?state=Delhi&limit=10" | jq .
```

**Expected**: List of Delhi districts with pincode counts

**Performance Target**: 1-20ms (cached)

---

## Step 3: Verify Rate Limiting

Test tier-based rate limits:

```bash
# Free tier: 60 req/min, 1,000 req/day
# Pro tier: 300 req/min, 10,000 req/day

# Send rapid requests to test rate limiting
for i in {1..70}; do
  curl -s -H "Authorization: Bearer $API_KEY" \
    https://pynpoint-production.up.railway.app/api/v1/pincodes/110001 \
    -w "Request $i: %{http_code}\n" -o /dev/null
done
```

**Expected**: After 60 requests/min (free) or 300 requests/min (pro), you'll get:
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in X seconds."
}
```

---

## Step 4: Verify Usage Tracking

Check that API usage is being tracked in the database:

```sql
-- Connect to PostgreSQL
SELECT 
  external_customer_id,
  date,
  endpoint,
  request_count,
  success_count,
  error_count
FROM api_usage
WHERE external_customer_id = 'test-user-001'
ORDER BY date DESC, endpoint;
```

---

## Expected Performance Summary

| Endpoint | Cold Cache | Warm Cache | Cache TTL |
|----------|-----------|------------|-----------|
| Single pincode | 10-50ms | 1-10ms | 1 hour |
| Search/filter | 20-50ms | 10-20ms | 10 min |
| Bulk lookup | 5-50ms | 5-20ms | 1 hour |
| States list | ~20ms | ~1ms | 24 hours |
| State details | ~20ms | ~1ms | 24 hours |
| Districts | ~20ms | ~1ms | 24 hours |

---

## Troubleshooting

### 401 Unauthorized
- Check API key format (should start with `ppk_live_sk_` or `ppk_test_sk_`)
- Verify key hasn't been revoked
- Ensure `Authorization: Bearer` header is present

### 404 Not Found (Pincode)
- Verify pincode exists in database
- Check if pincode is active (`is_active = true`)

### 429 Rate Limit Exceeded
- Wait for rate limit window to reset
- Upgrade to higher tier for more requests

### 500 Internal Server Error
- Check Railway logs for errors
- Verify PostgreSQL and Redis are connected
- Check for database query errors

---

## Next Steps

After verifying Track 1 works:

1. **Test caching**: Run same request multiple times, verify latency drops
2. **Test pagination**: Try different `page` and `limit` values
3. **Test filtering**: Try different state/district combinations
4. **Monitor metrics**: Check Redis cache hit rate, database query performance

---

**Track 1 is ready for production use!** 🚀
