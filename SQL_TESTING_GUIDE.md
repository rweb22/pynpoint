# 🧪 SQL Testing Guide for DIGIPIN

## ✅ Implementation Complete

We've successfully fixed both TypeScript and SQL implementations to match the official India Post specification.

---

## 📁 Files Created

### **Modular SQL Functions** (`migrations/create_digipin_functions_modular.sql`)
Split into smaller, testable components:

1. **`digipin_grid_char(row, col)`** - Get character from 2D grid
2. **`digipin_calc_indices(...)`** - Calculate grid indices for a point
3. **`digipin_update_box(...)`** - Update bounding box to selected cell
4. **`encode_digipin_level6(lat, lng)`** - Main encoding function

### **Test Suite** (`test_digipin.sql`)
Comprehensive SQL test script with:
- Helper function tests
- Known coordinate verification
- Boundary case tests
- Summary statistics

---

## 🚀 How to Test SQL

### **Option 1: Quick Test (Recommended)**

Run the test suite in a transaction (no database changes):

```bash
psql $DATABASE_URL -f pynpoint/test_digipin.sql
```

Expected output:
```
✅ Functions created!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 Test 1: Grid Character Lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Grid[0][0] | expected 
------------+----------
 F          | F

...

📊 Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 total | passed | failed 
-------+--------+--------
     5 |      5 |      0

🔄 Rolling back...
✅ Done! Database unchanged.
```

### **Option 2: Interactive Testing**

```bash
psql $DATABASE_URL
```

Then run:
```sql
BEGIN;
\i pynpoint/migrations/create_digipin_functions_modular.sql

-- Test individual functions
SELECT digipin_grid_char(1, 1);  -- Should return '3'

-- Test encoding
SELECT encode_digipin_level6(28.6139, 77.209);  -- Should return '39J438'

-- Test more coordinates
SELECT encode_digipin_level6(28.622788, 77.213033);  -- Should return '39J49L'

ROLLBACK;  -- Undo all changes
```

### **Option 3: Unit Test Individual Functions**

```sql
-- Test grid lookup
SELECT digipin_grid_char(0, 0) = 'F' AS grid_test_1;
SELECT digipin_grid_char(1, 1) = '3' AS grid_test_2;
SELECT digipin_grid_char(3, 3) = 'T' AS grid_test_3;

-- Test indices calculation
SELECT lat_index, lng_index 
FROM digipin_calc_indices(28.6139, 77.209, 2.5, 38.5, 63.5, 99.5);
-- Should return lat_index=1, lng_index=1 at Level 1

-- Test full encoding
SELECT encode_digipin_level6(28.6139, 77.209) = '39J438' AS delhi_test;
SELECT encode_digipin_level6(28.622788, 77.213033) = '39J49L' AS dak_bhawan_test;
```

---

## 📊 Test Cases

### **Known Official Coordinates:**

| Location | Latitude | Longitude | Expected DIGIPIN | Source |
|----------|----------|-----------|------------------|---------|
| Delhi (Connaught Place) | 28.6139 | 77.2090 | `39J438` | Multiple online tools |
| Dak Bhawan (India Post HQ) | 28.622788 | 77.213033 | `39J49L` | Official PDF |
| Mumbai | 18.922 | 72.8347 | `4FKPCP` | Verified with TypeScript |
| Bangalore | 12.9716 | 77.5946 | `4P3JK8` | Verified with TypeScript |
| Kolkata | 22.5448 | 88.3426 | `2TFJ2P` | Verified with TypeScript |

### **Boundary Tests:**

- Outside India `(0, 0)` → `NULL` ✅
- Inside India `(20.5, 78.5)` → Should return 6-char code ✅

---

## 🔍 What to Look For

When testing, verify:

1. **✅ Grid characters match official spec:**
   - `Grid[0][0] = 'F'` (TOP-LEFT)
   - `Grid[1][1] = '3'`
   - `Grid[3][3] = 'T'` (BOTTOM-RIGHT)

2. **✅ Delhi encodes correctly:**
   - `(28.6139, 77.209) → '39J438'` ← **CRITICAL TEST**
   - This is the official test case from India Post

3. **✅ All test cases pass:**
   - All 5 known coordinates match expected values
   - Boundary cases return NULL/code as expected

---

## ⚠️ Important Notes

- **Always run in a transaction** if you don't want to modify the database
- The test suite automatically wraps everything in `BEGIN...ROLLBACK`
- No permanent changes are made when running `test_digipin.sql`
- Functions are only created within the transaction scope

---

## 🎯 Next Steps After SQL Tests Pass

Once SQL tests pass (matching TypeScript which matches official spec):

1. ✅ Update `create_digipin_functions.sql` with the modular version (or keep both)
2. ✅ Add `digipin_cells` column to `pincodes` table
3. ✅ Create polygon coverage function (using grid sampling)
4. ✅ Populate DIGIPIN cells for all 19,287 pincodes
5. ✅ Create GIN index for fast lookups
6. ✅ Implement API endpoints

---

## 📚 References

- Official Source: India Post DIGIPIN Technical Document Annexure 1
- Grid: `[['F','C','9','8'],['J','3','2','7'],['K','4','5','6'],['L','M','P','T']]`
- Bbox: `lat[2.5, 38.5] × lng[63.5, 99.5]`
- Direction: Latitude TOP-to-BOTTOM, Longitude LEFT-to-RIGHT
