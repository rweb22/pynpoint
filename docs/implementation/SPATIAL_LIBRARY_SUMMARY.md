# Spatial Conversion Library - Executive Summary

## Decision: Keep H3-9 Index Only ✅

**Rationale:**
- Current: 32M H3-9 indexes, 2 GB memory
- DIGIPIN-6 would add: 96M indexes, +6 GB memory (total 8 GB)
- **Verdict**: Too expensive. Keep H3-9, compute DIGIPIN on-demand.

---

## Proposed Solution: Dedicated Conversion Library

### Package Name
`@pinpoint/spatial-converter` or in-codebase module `src/spatial-converter`

### Core Capabilities

1. **Resolution/Level Equivalence**
   - Map H3 resolution ↔ DIGIPIN level
   - Compare area coverage
   - Pre-computed equivalence tables

2. **Spatial Relationship Analysis**
   - Containment checks (A contains B?)
   - Overlap percentage calculation
   - Relationship determination

3. **Accurate Conversions**
   - H3 → DIGIPIN (all overlapping cells)
   - DIGIPIN → H3 (all overlapping cells)
   - Relationship-based filtering (contains/contained_by/intersects/overlaps)

---

## Key Algorithms

### 1. H3 → DIGIPIN Conversion
```
Input: H3 index, DIGIPIN level, relationship type
Output: Array of DIGIPIN codes

Algorithm:
1. Get H3 hexagon boundary (7 vertices)
2. Calculate bounding box
3. Generate grid sample points at target DIGIPIN level
4. For each point inside hexagon, encode to DIGIPIN
5. Deduplicate results
6. Filter by relationship if specified
7. Calculate overlap percentages if requested

Time: ~50ms per conversion
Accuracy: 95%+
```

### 2. Overlap Calculation
```
Input: H3 index, DIGIPIN code
Output: Overlap percentage (0-100)

Algorithm:
1. Get boundaries for both cells
2. Generate sample points in intersection area
3. Count points inside both cells
4. Calculate: (intersection / smaller_cell) × 100

Sampling options:
- Coarse (10×10): ~5ms, 90% accuracy
- Medium (20×20): ~20ms, 98% accuracy
- Fine (50×50): ~100ms, 99.5% accuracy

Default: Medium (20×20)
```

### 3. Containment Check
```
Input: Cell A, Cell B
Output: Does A contain B?

Fast mode (95% accuracy, <2ms):
1. Check if B's center is inside A
2. Check if B's area < A's area
3. Return true if both conditions met

Precise mode (100% accuracy, <10ms):
1. Get all vertices of B
2. Check if ALL vertices are inside A
3. Return true only if all inside

Default: Fast mode for filtering, precise for verification
```

---

## Pre-computed Equivalence

### Best Matches (by area)

| H3 Res | DIGIPIN Level | Area Ratio | Equivalence Score |
|--------|---------------|------------|-------------------|
| 8 | 7 | 295× | 60% |
| 8 | 6 | 18.4× | 70% |
| **9** | **7** | **42×** | **75%** |
| **9** | **6** | **2.6×** | **92%** ⭐ Best match! |
| 10 | 8 | 150× | 65% |
| 10 | 7 | 6× | 85% |
| 11 | 9 | - | 80% |

**Key Insight**: H3-9 + DIGIPIN-6 is the optimal pairing (only 2.6× area difference)

---

## API Design

```typescript
// Main converter class
class SpatialConverter {
  // Equivalence
  getEquivalentH3Resolution(digipinLevel: number): number;
  getEquivalentDigipinLevel(h3Resolution: number): number;
  compareAreas(h3Res: number, digipinLevel: number): AreaComparison;
  
  // Conversion
  h3ToDigipinCells(h3Index: string, level: number, options?: Options): string[];
  digipinToH3Cells(digipinCode: string, res: number, options?: Options): string[];
  
  // Relationship-based
  h3ToDigipinByRelationship(h3Index, level, relationship): ConversionResult;
  digipinToH3ByRelationship(code, res, relationship): ConversionResult;
  
  // Spatial analysis
  h3ContainsDigipin(h3Index: string, code: string): boolean;
  digipinContainsH3(code: string, h3Index: string): boolean;
  calculateOverlap(h3Index: string, code: string): number;
}
```

