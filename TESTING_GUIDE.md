# DIGIPIN Testing Guide

Complete testing guide for DIGIPIN conversion API endpoints.

## Prerequisites

- ✅ Population complete (99.88%+ - 19,288/19,312 pincodes)
- ✅ GIN index created
- ✅ NestJS API running

---

## Phase 1: Database-Level Tests

These tests validate the data consistency and correctness at the database level.

### Quick Validation (5 minutes)

```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/quick-validation-tests.sql
```

**Tests:**
- ✅ Delhi test case (110001 → 39J438)
- ✅ Reverse lookup (39J438 → 110001)
- ✅ Round-trip consistency (5 random samples)
- ✅ Centroid validation
- ✅ Cell format validation

---

### Internal Consistency Tests (10 minutes)

```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/test-api-internal-consistency.sql
```

**Tests:**
- ✅ Round-trip: Pincode → DIGIPIN → Pincode
- ✅ Boundary cell sharing (cells in multiple pincodes)
- ✅ Unique cells (interior cells in one pincode)
- ✅ Multi-pincode cross-validation
- ✅ Cell format validation

**Expected Results:**
- All round-trips should succeed
- Boundary cells should exist (cells shared by 2+ pincodes)
- All cells should be 6 characters
- All characters should be from set: `F,C,9,8,3,2,J,K,L,M,P,T,4,5,6,7`

---

### External Validation Tests (10 minutes)

```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/test-api-external-validation.sql
```

**Tests:**
- ✅ Official Delhi test case validation
- ✅ Centroid encoding verification (random sample)
- ✅ Sample points within boundaries
- ✅ Known coordinates from major cities
- ✅ Regional prefix consistency

**Expected Results:**
- Delhi (28.6139, 77.2090) → `39J438` ✅
- All centroids should encode to cells in their arrays
- ~90%+ of pincodes should have single regional prefix
- Pincodes with multiple prefixes are on DIGIPIN grid boundaries (valid)

---

## Phase 2: API Endpoint Tests

Test the actual NestJS API endpoints.

### Local Testing

Start your API server:
```bash
npm run start:dev
```

Run the test script:
```bash
chmod +x pynpoint/scripts/test-api-endpoints.sh
./pynpoint/scripts/test-api-endpoints.sh
```

Or with API key:
```bash
API_KEY=your-api-key ./pynpoint/scripts/test-api-endpoints.sh
```

### Production Testing

Test against deployed API:
```bash
API_BASE=https://your-api.railway.app/api/v1 \
API_KEY=your-api-key \
./pynpoint/scripts/test-api-endpoints.sh
```

---

## Expected Test Results

### Test 1: Pincode to DIGIPIN (110001)
```json
{
  "pincode": "110001",
  "level": 6,
  "digipinCodes": ["39J422", "39J427", "39J428", "39J438", ...],
  "totalCells": 25,
  "primaryDigipin": "39J438",
  "pincodeCenter": {
    "latitude": 28.6139,
    "longitude": 77.209
  }
}
```

✅ **Pass if**: Contains `39J438`, all cells are 6 chars, level is 6

---

### Test 2: DIGIPIN to Pincode (39J438)
```json
{
  "digipinCode": "39J438",
  "level": 6,
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "state": "delhi",
      "district": "Central Delhi"
    }
  ],
  "totalPincodes": 1,
  "primaryPincode": {
    "pincode": "110001",
    "officeName": "Parliament House"
  }
}
```

✅ **Pass if**: Returns 110001, HTTP 200, execution time <5ms

---

### Test 3: Level 8 Auto-Truncation (39J438FC)
```json
{
  "digipinCode": "39J438",  // Truncated to Level 6
  "level": 6,
  "pincodes": [...]
}
```

✅ **Pass if**: Same result as Test 2, level is 6 (not 8)

---

### Test 4: Level 4 Rejection (39J4)
```json
{
  "statusCode": 400,
  "message": "DIGIPIN code is Level 4 (less than 6). Only Level 6 and above are supported.",
  "error": "Bad Request"
}
```

✅ **Pass if**: HTTP 400, clear error message

---

## Performance Benchmarks

### Database Query Performance

| Query Type | Expected Time |
|------------|---------------|
| Pincode → DIGIPIN | 5-20ms |
| DIGIPIN → Pincode (GIN index) | 0.1-2ms |
| Round-trip (both) | 10-30ms |

### API Endpoint Performance

| Endpoint | Expected Time |
|----------|---------------|
| GET /pincode-to-digipin/:pincode | 10-50ms |
| GET /digipin-to-pincode/:code | 5-20ms |

*Times include network latency, caching, TypeORM overhead*

---

## Troubleshooting

### Issue: Sequential Scan instead of Index Scan

```sql
-- Run this:
ANALYZE pincodes;

-- Then verify:
EXPLAIN ANALYZE
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'];

-- Should show: "Bitmap Index Scan on idx_pincodes_digipin_cells_gin"
```

---

### Issue: Centroid not in cells array

This is **expected** for pincodes on DIGIPIN grid boundaries. The centroid may encode to a boundary cell that's just outside the actual pincode boundary.

**Solution**: Check if centroid is within 200m of a cell in the array. This is normal.

---

### Issue: Multiple regional prefixes

Pincodes spanning DIGIPIN grid boundaries will have cells from multiple regional prefixes. This is **valid and expected**.

**Examples:**
- Maharashtra pincode 442904: prefixes `48` (96%) and `3T` (4%)
- Large states like Maharashtra, Rajasthan may have multiple prefixes

---

## Success Criteria

### Database Tests
- ✅ 99%+ population complete
- ✅ GIN index active (Bitmap Index Scan)
- ✅ Delhi test case passes
- ✅ 100% round-trip consistency
- ✅ All cells are 6 characters
- ✅ All cells use valid character set

### API Tests
- ✅ All endpoints return HTTP 200 for valid input
- ✅ Invalid inputs return proper HTTP errors (400, 404)
- ✅ Level 6 only policy enforced
- ✅ Auto-truncation works for Level >6
- ✅ Response times <50ms

---

## Next Steps After Testing

1. ✅ **All tests pass** → Deploy to production
2. ⚠️ **Some tests fail** → Review failures, fix issues
3. 📊 **Performance issues** → Check indexes, run ANALYZE
4. 🐛 **Data inconsistencies** → Re-run population for affected pincodes

---

## Quick Reference

### Run All Tests
```bash
# Database tests
railway run psql $DATABASE_URL -f pynpoint/scripts/quick-validation-tests.sql

# API tests  
chmod +x pynpoint/scripts/test-api-endpoints.sh
./pynpoint/scripts/test-api-endpoints.sh
```

### Check Single Pincode
```sql
-- In psql:
SELECT 
  pincode,
  array_length(digipin_cells, 1) as cells,
  digipin_cells[1:5] as sample
FROM pincodes
WHERE pincode = '110001';
```

### Verify Index Usage
```sql
EXPLAIN ANALYZE
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'];
-- Look for: "Bitmap Index Scan on idx_pincodes_digipin_cells_gin"
```

---

Good luck! 🚀
