# Rate Limiting Configuration

PinPoint India API implements tier-based rate limiting to ensure fair usage and prevent abuse.

## Overview

Rate limits are enforced at three levels:
1. **Per-minute limit**: Short-term burst protection
2. **Per-day limit**: Daily usage quota
3. **Per-month limit**: Monthly billing/usage quota

All limits are enforced per API key (identified by `external_customer_id`).

**Note:** Rate limiting is **automatically skipped** for requests from API marketplaces (RapidAPI, AWS Marketplace, Azure Marketplace) since they enforce their own rate limits based on customer subscription plans.

---

## Default Rate Limits by Tier

| Tier | Requests/Minute | Requests/Day | Requests/Month | Use Case |
|------|----------------|--------------|----------------|----------|
| **FREE** | 10 | 100 | **1,000** | Personal projects, testing (RapidAPI standard) |
| **PRO** | 100 | 1,000 | **10,000** | Small businesses, apps |
| **BUSINESS** | 500 | 5,000 | **100,000** | High-volume applications |
| **ENTERPRISE** | 1,000 | 10,000 | **1,000,000** | Custom contracts (overridable) |

**Note:** FREE tier aligned with RapidAPI's standard free tier (1,000 requests/month).

---

## Environment Variable Configuration

Rate limits can be customized via environment variables (useful for testing or custom deployments):

```bash
# FREE tier (RapidAPI standard: 1,000 req/month)
RATE_LIMIT_FREE_PER_MINUTE=10
RATE_LIMIT_FREE_PER_DAY=100
RATE_LIMIT_FREE_PER_MONTH=1000

# PRO tier (10x FREE)
RATE_LIMIT_PRO_PER_MINUTE=100
RATE_LIMIT_PRO_PER_DAY=1000
RATE_LIMIT_PRO_PER_MONTH=10000

# BUSINESS tier (100x FREE)
RATE_LIMIT_BUSINESS_PER_MINUTE=500
RATE_LIMIT_BUSINESS_PER_DAY=5000
RATE_LIMIT_BUSINESS_PER_MONTH=100000

# ENTERPRISE tier (1000x FREE)
RATE_LIMIT_ENTERPRISE_PER_MINUTE=1000
RATE_LIMIT_ENTERPRISE_PER_DAY=10000
RATE_LIMIT_ENTERPRISE_PER_MONTH=1000000
```

**On Railway:**
Set these in the deployment's Environment Variables section.

---

## Per-Key Rate Limit Overrides

Individual API keys can have custom rate limits that override tier defaults:

### Via Admin API

```bash
# Update an API key's tier and custom limits
curl -X PUT \
  -H "X-Admin-Secret: $ADMIN_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "enterprise",
    "rateLimitOverrides": {
      "requests_per_minute": 5000,
      "requests_per_day": 1000000,
      "requests_per_month": 25000000
    }
  }' \
  https://pynpoint-production.up.railway.app/api/v1/admin/api-keys/{keyId}/tier
```

### Via Helper Script

For load testing, use the provided script:

```bash
# Set unlimited rate limits for testing
./scripts/set-unlimited-rate-limit.sh <API_KEY_ID>
```

This sets:
- `requests_per_minute`: 100,000
- `requests_per_day`: 10,000,000

---

## Response Headers

Every API response includes rate limit headers:

```http
X-RateLimit-Limit-Minute: 300
X-RateLimit-Remaining-Minute: 245
X-RateLimit-Reset-Minute: 1709654400

X-RateLimit-Limit-Day: 10000
X-RateLimit-Remaining-Day: 8750
X-RateLimit-Reset-Day: 1709740800

X-RateLimit-Limit-Month: 250000
X-RateLimit-Remaining-Month: 187500
X-RateLimit-Reset-Month: 1712246400
```

---

## Rate Limit Exceeded (429)

When limits are exceeded, the API returns HTTP 429:

```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again in 45 seconds.",
  "error": "Too Many Requests"
}
```

**Retry Strategy:**
- Use exponential backoff
- Check `X-RateLimit-Reset-Minute` header for reset time
- Consider upgrading tier if consistently hitting limits

---

## Implementation Details

### Algorithm
- **Token Bucket** with sliding window
- Minute window: Last 60 seconds
- Day window: Last 24 hours (86,400 seconds)

### Storage
- Redis (`REDIS_CACHE_URL`) with automatic expiration
- Keys: `ratelimit:{customerId}:minute:{timestamp}`
- Keys: `ratelimit:{customerId}:day:{timestamp}`

### Performance
- Sub-millisecond overhead (Redis operations)
- No database lookups per request
- Atomic increment operations

---

## Testing Rate Limits

### 1. Check Current Limits

```bash
curl -H "X-Admin-Secret: $ADMIN_API_SECRET" \
  https://pynpoint-production.up.railway.app/api/v1/admin/api-keys | jq
```

### 2. Run Load Test

```bash
# With default limits (will hit 429s)
node scripts/load-test.js ppk_live_sk_xxx...

# With unlimited limits
./scripts/set-unlimited-rate-limit.sh <key-id>
node scripts/load-test.js ppk_live_sk_xxx...
```

### 3. Monitor Railway Metrics

Check Railway dashboard during load tests:
- CPU usage
- Memory usage
- Network throughput
- Request counts

---

## Production Recommendations

1. **Set realistic limits** based on your infrastructure capacity
2. **Monitor usage patterns** to adjust tier limits
3. **Communicate limits** clearly to API consumers
4. **Implement client-side rate limiting** to avoid 429s
5. **Use caching** on client side for frequently accessed data

---

## See Also

- [API Authentication](./API_AUTHENTICATION.md)
- [Admin API Reference](./ADMIN_API.md)
- [Environment Variables](../deployment/ENVIRONMENT_VARIABLES.md)
