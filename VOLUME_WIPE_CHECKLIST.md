# Volume Wipe & Re-ingestion Checklist

## Current Status

**Latest commits:**
1. `a24b405` - Add region and circle columns to pincodes table
2. `f4f2837` - Fix: Make district and state nullable in postoffices table

**Migrations updated:**
- ✅ `1700000000001-CreatePincodesTable.ts` - Added region, circle columns
- ✅ `1700000000002-CreatePostOfficesTable.ts` - Made district, state nullable

**Code deployed:** ✅ Latest code is on `main` branch and pushed to Railway

---

## Why Volume Wipe is Needed

The old database was created with migrations that had:
- ❌ `postoffices.district VARCHAR(100) NOT NULL`
- ❌ `postoffices.state VARCHAR(100) NOT NULL`
- ❌ No `region` or `circle` columns in `pincodes` table

The new migrations have:
- ✅ `postoffices.district VARCHAR(100) NULL`
- ✅ `postoffices.state VARCHAR(100) NULL`  
- ✅ `pincodes.region VARCHAR(100) NULL`
- ✅ `pincodes.circle VARCHAR(100) NULL`

TypeORM won't re-run already-applied migrations, so we need a fresh start.

---

## Steps for Volume Wipe

### 1. On Railway Dashboard:
   - Go to your PinPoint India service
   - Navigate to "Volumes" tab
   - Delete the existing PostgreSQL volume
   - The service will automatically restart

### 2. Railway will automatically:
   - Create fresh PostgreSQL database
   - Run all 5 migrations from scratch (with the new schema)
   - Auto-ingestion will begin

### 3. Watch the logs for:
   ```
   [Migration] CreatePincodesTable - Complete
   [Migration] Summary: 1 table, 10 indexes, 1 trigger, 1 function
   ```
   ☝️ Should show **10 indexes** (not 8)

   ```
   [Migration] CreatePostOfficesTable - Complete  
   [Migration] Summary: 1 table, 9 indexes, 1 trigger
   ```

   ```
   [OfficialJSONIngestionService] ✅ Inserted 19,586 pincodes
   [OfficialJSONIngestionService] ✅ Inserted 165,627 postoffices
   ```

   ```
   [DataIngestionService] ✅ Enriched ~19,312 pincodes with boundaries
   ```

### 4. After ingestion completes:
   Test that region and circle are populated:
   ```bash
   curl -s "https://pynpoint-production.up.railway.app/api/v1/pincodes/110001" \
     -H "Authorization: Bearer ppk_live_sk_13e44452fb4a159692159ddf_9" | jq '{pincode, state, district, region, circle}'
   ```

   Expected output:
   ```json
   {
     "pincode": "110001",
     "state": "delhi",
     "district": "new delhi",
     "region": "DivReportingCircle",
     "circle": "Delhi Circle"
   }
   ```

---

## What Changed in This Re-ingestion

### New Features:
1. **`region` field** in pincodes (e.g., "Mumbai Region", "Bengaluru HQ Region")
2. **`circle` field** in pincodes (e.g., "Maharashtra Circle", "Delhi Circle")
3. **Nullable district/state** in postoffices (handles "na" values properly)

### Data Quality Improvements:
1. ✅ "na" state filtered out from `/administrative/states`
2. ✅ "na" district filtered out from `/administrative/districts`
3. ✅ Post offices with district="na" now have district=null (instead of failing insertion)

---

## Verification Tests After Re-ingestion

1. **Check region/circle populated:**
   ```bash
   curl -s "https://pynpoint-production.up.railway.app/api/v1/pincodes/400001" \
     -H "Authorization: Bearer ppk_live_sk_13e44452fb4a159692159ddf_9" | \
     jq '{pincode, region, circle}'
   ```

2. **Verify "na" state is gone:**
   ```bash
   curl -s "https://pynpoint-production.up.railway.app/api/v1/administrative/states" \
     -H "Authorization: Bearer ppk_live_sk_13e44452fb4a159692159ddf_9" | \
     jq '.states[] | select(.name == "na")'
   ```
   Should return empty (no results)

3. **Check post office count:**
   ```bash
   curl -s "https://pynpoint-production.up.railway.app/api/v1/pincodes/110001?includePostOffices=true" \
     -H "Authorization: Bearer ppk_live_sk_13e44452fb4a159692159ddf_9" | \
     jq '.postOfficeCount'
   ```

---

## Expected Totals

- **Pincodes:** 19,586
- **Post Offices:** 165,627
- **Total Records:** 185,213
- **Pincodes with Boundaries:** ~19,312 (98.6%)
- **States:** 36 (no "na")

---

## If Errors Occur

Check Railway logs for specific error messages. Common issues:
- PostGIS extension not installed → Check database creation logs
- Migration failures → Check migration SQL syntax
- Network errors during download → Retry by restarting service
