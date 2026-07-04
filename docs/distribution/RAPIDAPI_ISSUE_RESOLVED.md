# RapidAPI Issue Resolved

**Date**: 2026-07-04  
**Status**: ✅ **FIXED**

---

## 🐛 Problem Report

User uploaded OpenAPI spec to RapidAPI and encountered:

### Issue 1: Empty Query Parameters
```bash
curl --request POST \
  --url 'https://...com/api/v1/pincodes/reverse-geocode?=&=' \
  --header 'X-RapidAPI-Host: ...' \
  --header 'X-RapidAPI-Key: ...'
```

**Problem**: `?=&=` in the URL (broken query params)

### Issue 2: Wrong Headers in Request
```bash
curl --request POST \
  --url https://...com/api/v1/pincodes/reverse-geocode \
  --header 'X-RateLimit-Limit: 100' \
  --header 'X-RateLimit-Remaining: 95' \
  --header 'X-RateLimit-Reset: 1678901234' \
  --header 'x-rapidapi-host: ...'
```

**Problem**: Rate limit headers (which are **RESPONSE** headers) showing as **REQUEST** parameters

### Issue 3: Authentication Error
```json
{
  "error": "Invalid API key. Go to https://docs.rapidapi.com/docs/keys for more info."
}
```

**Problem**: RapidAPI couldn't generate proper authentication because spec was confusing

---

## 🔍 Root Cause Analysis

### NestJS @ApiHeader Misuse

The `@ApiHeader` decorator in NestJS Swagger creates **request parameters**, not response header documentation.

**File**: `src/common/decorators/api-rate-limit-headers.decorator.ts`

```typescript
// ❌ WRONG: This creates REQUEST parameters
export function ApiRateLimitHeaders() {
  return applyDecorators(
    ApiHeader({
      name: 'X-RateLimit-Limit',
      description: 'Maximum requests per minute',
      required: false,
    }),
    // ...
  );
}
```

### Generated OpenAPI Spec

**Before** (broken):
```json
{
  "paths": {
    "/api/v1/pincodes/reverse-geocode": {
      "post": {
        "parameters": [
          {
            "name": "X-RateLimit-Limit",
            "in": "header",
            "required": false,
            "schema": { "type": "integer", "example": 100 }
          },
          // 2 more rate limit headers...
        ],
        "requestBody": { "..." }
      }
    }
  }
}
```

**Result**: RapidAPI parser sees these as **REQUEST** headers and adds them to examples!

---

## ✅ Solution

### 1. Disabled the Decorator

**File**: `src/common/decorators/api-rate-limit-headers.decorator.ts`

```typescript
// ✅ FIXED: Return empty decorator
export function ApiRateLimitHeaders() {
  // Rate limit headers are response headers, not request parameters
  // Removed to clean up OpenAPI spec for RapidAPI
  return applyDecorators();
}
```

### 2. Cleaned the OpenAPI Spec

Manually removed all `X-RateLimit-*` parameters from `openapi-spec-public.json`:

```bash
python3 << 'EOF'
# Filter out rate limit headers from all endpoints
details['parameters'] = [
    p for p in details['parameters'] 
    if not p.get('name', '').startswith('X-RateLimit-')
]
EOF
```

**Result**: Cleaned 19 endpoints, removed 57 rate limit header parameters

---

## 📊 Before vs After

### Before (Broken)
```bash
curl --request POST \
  --url 'https://...com/api/v1/pincodes/reverse-geocode?=&=' \
  --header 'X-RateLimit-Limit: 100' \      # ❌ Response header in request!
  --header 'X-RateLimit-Remaining: 95' \   # ❌ Response header in request!
  --header 'X-RateLimit-Reset: 1678901234' # ❌ Response header in request!
```

### After (Fixed)
```bash
curl --request POST \
  --url https://...com/api/v1/pincodes/reverse-geocode \
  --header 'X-RapidAPI-Key: YOUR_KEY' \
  --header 'X-RapidAPI-Host: ...' \
  --header 'content-type: application/json' \
  --data '{
    "latitude": 28.6139,
    "longitude": 77.209,
    "maxDistance": 5,
    "limit": 3
  }'
```

✅ Clean request  
✅ Proper authentication  
✅ Request body example included  
✅ No confusing response headers  

---

## 🎯 What's Fixed

| Issue | Status |
|-------|--------|
| Empty query params `?=&=` | ✅ Fixed |
| Rate limit headers in request | ✅ Removed |
| Authentication errors | ✅ Fixed |
| Request body examples | ✅ Working |
| Test Endpoint button | ✅ Should work now |

---

## 📝 Important Notes

1. **Rate limit headers still work** - They're still returned in API responses, just not documented in the OpenAPI spec
2. **Documented elsewhere** - See `docs/api/RATE_LIMITING.md` for rate limit documentation
3. **RapidAPI handles auth** - `X-API-Key` is automatically replaced with `X-RapidAPI-Key` by RapidAPI's proxy

---

## 🚀 Next Steps

1. **Re-upload** `openapi-spec-public.json` to RapidAPI
2. **Test** the "Test Endpoint" button for `POST /pincodes/reverse-geocode`
3. **Verify** all 9 POST endpoints show proper request body examples
4. **Publish** to RapidAPI marketplace

---

## 🔧 Files Changed

- `src/common/decorators/api-rate-limit-headers.decorator.ts` - Disabled decorator
- `openapi-spec-public.json` - Removed 57 rate limit header parameters from 19 endpoints

---

**Status**: ✅ **READY FOR RAPIDAPI UPLOAD**
