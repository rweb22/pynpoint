# DIGIPIN Implementation Plan

## Overview
This document outlines the strategy for implementing Pincode ↔ DIGIPIN conversion stack using **PostgreSQL-native DIGIPIN functions** (Option C - Simplified).

---

## Key Decision: Level-6 Only Implementation

### Why Only Level 6?
- **Equivalent to H3 resolution 9** (~200m × 200m cell size)
- **Optimal for pincode-level addressing** (not too coarse, not too fine)
- **No hierarchy needed** - we can encode directly to level 6

### Simplification Benefits
✅ **No complex hierarchical logic** - just 6 iterations of 4×4 subdivision
✅ **Pure SQL implementation** - runs entirely in PostgreSQL
✅ **Fast execution** - ~0.1ms per encode
✅ **Easy to maintain** - single-level, straightforward algorithm

---

## Architecture

### Database Schema
```sql
pincodes {
  h3_cells: text[]       -- Existing: 30.5M cells (verified 100% accurate)
  digipin_cells: text[]  -- NEW: Level-6 DIGIPIN codes
}

-- GIN index for fast DIGIPIN→Pincode lookup
CREATE INDEX idx_pincode_digipin_cells 
ON pincodes USING GIN (digipin_cells);
```

### PostgreSQL Functions

#### 1. `encode_digipin_level6(lat, lng)`
- **Input**: Latitude, Longitude (DOUBLE PRECISION)
- **Output**: 6-character DIGIPIN code (TEXT)
- **Performance**: ~0.1ms per call
- **Logic**: 
  - 6 iterations of 4×4 grid subdivision
  - Uses India bbox: lat[8.0, 35.0], lng[68.0, 97.0]
  - Charset: 2,3,4,5,6,7,8,9,C,F,J,K,L,M,P,T

#### 2. `polygon_to_digipin_cells_level6(geom, grid_spacing_meters)`
- **Input**: Polygon geometry, grid spacing (default: 100m)
- **Output**: Array of DIGIPIN codes (TEXT[])
- **Strategy**: Regular grid sampling
  1. Generate grid points with ~100m spacing
  2. Filter points inside polygon using `ST_Contains`
  3. Encode each point to DIGIPIN
  4. Deduplicate and return unique codes

---

## Comparison: PostgreSQL vs H3→DIGIPIN

### Option A: H3→DIGIPIN Library (TypeScript)
```typescript
For each pincode:
  1. Read h3_cells from DB (cached)
  2. For each H3, call h3-digipin library
  3. Deduplicate and store
  
Pros: Proven accuracy, reuses H3 cache
Cons: Requires Node.js, 5-10min build time
```

### Option C: PostgreSQL Functions (SELECTED ✅)
```sql
UPDATE pincodes
SET digipin_cells = polygon_to_digipin_cells_level6(boundary::geometry, 100)
WHERE boundary IS NOT NULL;

Pros: Pure SQL, runs in database, parallelizable
Cons: Custom implementation (but simple!)
```

---

## Implementation Steps

### Phase 1: Create Functions ✅
- [x] `encode_digipin_level6()` - Single point encoder
- [x] `polygon_to_digipin_cells_level6()` - Polygon coverage

File: `migrations/create_digipin_functions.sql`

### Phase 2: Add Column & Index
```sql
-- Add column
ALTER TABLE pincodes ADD COLUMN digipin_cells text[] DEFAULT '{}';

-- Create GIN index for fast lookup
CREATE INDEX idx_pincode_digipin_cells 
ON pincodes USING GIN (digipin_cells);
```

File: `migrations/add_digipin_cells_column.sql`

### Phase 3: Populate Data
```sql
-- Update all pincodes with boundaries
UPDATE pincodes
SET digipin_cells = polygon_to_digipin_cells_level6(boundary::geometry, 100)
WHERE boundary IS NOT NULL 
  AND (digipin_cells IS NULL OR array_length(digipin_cells, 1) = 0);
```

**Estimated time**: 10-15 minutes for 19,287 pincodes

### Phase 4: Implement Services
- [ ] `PincodeDigipinService.pincodeToDigipin()` - Read from digipin_cells column
- [ ] `PincodeDigipinService.digipinToPincode()` - GIN index lookup

---

## Performance Estimates

### DIGIPIN Generation (One-Time)
```
Grid sampling: ~100m spacing
Average pincode area: ~20 km²
Sample points per pincode: ~2,000 points
Encode time per point: ~0.1ms
Total per pincode: ~0.2 seconds

19,287 pincodes × 0.2s = ~3,857 seconds = ~64 minutes

With PostgreSQL parallel execution: ~10-15 minutes ✅
```

### Storage
```
Average DIGIPIN cells per pincode: ~6,000-8,000 cells
Total cells: 19,287 × 7,000 = ~135M cells
Storage: 135M × 8 bytes = ~1.08 GB ✅
```

### Query Performance
```
Pincode → DIGIPIN: 
  SELECT digipin_cells FROM pincodes WHERE pincode = '110001'
  Performance: ~5ms ⚡

DIGIPIN → Pincode:
  SELECT pincode FROM pincodes WHERE '39J438' = ANY(digipin_cells)
  Performance: ~10-20ms (GIN index) ⚡
```

---

## Validation Strategy

### 1. Test Encode Function
```sql
-- Delhi coordinates
SELECT encode_digipin_level6(28.6139, 77.2090);
-- Should return 6-character code

-- Compare with TypeScript implementation
-- SELECT encode_digipin_level6(lat, lng) = TypeScript.encode(lat, lng, 6)
```

### 2. Test Polygon Coverage
```sql
-- Small test pincode
SELECT array_length(
  polygon_to_digipin_cells_level6(boundary::geometry, 100), 
  1
) as num_cells
FROM pincodes 
WHERE pincode = '110001';

-- Should return reasonable number based on area
```

### 3. Compare with H3→DIGIPIN
For a sample pincode, compare:
- PostgreSQL function results
- H3→DIGIPIN library results
- Should have >95% overlap

---

## Advantages of This Approach

1. **Pure SQL** ✅
   - Runs entirely in PostgreSQL
   - No external dependencies
   - Can use parallel workers

2. **Simple Implementation** ✅
   - Fixed level-6 (no hierarchy)
   - ~100 lines of PL/pgSQL
   - Easy to debug and maintain

3. **Fast Execution** ✅
   - Native database functions
   - Parallelizable UPDATE
   - GIN index for fast lookups

4. **Storage Efficient** ✅
   - ~1GB for 135M cells
   - Comparable to H3 approach

5. **No External Services** ✅
   - No Node.js needed for generation
   - No h3-digipin dependency for this part
   - Self-contained in database

---

## Next Steps

1. **Test the functions locally** ✓
   - Run `create_digipin_functions.sql`
   - Test with sample coordinates
   - Validate output format

2. **Run on small sample** 
   - Test with 10-20 pincodes
   - Measure performance
   - Check accuracy

3. **Full migration**
   - Apply to all 19,287 pincodes
   - Monitor progress
   - Verify results

4. **Implement API services**
   - Update `PincodeDigipinService`
   - Add caching layer
   - Deploy endpoints

---

## Conclusion

**Option C (PostgreSQL-native, level-6 only)** is the best approach because:

✅ Simplest implementation (no hierarchy)
✅ Fastest execution (pure SQL)
✅ Easy to maintain (single level)
✅ No external dependencies for generation
✅ Comparable performance to other options

The key insight: **We don't need the full DIGIPIN hierarchy - just level 6!**
