# External DIGIPIN Verification

## 🔍 Online Tools Found

### 1. **digipin.com** (Official-looking)
- URL: https://www.digipin.com/
- Example shown: Delhi (28.6139, 77.2090) → **3J2-52M-L8J9**

### 2. **digipin.net.in**
- URL: https://digipin.net.in/28.6139&77.209
- Example shown: Delhi (28.6139, 77.2090) → **39J-438-TJC7**

### 3. **India Post Official Technical Document**
- PDF: https://www.indiapost.gov.in/documents/offerings/intiatives/DIGIPIN_Technical_document.pdf
- Example given: Dak Bhawan (28.622788, 77.213033) → **39J 49L L8T4**

### 4. **rajatguptaa/digipinjs** (Popular GitHub library)
- Example: Delhi (28.6139, 77.2090) → **39J-438-TJC7**

## ⚠️ DISCREPANCY DETECTED!

### Our Test Results (Level 6):
```
Delhi (28.6139, 77.2090) → M32M7L
```

### External Sources Show Different Codes:

| Source | Code (Full 10-char) | First 6 chars |
|--------|---------------------|---------------|
| digipin.com | 3J2-52M-L8J9 | **3J252M** |
| digipin.net.in | 39J-438-TJC7 | **39J438** |
| India Post Doc | 39J 49L L8T4 | **39J49L** |
| digipinjs | 39J-438-TJC7 | **39J438** |

**Our result:** M32M7L ❌

## 🚨 CRITICAL ISSUE

Our SQL implementation does **NOT** match external sources!

### Possible Causes:

1. **Bounding Box Mismatch**
   - Our code uses: `[8.0, 35.0] × [68.0, 97.0]`
   - India Post spec: `[2.5, 38.5] × [63.5, 99.5]` (from search results)
   - **Different starting boxes = completely different codes!**

2. **Grid Layout Direction**
   - Our code might have rows/columns reversed
   - Grid numbering might be different

3. **Character Set Mapping**
   - Different ordering of the charset array

## 🚨 CRITICAL FINDING: Grid Layout Issue

### After fixing bounding box, codes still don't match!

**Delhi (28.6139, 77.2090):**
- External sources: `39J438` or `3J2-52M`
- Our implementation: `FPC7FT`
- **First character differs:** `3` vs `F`

**Root cause:** The grid layout/orientation is different from the official spec.

Our Level-1 cell index calculation:
- Cell 9 → 'F' (row=2, col=1)

Expected:
- Should be '3' (different indexing or orientation)

### Possible Issues:

1. **Row/Column Order** - Might be column-major vs row-major
2. **Grid Numbering** - Bottom-to-top vs top-to-bottom
3. **Character Mapping** - Different charset array ordering

## 🔧 Research Findings from Official Sources

### ✅ CONFIRMED: Bounding Box is WRONG

**Official India Post Technical Document (PDF):**
- States: "Longitude 63.5 - 99 degrees east, Latitude 1.5 - 39 degrees north"
- Multiple libraries confirm: **[2.5, 38.5] × [63.5, 99.5]**

**Our Implementation:**
- Uses: **[8.0, 35.0] × [68.0, 97.0]** ❌

### ✅ CONFIRMED: Character Set Order

**Official spec shows:** `2, 3, 4, 5, 6, 7, 8, 9, C, F, J, K, L, M, P, T`
**Our implementation:** `2, 3, 4, 5, 6, 7, 8, 9, C, F, J, K, L, M, P, T` ✅

Character set is correct!

### ✅ CONFIRMED: Official Test Cases

From India Post Technical Document:
- **Dak Bhawan:** (28.622788, 77.213033) → `39J 49L L8T4` (full 10-char)

From multiple online tools:
- **Delhi:** (28.6139, 77.2090) → `39J-438-TJC7` (most common)
- **Delhi:** (28.6139, 77.2090) → `3J2-52M-L8J9` (digipin.com - possibly different version)

### 🎯 Root Cause Analysis

The bounding box error explains everything:

1. **Wrong starting grid** → All subdivisions are offset
2. **SQL and TypeScript match** → Both copied the same wrong bbox
3. **Need to fix BOTH** → TypeScript AND SQL implementations

## 🔧 Action Required

**DO NOT PROCEED with current implementation!**

### ✅ ROOT CAUSE IDENTIFIED:

After deep research into the official India Post PDF Annexure 1, found **TWO CRITICAL ERRORS**:

1. **WRONG Grid Structure:** Using 1D charset array
   **CORRECT:** Must use 2D grid array: `[['F','C','9','8'],['J','3','2','7'],['K','4','5','6'],['L','M','P','T']]`

2. **WRONG Latitude Direction:** Bottom-to-top (minLat + offset)
   **CORRECT:** Top-to-bottom (maxLat - offset)

Required fixes:
1. ✅ **VERIFIED:** Update INDIA_BBOX to [2.5, 38.5] × [63.5, 99.5]
2. ✅ **VERIFIED:** Use 2D GRID not 1D CHARSET
3. ✅ **VERIFIED:** Reverse latitude indexing direction
4. ⏳ **TODO:** Fix both TypeScript and SQL
5. ⏳ **TODO:** Re-run verification against external sources

See `OFFICIAL_GRID_ANALYSIS.md` for full details.

## 📊 Test Plan

Use these well-known coordinates for verification:

| Location | Lat | Lng | Expected (from sources) |
|----------|-----|-----|-------------------------|
| Delhi | 28.6139 | 77.2090 | 39J-438-TJC7 |
| Dak Bhawan | 28.622788 | 77.213033 | 39J-49L-L8T4 |
| Bangalore | 12.9716 | 77.5946 | (need to verify) |

Once fixed, re-run verification to ensure 100% match with external sources.

## 🌐 Online Verification Tools

### Option 1: digipin.com
Visit: https://www.digipin.com/
Enter coordinates manually and compare

### Option 2: India Post Official (if available)
Check: https://indiapost.gov.in/digipin

### Option 3: GitHub Libraries
Use the official India Post GitHub repo:
https://github.com/INDIAPOST-gov/digipin

**Status:** ❌ Current implementation FAILS external verification
**Next:** Fix bounding box and grid logic before proceeding
