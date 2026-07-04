# RapidAPI Headers & Examples Explained

**Date**: 2026-07-04  
**Reference**: [RapidAPI Additional Headers Docs](https://docs.rapidapi.com/docs/additional-request-headers)

---

## 🔐 How RapidAPI Headers Work

### Headers YOU Define (in OpenAPI spec)

Your `openapi-spec-public.json` defines:

```json
{
  "components": {
    "securitySchemes": {
      "api-key": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key",
        "description": "API key for authentication"
      }
    }
  }
}
```

**This is YOUR API's authentication** - it's what direct API consumers would use.

---

### Headers RapidAPI AUTOMATICALLY Adds

When you upload to RapidAPI, they **automatically transform** your spec:

#### 1. For API Consumers (Public)

RapidAPI **replaces** your authentication with theirs:

```bash
# What consumers see in examples:
curl --request POST \
  --url https://pinpoint-india-pincode-digipin.p.rapidapi.com/api/v1/pincodes/reverse-geocode \
  --header 'X-RapidAPI-Key: <USER_KEY>' \          # ← RapidAPI's auth
  --header 'X-RapidAPI-Host: pinpoint-india...' \  # ← API identifier
  --header 'content-type: application/json' \
  --data '{"latitude": 28.6139, "longitude": 77.209, "maxDistance": 5, "limit": 3}'
```

**Key points**:
- ✅ `X-API-Key` is **replaced** with `X-RapidAPI-Key`
- ✅ `X-RapidAPI-Host` is **added automatically**
- ✅ `X-RapidAPI-User` is **added automatically** (username)
- ✅ You DON'T need to add these to your OpenAPI spec!

#### 2. For Your Backend (Hidden)

RapidAPI **adds additional headers** when forwarding to your API:

```http
POST /api/v1/pincodes/reverse-geocode
Host: pynpoint.codesense.in
X-RapidAPI-Proxy-Secret: <YOUR_SECRET>   ← Validates request is from RapidAPI
X-RapidAPI-User: john_doe                 ← Username making the request
X-API-Key: <ACTUAL_API_KEY>               ← Your original auth (if configured)
Content-Type: application/json

{"latitude": 28.6139, "longitude": 77.209, "maxDistance": 5, "limit": 3}
```

**This is what YOUR server receives!**

---

## 📊 Your Current Spec Status

### ✅ What's Correct

```json
{
  "paths": {
    "/api/v1/pincodes/reverse-geocode": {
      "post": {
        "parameters": [],  // ✅ No rate limit headers!
        "requestBody": {
          "content": {
            "application/json": {
              "examples": {  // ✅ OpenAPI 3.0 format
                "delhi-center": {
                  "summary": "Find pincodes near Delhi center",
                  "value": {
                    "latitude": 28.6139,
                    "longitude": 77.209,
                    "maxDistance": 5,
                    "limit": 3
                  }
                }
              }
            }
          }
        },
        "security": [{"api-key": []}]  // ✅ Your auth
      }
    }
  }
}
```

### ⚠️ What's Missing (Optional)

The singular `example` field for legacy parser fallback:

```json
{
  "requestBody": {
    "content": {
      "application/json": {
        "examples": { /* ... */ },  // ✅ You have this
        "example": {                // ❌ Missing (optional)
          "latitude": 28.6139,
          "longitude": 77.209,
          "maxDistance": 5,
          "limit": 3
        }
      }
    }
  }
}
```

---

## 🎯 What RapidAPI Does

### 1. Parse Your OpenAPI Spec

```
Read openapi-spec-public.json
  ↓
Find security scheme: X-API-Key
  ↓
Find request body examples
  ↓
Generate API listing
```

### 2. Transform for Consumers

**Your spec**:
```json
{
  "security": [{"api-key": []}],
  "components": {
    "securitySchemes": {
      "api-key": {
        "name": "X-API-Key"
      }
    }
  }
}
```

**What consumers see**:
```bash
--header 'X-RapidAPI-Key: ...'    # ← Replaced!
--header 'X-RapidAPI-Host: ...'   # ← Added!
```

### 3. Forward to Your Backend

```http
X-RapidAPI-Proxy-Secret: ggcFKkg++qyJj586LxEGuDrh8xDSZtJp+VmQtI2YVJs=
X-RapidAPI-User: john_doe
X-API-Key: ppk_live_sk_39eac7181b1422ef95bd0174_1
```

Your backend validates:
1. `X-RapidAPI-Proxy-Secret` → Confirms it's from RapidAPI
2. `X-API-Key` → Your normal API key validation

---

## 🔍 Why Examples Might Not Show

### Possible Issues

1. **RapidAPI Cache**
   - RapidAPI caches OpenAPI specs
   - May need time to refresh or manual cache clear
   - Re-upload might not immediately update

2. **Parser Limitations**
   - Some parsers only recognize `example` (singular)
   - Your spec has `examples` (plural) only
   - Add singular fallback if needed

3. **Format Issues**
   - Ensure JSON is valid
   - Ensure `examples` is at correct level (inside `content.application/json`)
   - Ensure each example has `summary` and `value`

---

## ✅ Verification Checklist

```bash
# 1. Check your spec has examples
cat openapi-spec-public.json | jq '.paths["/api/v1/pincodes/reverse-geocode"].post.requestBody.content."application/json".examples'

# Should show:
{
  "delhi-center": {
    "summary": "Find pincodes near Delhi center",
    "value": { ... }
  },
  "mumbai-gateway": { ... }
}

# 2. Check no rate limit headers
cat openapi-spec-public.json | jq '.paths["/api/v1/pincodes/reverse-geocode"].post.parameters'

# Should show:
[]

# 3. Check security scheme
cat openapi-spec-public.json | jq '.components.securitySchemes'

# Should show:
{
  "api-key": {
    "type": "apiKey",
    "in": "header",
    "name": "X-API-Key"
  }
}
```

---

## 🚀 Next Steps

1. **Re-upload to RapidAPI**
   - Upload `openapi-spec-public.json`
   - Wait 5-10 minutes for cache refresh
   
2. **Test Examples**
   - Go to API listing
   - Click "Test Endpoint"
   - Check if examples appear in dropdown
   
3. **If Still Broken**
   - Contact RapidAPI support
   - Show them your spec follows OpenAPI 3.0 standards
   - Ask about cache clearing or parser issues

---

## 📚 References

- [RapidAPI Additional Headers](https://docs.rapidapi.com/docs/additional-request-headers)
- [RapidAPI Security](https://docs.rapidapi.com/docs/configuring-api-security)
- [OpenAPI 3.0 Examples](https://swagger.io/docs/specification/v3_0/describing-request-body/)

---

**Status**: ✅ **Your spec is correct. Issue is likely RapidAPI cache or parser.**
