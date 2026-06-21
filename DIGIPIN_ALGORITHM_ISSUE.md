# DIGIPIN Algorithm Mismatch - ROOT CAUSE FOUND [HISTORICAL - FIXED]

**⚠️ NOTE: This document describes a problem that has been FIXED. See `H3_DIGIPIN_FIXED.md` for the solution.**

## 🔴 Problem

Production API is returning **incorrect DIGIPIN codes** that don't match the database or official India Post specification.

### Evidence

| Source | Delhi (28.6139, 77.2090) | Character Set |
|--------|-------------------------|---------------|
| **Database** (110001) | `39J438` ✅ | F,C,9,8,3,2,J,K,L,M,P,T,4,5,6,7 (16 chars, 4x4 grid) |
| **PostgreSQL function** | `39J438` ✅ | Same as above |
| **TypeScript `DigipinAlgorithmService`** | `39J438` ✅ | Same as above |
| **Production `/digipin/encode`** | `M32M7L` ❌ | 23456789ABCDEFGH... (32 chars, geohash) |
| **Production `/convert/pincode-to-digipin/110001`** | `TTNGTX` ❌ | Same geohash alphabet |

---

## 🔍 Root Cause

The codebase contains **TWO different DIGIPIN implementations**:

### 1. ✅ **CORRECT: Official India Post Specification** 
**Location:** `pynpoint/src/digipin/services/digipin-algorithm.service.ts`

```typescript
private readonly GRID = [
  ['F', 'C', '9', '8'],  // row 0 (TOP latitude band)
  ['J', '3', '2', '7'],  // row 1
  ['K', '4', '5', '6'],  // row 2
  ['L', 'M', 'P', 'T']   // row 3 (BOTTOM latitude band)
];

private readonly INDIA_BBOX = {
  minLat: 2.5,   maxLat: 38.5,
  minLng: 63.5,  maxLng: 99.5,
};
```

- ✅ 16-character alphabet (4x4 grid)
- ✅ Official India Post bounding box
- ✅ 4x4 hierarchical subdivision
- ✅ Matches PostgreSQL functions
- ✅ Returns `39J438` for Delhi

**Also used in:**
- `pynpoint/migrations/create_digipin_functions.sql` (PostgreSQL)
- Database column `digipin_cells` (19,288 pincodes populated)

---

### 2. ❌ **INCORRECT: Geohash-based Implementation**
**Location:** `h3-digipin/src/digipin-encoder.ts` (npm package)

```typescript
private readonly alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// Bounding box: Global (-90 to 90, -180 to 180)
// Algorithm: Geohash binary subdivision (not 4x4 grid!)
```

- ❌ 32-character alphabet (geohash style)
- ❌ Global bounding box (not India-specific)
- ❌ Binary subdivision (not 4x4 grid)
- ❌ Returns `M32M7L` for Delhi

**Used in:**
- `h3-digipin/src/conversion.ts` (SpatialConverter class)
- Imported in `pynpoint/src/conversion/services/conversion.service.ts` (line 5)

---

## 🐛 Why Production is Wrong

### Theory 1: Old Cached Data (MOST LIKELY)
Production API has **Redis cache** from when it was using the geohash implementation:
- Cache key: `conversion:pincode-digipin:110001`
- Cached value: `{"digipinCodes": ["TTNGTX", ...]}`
- Cache TTL: 1 hour (but may be persisted longer)

### Theory 2: Old Deployment
Railway may be running an old build that used the geohash algorithm.

### Theory 3: Code Mismatch
The deployed code might be different from what's in the repository.

---

## ✅ Solution

### Step 1: Clear Redis Cache

**Option A: Clear all conversion cache**
```bash
railway run --service pynpoint bash -c 'redis-cli -u "$REDIS_URL" --scan --pattern "conversion:*" | xargs redis-cli -u "$REDIS_URL" DEL'
```

**Option B: Clear specific cache key**
```bash
railway run --service pynpoint bash -c 'redis-cli -u "$REDIS_URL" DEL "conversion:pincode-digipin:110001"'
```

**Option C: Flush entire Redis database** (nuclear option)
```bash
railway run --service pynpoint bash -c 'redis-cli -u "$REDIS_URL" FLUSHDB'
```

### Step 2: Verify Deployment

Check which code is deployed:
```bash
railway logs --service pynpoint | grep "DIGIPIN"
```

### Step 3: Force Redeploy (if needed)

```bash
# Trigger rebuild
git commit --allow-empty -m "Force redeploy with correct DIGIPIN algorithm"
git push origin main

# Or via Railway CLI
railway up --service pynpoint
```

### Step 4: Verify Fix

```bash
# Test encoding endpoint
curl -H "Authorization: Bearer $API_KEY" \
  "https://pynpoint-production.up.railway.app/api/v1/digipin/encode" \
  -H "Content-Type: application/json" \
  -d '{"coordinates":[{"latitude":28.6139,"longitude":77.2090}],"level":6}'

# Expected: "digipinCode": "39J438" (NOT "M32M7L")

# Test conversion endpoint
curl -H "Authorization: Bearer $API_KEY" \
  "https://pynpoint-production.up.railway.app/api/v1/convert/pincode-to-digipin/110001"

# Expected: "digipinCodes": ["39J422", "39J427", "39J438", ...]
```

---

## 🧹 Code Cleanup (Optional)

The `h3-digipin` package is only used for `h3ToDigipin` conversion. Consider:

1. **Keep it** if H3↔DIGIPIN conversion is needed (but document the limitation)
2. **Remove it** if not needed (reduces confusion)
3. **Replace it** with a proper implementation using the official algorithm

**Current usage:**
```typescript
// conversion.service.ts:476
const digipinCodes = this.spatialConverter.h3ToDigipin(h3Index, level);
```

This is the **only** place `SpatialConverter` is used.

---

## 📋 Verification Checklist

After clearing cache and redeploying:

- [ ] `/digipin/encode` returns `39J438` for (28.6139, 77.2090)
- [ ] `/convert/pincode-to-digipin/110001` contains `39J438`
- [ ] `/convert/digipin-to-pincode/39J438` returns 110001
- [ ] Database query: `SELECT '39J438' = ANY(digipin_cells) FROM pincodes WHERE pincode = '110001'` returns `true`
- [ ] No `TTNGTX`, `M32M7L`, or other geohash codes in responses

---

## 🎯 Expected Timeline

1. **Clear cache:** 1 minute
2. **Verify fix:** 2 minutes
3. **Redeploy (if needed):** 5-10 minutes
4. **Full API tests:** 5 minutes

**Total:** 10-20 minutes

---

## 📚 Related Files

- `pynpoint/src/digipin/services/digipin-algorithm.service.ts` - ✅ Correct implementation
- `pynpoint/migrations/create_digipin_functions.sql` - ✅ Correct PostgreSQL functions
- `h3-digipin/src/digipin-encoder.ts` - ❌ Geohash implementation
- `pynpoint/src/conversion/services/conversion.service.ts` - Line 5 imports wrong library
- `pynpoint/scripts/debug-digipin-data.sql` - Diagnostic script
- `pynpoint/scripts/test-api-endpoints.sh` - API testing script

---

**STATUS:** Root cause identified. Waiting for cache clear / redeploy. 🚀