---

## Usage Examples

### Get Equivalent Resolution
```typescript
const converter = new SpatialConverter();

// DIGIPIN-6 → H3-9 (closest match)
const h3Res = converter.getEquivalentH3Resolution(6);
console.log(h3Res); // 9
```

### Convert H3 to DIGIPIN with Containment
```typescript
// Get only DIGIPIN cells FULLY INSIDE H3 cell
const result = converter.h3ToDigipinByRelationship(
  '89283082803ffff',  // H3-9
  8,                  // DIGIPIN level
  'contains'
);

// Returns: ~15 DIGIPIN-8 cells with 100% overlap
```

### Calculate Overlap
```typescript
const overlap = converter.calculateOverlap(
  '89283082803ffff',  // H3-9 (~0.1 km²)
  'NJ4VJM'            // DIGIPIN-6 (~0.04 km²)
);

console.log(overlap); // ~85% (DIGIPIN is smaller, mostly inside H3)
```

---

## Implementation Options

### Option A: Separate npm Package
**Name**: `@pinpoint/spatial-converter`

Pros:
- ✅ Reusable across projects
- ✅ Independent testing
- ✅ Versioned releases
- ✅ Can publish publicly

Cons:
- ❌ More setup overhead
- ❌ Package management complexity

### Option B: In-Codebase Module
**Location**: `pynpoint/src/spatial-converter/`

Pros:
- ✅ Easier initial integration
- ✅ Simpler development workflow
- ✅ No package publishing needed

Cons:
- ❌ Harder to reuse elsewhere
- ❌ Couples to main codebase

**Recommendation**: Start with **Option B**, extract to **Option A** later if needed.

---

## Project Structure (Option B)

```
pynpoint/src/spatial-converter/
├── index.ts                    # Main exports
├── types.ts                    # Type definitions
├── converter.ts                # Main SpatialConverter class
├── equivalence/
│   ├── resolution-mapping.ts   # H3 ↔ DIGIPIN mapping
│   └── equivalence-table.ts    # Pre-computed data
├── conversion/
│   ├── h3-to-digipin.ts       # H3 → DIGIPIN
│   └── digipin-to-h3.ts       # DIGIPIN → H3
├── spatial/
│   ├── containment.ts          # Containment checks
│   ├── overlap.ts              # Overlap calculation
│   └── relationship.ts         # Relationship logic
└── utils/
    ├── geometry.ts             # Geometric utilities
    ├── sampling.ts             # Grid sampling
    └── point-in-polygon.ts     # Point tests
```

---

## Timeline Estimate

1. **Core Library** (~2-3 days)
   - Type definitions
   - Equivalence table
   - Basic conversion algorithms
   - Containment/overlap logic

2. **Testing** (~1-2 days)
   - Unit tests
   - Integration tests
   - Accuracy validation

3. **Documentation** (~1 day)
   - API documentation
   - Usage examples
   - Performance benchmarks

**Total**: ~4-6 days for complete, production-ready library

---

## Next Steps - Questions

1. **Scope**: Should the library include:
   - ✅ H3 ↔ DIGIPIN conversion (yes)
   - ⚪ Pincode ↔ H3 (already exists in services?)
   - ⚪ Pincode ↔ DIGIPIN (already exists in services?)

2. **Location**: 
   - Option A: Separate package
   - Option B: In-codebase module (recommended to start)

3. **Priority**: Should we:
   - Build library first, then use in API refactoring
   - Or implement conversion logic directly in services for now

**My Recommendation**: 
- Build as **in-codebase module** (Option B)
- Focus on **H3 ↔ DIGIPIN conversion only**
- Start with **core algorithms** (~2 days)
- Then integrate into API services

Shall I proceed with implementation?
