# Production Deployment Issue - DIGIPIN Algorithm Mismatch [HISTORICAL - FIXED]

**⚠️ NOTE: This document describes a production issue that has been FIXED. See `H3_DIGIPIN_FIXED.md`.**

## 🔴 Problem

Production API at `https://pynpoint-production.up.railway.app` is returning **different DIGIPIN codes** than the local codebase.

---

## Evidence

### Test: Encode Delhi Coordinates (28.6139, 77.2090)

**Local Code** (verified by running `npx ts-node pynpoint/scripts/test-typescript-algorithm.ts`):
```
Result: 39J438 ✅
```

**Production API** (via `curl`):
```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://pynpoint-production.up.railway.app/api/v1/digipin/encode" \
  -H "Content-Type: application/json" \
  -d '{"coordinates":[{"latitude":28.6139,"longitude":77.2090}],"level":6}'

Result: "digipinCode": "M32M7L" ❌
```

**Database** (via direct PostgreSQL query):
```sql
SELECT encode_digipin_level6(28.6139, 77.2090);

Result: 39J438 ✅
```

---

## Root Cause

Production deployment is running **OLD CODE** with a different DIGIPIN algorithm.

The local codebase has the correct implementation:
- File: `pynpoint/src/digipin/services/digipin-algorithm.service.ts`
- Last modified: June 19, 18:17
- Grid: `[['F', 'C', '9', '8'], ['J', '3', '2', '7'], ['K', '4', '5', '6'], ['L', 'M', 'P', 'T']]`
- Bounding box: India-specific (2.5-38.5°N, 63.5-99.5°E)

But production is returning codes like `M32M7L` which suggests it's using:
- A different character set (possibly geohash-based 32-character alphabet)
- A different bounding box (possibly global -90/90, -180/180)

---

## Solution

### Option 1: Trigger Redeploy via Railway Dashboard

1. Go to Railway dashboard
2. Select `pynpoint` service
3. Click "Deploy" → "Redeploy"
4. Wait for build to complete (~5-10 minutes)

### Option 2: Trigger Redeploy via Git Push

```bash
# Make a trivial change
git commit --allow-empty -m "Force redeploy with correct DIGIPIN algorithm"
git push origin main

# Railway will auto-deploy
```

### Option 3: Trigger Redeploy via Railway CLI

```bash
railway up --service pynpoint
```

---

## Verification After Redeploy

### Test 1: DIGIPIN Encode Endpoint
```bash
curl -H "Authorization: Bearer ppk_live_sk_9126d370214ccc5afe102ceb_5" \
  "https://pynpoint-production.up.railway.app/api/v1/digipin/encode" \
  -H "Content-Type: application/json" \
  -d '{"coordinates":[{"latitude":28.6139,"longitude":77.2090}],"level":6}' | jq '.results[0].digipinCode'

Expected: "39J438" ✅
Current:  "M32M7L" ❌
```

### Test 2: Pincode to DIGIPIN Endpoint
```bash
curl -H "Authorization: Bearer ppk_live_sk_9126d370214ccc5afe102ceb_5" \
  "https://pynpoint-production.up.railway.app/api/v1/convert/pincode-to-digipin/110001" | jq '.digipinCodes[0:5]'

Expected: ["39J422", "39J427", "39J428", "39J429", "39J42C"] ✅
Current:  ["TTNGTX", "TTNGTZ", "TTNGU5", "TTNGU8", "TTNGU9"] ❌
```

### Test 3: DIGIPIN to Pincode Endpoint
```bash
curl -H "Authorization: Bearer ppk_live_sk_9126d370214ccc5afe102ceb_5" \
  "https://pynpoint-production.up.railway.app/api/v1/convert/digipin-to-pincode/39J438" | jq '.pincodes[0].pincode'

Expected: "110001" ✅
Current:  404 Not Found ❌
```

---

## Technical Details

### Current Code (Local)

**File:** `pynpoint/src/digipin/services/digipin-algorithm.service.ts`

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

encode(lat: number, lng: number, level: number = 6): string {
  // 4x4 grid subdivision algorithm
  // Returns codes like "39J438" for Delhi
}
```

This matches:
- ✅ Official India Post DIGIPIN specification
- ✅ PostgreSQL `encode_digipin_level6()` function
- ✅ Database `digipin_cells` column (19,288 pincodes populated)

### Production Code (Suspected)

Based on the output (`M32M7L`), production appears to be running an old version with:
- Different character set (possibly 32-character geohash alphabet)
- Different bounding box (possibly global)
- Different algorithm (possibly binary subdivision instead of 4x4 grid)

---

## Impact

**CRITICAL:** The API is returning DIGIPIN codes that:
1. ❌ Don't match the database
2. ❌ Don't match the official India Post specification
3. ❌ Will fail reverse lookups (DIGIPIN → Pincode)
4. ❌ Will confuse users with inconsistent results

**Severity:** 🔴 **HIGH** - Core functionality is broken

---

## Next Steps

1. ✅ **Redeploy production** with latest code
2. ✅ **Clear Redis cache** to remove any stale cached responses
3. ✅ **Run full API test suite** to verify all endpoints
4. ✅ **Monitor production logs** for any errors

---

## Commands Checklist

```bash
# 1. Redeploy (choose one method above)
# 2. Wait for deployment to complete
# 3. Clear Redis cache (optional but recommended)
railway run bash -c 'redis-cli -u "$REDIS_URL" FLUSHDB'

# 4. Run API tests
API_KEY=ppk_live_sk_9126d370214ccc5afe102ceb_5 ./pynpoint/scripts/test-api-endpoints.sh

# 5. Verify database tests still pass
railway run psql $DATABASE_URL -f pynpoint/scripts/quick-validation-tests.sql
```

---

**STATUS:** Waiting for production redeploy. Local code is correct. Database is correct. Only production deployment is out of sync. 🚀
