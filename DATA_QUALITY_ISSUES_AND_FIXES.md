# Data Quality Issues & Fixes

## Critical Issues Found

### ❌ Issue 1: `city` field is always `null`

**Status:** Data limitation (not a bug)

**Root Cause:**
- Official data.gov.in JSON source doesn't include city/area information
- Only contains: pincode, officename, statename, district, officetype

**Current Behavior:**
```json
{
  "pincode": "110001",
  "city": null  // ← Always null
}
```

**Evidence:**
```typescript
// official-json-ingestion.service.ts:216
city: null, // No city/area in official JSON
```

**Solution Options:**
1. **Remove field** (breaking change) - Not recommended
2. **Keep as-is** (current) - Document as unavailable in source data
3. **Derive from post office `area` field** - Post offices have area but it's not standardized

**Recommendation:** Keep field as optional, document limitation in API docs

---

### ❌ Issue 2: "na" appears as a state

**Status:** ✅ FIXED (pending deployment)

**Root Cause:**
- Source data contains "NA" (not available) as `statename` for 106 pincodes
- These are mostly NDC (National Distribution Centers) and special facilities
- `normalize()` function was converting "NA" → "na" without filtering

**Current Behavior:**
```json
{
  "name": "na",
  "code": "XX",
  "pincodeCount": 106,
  "districtCount": 1
}
```

**Sample Affected Pincodes:**
- 500918 - NDC Sanathnagar (Hyderabad)
- 380011 - NDC Maninagar (Ahmedabad)
- 800033 - PATNA GPO NDC
- 222101 - Belwai S.O

**Fix Applied:**
```typescript
// official-json-ingestion.service.ts:251-263
private normalize(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') return null;
  const normalized = value.trim().toLowerCase();
  // Filter out "na" which means "not available" in source data
  if (normalized === 'na' || normalized === 'n/a' || normalized === 'not available') {
    return null;
  }
  return normalized;
}
```

**After Fix:**
- State = `null` (instead of "na")
- District = `null` (instead of "na")
- These pincodes won't appear in `/administrative/states` (filtered by `IS NOT NULL`)
- Individual lookups will still work, but state/district shown as null

---

## Other Potential Issues (To Investigate)

### 🔍 Issue 3: Missing coordinates for many pincodes

**Observation:**
- Pincode 110001 has NO coordinates (`centroid` is NULL)
- Pincode 110001 has NO boundary geometry

**To Investigate:**
- What percentage of pincodes have NULL centroids?
- What percentage have NULL boundaries?
- Why did GeoJSON enrichment skip these?

**Query to Check:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(centroid) as with_centroid,
  COUNT(boundary) as with_boundary,
  ROUND(100.0 * COUNT(centroid) / COUNT(*), 2) as centroid_coverage,
  ROUND(100.0 * COUNT(boundary) / COUNT(*), 2) as boundary_coverage
FROM pincodes
WHERE is_active = true;
```

---

### 🔍 Issue 4: State code mapping completeness

**To Verify:**
- Are all states in database mapped to state codes?
- "the dadra and nagar haveli and daman and diu" has code "XX" - is this correct?

---

## Testing Status

### Track 1: Pincodes & Administrative
- ✅ HTTP status codes correct
- ❌ Data quality issues found (city=null, na state)
- ⚠️  Coordinates coverage unknown

### Track 2: DIGIPIN
- ✅ All encode/decode operations correct
- ✅ Hierarchy operations correct
- ⚠️  Not manually verified yet

### Track 3: Distance
- ✅ All calculations correct
- ✅ Validation working properly
- ⚠️  Not manually verified yet

---

## Next Steps

1. **Build & Deploy Fix**
   - Commit normalize() function fix
   - Deploy to Railway
   - Wipe database and re-ingest (to apply fix)

2. **Data Coverage Analysis**
   - Query centroid coverage percentage
   - Query boundary coverage percentage
   - Identify why some pincodes missing geo data

3. **Manual Testing**
   - Verify "na" state no longer appears
   - Spot-check multiple endpoints
   - Document any additional issues

4. **Documentation Updates**
   - Note city field limitation in API docs
   - Document that some pincodes lack coordinates
   - Add data quality section to README
