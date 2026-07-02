# Rate Limiting - Complete Summary

## ✅ What Was Implemented

### 1. **Multi-Tier Support** (Already Existed)
Your app fully supports **4 API key tiers**:
- FREE
- PRO  
- BUSINESS
- ENTERPRISE (with custom overrides)

### 2. **Environment Variable Configuration** (NEW)
All rate limits are now configurable via environment variables with sensible defaults.

### 3. **Per-Month Limits** (NEW)
Added monthly rate limiting alongside existing per-minute and per-day limits.

### 4. **Marketplace Exemption** (NEW)
Requests from API marketplaces (RapidAPI, AWS, Azure) **bypass rate limiting** since they handle it themselves.

---

## 📊 Default Rate Limits

**Aligned with RapidAPI Standards (FREE = 1,000 req/month baseline)**

| Tier | Per Minute | Per Day | Per Month | Multiplier | Monthly Cost Example |
|------|-----------|---------|-----------|------------|----------------------|
| **FREE** | 10 | 100 | **1,000** | 1x | Free / $0 |
| **PRO** | 100 | 1,000 | **10,000** | 10x | ~$10-20/mo |
| **BUSINESS** | 500 | 5,000 | **100,000** | 100x | ~$50-100/mo |
| **ENTERPRISE** | 1,000 | 10,000 | **1,000,000** | 1000x | Custom pricing |

---

## 🔧 Environment Variables

### All 12 Rate Limit Variables:

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

**Set in Railway:**
1. Go to your deployment → Variables tab
2. Add any of the above variables to override defaults
3. Redeploy (or let auto-deploy handle it)

---

## 🚫 What Gets Rate Limited (and What Doesn't)

### ✅ Rate Limited:
- Direct API key requests (`Authorization: Bearer ppk_live_sk_...`)
- Custom integrations using API keys
- Developer portal requests

### ❌ NOT Rate Limited:
- **RapidAPI requests** (they handle their own rate limiting)
- **AWS Marketplace requests** (AWS handles it)
- **Azure Marketplace requests** (Azure handles it)
- Admin endpoints (protected by `ADMIN_API_SECRET`)
- Public health check endpoints

---

## 📈 Response Headers

Every API response includes rate limit information:

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

Use these headers to implement client-side rate limiting and backoff strategies.

---

## 🔑 Per-Key Custom Overrides

Individual API keys can override tier defaults via the Admin API:

```bash
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

**For load testing:**
```bash
./scripts/set-unlimited-rate-limit.sh <API_KEY_ID>
```

---

## 🧪 Testing

### Check Current Configuration

The app logs rate limits on startup:

```
[RateLimitInterceptor] Rate limits configured:
  FREE: 10 req/min, 100 req/day, 1000 req/month
  PRO: 100 req/min, 1000 req/day, 10000 req/month
  BUSINESS: 500 req/min, 5000 req/day, 100000 req/month
  ENTERPRISE: 1000 req/min, 10000 req/day, 1000000 req/month
```

Check Railway logs or local console to verify.

### Test Rate Limiting

```bash
# 1. Find your API key
curl -H "X-Admin-Secret: $ADMIN_API_SECRET" \
  https://pynpoint-production.up.railway.app/api/v1/admin/api-keys | jq

# 2. Make requests and watch headers
curl -i -H "Authorization: Bearer ppk_live_sk_xxx..." \
  https://pynpoint-production.up.railway.app/api/v1/pincodes/110001

# 3. Hit the limit and see 429 error
```

---

## 🎯 Key Decisions Made

1. **Monthly limits set to ~25x daily limits** to allow for spiky usage patterns
2. **Marketplace requests bypass our rate limiting** to avoid double-limiting
3. **All limits configurable via environment variables** for easy testing/scaling
4. **Per-key overrides available** for custom enterprise contracts
5. **Redis-based sliding windows** for accurate, distributed rate limiting

---

## 📚 Related Documentation

- [Full Rate Limiting Guide](./RATE_LIMITING.md)
- [Load Testing Guide](../testing/LOAD_TESTING_GUIDE.md)
- [Environment Variables](../deployment/ENVIRONMENT_VARIABLES.md)
- [Admin API Reference](./ADMIN_API.md)

---

## ✅ Production Checklist

- [ ] Set appropriate rate limits in Railway environment variables
- [ ] Test rate limiting with realistic load
- [ ] Document limits in API documentation for customers
- [ ] Set up monitoring/alerts for customers hitting limits
- [ ] Implement upgrade prompts when users approach limits
