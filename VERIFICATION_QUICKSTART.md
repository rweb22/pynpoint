# H3 Verification Quick Start Guide

## ⚡ 5-Minute Verification

### Step 1: Run Automated SQL Tests

```bash
# Connect to Railway and run:
railway run bash

# Then inside the container:
psql $DATABASE_URL -f verify_h3_accuracy.sql
```

**What to look for:**
- Test 1 accuracy: Should be ~100%
- Test 4 completeness: 19,287 pincodes with H3 cells
- Test 5 total cells: ~30.5 million

---

### Step 2: Manual Spot Check (3 samples)

```bash
# Get 3 random samples
psql $DATABASE_URL -c "
SELECT 
  pincode,
  h3_cell_to_lat_lng(h3_cells[1]::h3index) as coords
FROM pincodes 
WHERE h3_cells IS NOT NULL 
ORDER BY RANDOM() 
LIMIT 3;"
```

**Example output:**
```
 pincode |       coords        
---------+---------------------
 110001  | (28.6139,77.2090)
 400001  | (18.9388,72.8354)
 560001  | (12.9716,77.5946)
```

**Verify each:**
1. Copy coordinates (remove parentheses): `28.6139, 77.2090`
2. Paste into Google Maps: https://www.google.com/maps
3. Click the dropped pin
4. Check if pincode matches

**Expected result:** All 3 should match ✅

---

### Step 3: Check Known Pincodes

```bash
# Verify major cities
psql $DATABASE_URL -c "
SELECT 
  pincode,
  name,
  array_length(h3_cells, 1) as num_cells
FROM pincodes
WHERE pincode IN ('110001', '400001', '560001', '700001', '600001')
ORDER BY pincode;"
```

**Expected:**
```
 pincode |        name         | num_cells 
---------+---------------------+-----------
 110001  | Parliament House    |       117
 400001  | Fort Mumbai         |        84
 560001  | Bangalore GPO       |       156
 600001  | Chennai GPO         |       142
 700001  | Kolkata GPO         |       128
```

All should have cells > 50 ✅

---

## 🎯 What Counts as "Passing"?

| Test | Pass Criteria |
|------|---------------|
| SQL Test 1 (Spatial) | ≥ 99% |
| Manual Spot Check | 3/3 match |
| Known Pincodes | All have cells |

**If all pass: Your data is accurate! ✅**

---

## 🚨 If Something Fails

### Scenario 1: Manual spot check shows 2/3 or 1/3 matches
- **Likely cause**: Border cells or recent boundary changes
- **Action**: Test 5 more samples. If 7/8 pass, you're good.

### Scenario 2: Known pincode has 0 cells
- **Likely cause**: That specific pincode boundary is missing/invalid
- **Action**: Check source data for that pincode

### Scenario 3: SQL Test 1 accuracy < 95%
- **Likely cause**: Systematic error in source data
- **Action**: Run full diagnostic:
  ```bash
  psql $DATABASE_URL -c "
  SELECT pincode, ST_IsValid(boundary::geometry) as valid
  FROM pincodes
  WHERE boundary IS NOT NULL
  AND NOT ST_IsValid(boundary::geometry)
  LIMIT 10;"
  ```

---

## 📊 Advanced: API Verification

If you want programmatic validation:

```bash
# Get your admin secret from Railway
# Then call the API:

curl -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  "https://pynpoint-production.up.railway.app/v1/admin/verification/validate?sampleSize=1000"
```

**Expected response:**
```json
{
  "totalTests": 1000,
  "passed": 998,
  "failed": 2,
  "accuracy": 99.8
}
```

Accuracy should be > 98% ✅

---

## 🎓 Understanding the Numbers

**30,515,265 total H3 cells**
- Average: 1,557 cells per pincode
- Range: 10 - 50,000 (depends on area size)

**19,287 pincodes with H3 cells**
- Out of 19,596 total pincodes
- 284 skipped (no boundary data)
- 25 skipped (geometry errors)

**309 skipped total = 1.58%**
- This is expected and acceptable
- These pincodes have no spatial data or invalid geometries

---

## ✅ Quick Checklist

- [ ] Ran `verify_h3_accuracy.sql` → 99%+ accuracy
- [ ] Tested 3 random samples on Google Maps → All match
- [ ] Checked known pincodes → All have cells
- [ ] Total cells = ~30.5M
- [ ] Pincodes mapped = 19,287

**All checked? You're verified! 🎉**

---

## 📚 More Info

- **Full details**: See `VERIFICATION_SUMMARY.md`
- **Manual guide**: See `manual_verification.md`
- **Troubleshooting**: See `VERIFICATION_SUMMARY.md` → Support section
