# DIGIPIN Usage Map - Complete Inventory [HISTORICAL - UPDATED]

**⚠️ NOTE: This document was created during investigation. The h3-digipin library has been FIXED. See `H3_DIGIPIN_FIXED.md`.**

## Executive Summary

**Total DIGIPIN Implementations:** 3
1. ✅ **TypeScript** (Correct) - `DigipinAlgorithmService`
2. ✅ **PostgreSQL** (Correct) - `encode_digipin_level6()` + helpers
3. ❌ **h3-digipin library** (Incorrect) - Geohash-based

**Total API Endpoints:** 12
- 8 pure DIGIPIN endpoints (DigipinController)
- 4 conversion endpoints (H3↔DIGIPIN, Pincode↔DIGIPIN)

---

## 1. Algorithm Implementations

### A. ✅ CORRECT: DigipinAlgorithmService (TypeScript)
**File:** `pynpoint/src/digipin/services/digipin-algorithm.service.ts`

**Grid:**
```typescript
['F', 'C', '9', '8']  // row 0
['J', '3', '2', '7']  // row 1
['K', '4', '5', '6']  // row 2
['L', 'M', 'P', 'T']  // row 3
```

**Bounding Box:** India (2.5-38.5°N, 63.5-99.5°E)  
**Algorithm:** 4×4 grid subdivision  
**Delhi Test:** `39J438` ✅

**Methods:**
- `encode(lat, lng, level)` - Lines 73-120
- `decode(code)` - Lines 128-174
- `getBounds(code)` - Lines 228-257
- `getCenter(code)` - Lines 265-268
- `getNeighbors(code)` - Lines 278-321
- `getNearby(lat, lng, radius, level)` - Lines 334-365
- `getParent(code)` - Lines 401-414
- `getChildren(code)` - Lines 422-439
- `getAncestors(code)` - Lines 447-467

### B. ✅ CORRECT: PostgreSQL Functions
**File:** `pynpoint/migrations/create_digipin_functions.sql`

**Functions:**
- `encode_digipin_level6(lat, lng)` → TEXT
- `polygon_to_digipin_cells_level6(geom, spacing)` → TEXT[]

**Same grid and bounding box as TypeScript**  
**Delhi Test:** `39J438` ✅

### C. ❌ INCORRECT: h3-digipin Library
**File:** `h3-digipin/src/digipin-encoder.ts`

**Alphabet:** `'23456789ABCDEFGHJKLMNPQRSTUVWXYZ'` (32 chars - geohash)  
**Bounding Box:** Global (-90 to 90, -180 to 180)  
**Algorithm:** Binary subdivision (NOT 4×4 grid)  
**Delhi Test:** `M32M7L` ❌

**⚠️ This is NOT the official India Post DIGIPIN algorithm!**

---

## 2. Services Using DIGIPIN

| Service | File | Uses |
|---------|------|------|
| **DigipinService** | `digipin/services/digipin.service.ts` | DigipinAlgorithmService ✅ |
| **DigipinAlgorithmService** | `digipin/services/digipin-algorithm.service.ts` | Self (pure algorithm) ✅ |
| **ConversionService** | `conversion/services/conversion.service.ts` | DigipinAlgorithmService ✅ + SpatialConverter ❌ |
| **H3DigipinService** | `conversion/services/h3-digipin.service.ts` | SpatialConverter ❌ |
| **ConversionAdvancedService** | `conversion/services/conversion-advanced.service.ts` | DigipinAlgorithmService ✅ |
| **PincodeDigipinService** | `conversion/services/pincode-digipin.service.ts` | DigipinAlgorithmService ✅ |

---

## 3. API Endpoints & Source Implementation

### Pure DIGIPIN Endpoints (DigipinController)

| Endpoint | Method | Handler | Source |
|----------|--------|---------|--------|
| `/digipin/encode` | POST | `encode()` | DigipinAlgorithmService.encode() ✅ |
| `/digipin/decode` | POST | `decode()` | DigipinAlgorithmService.decode() ✅ |
| `/digipin/nearby` | GET | `getNearby()` | DigipinAlgorithmService.getNearby() ✅ |
| `/digipin/neighbors/:code` | GET | `getNeighbors()` | DigipinAlgorithmService.getNeighbors() ✅ |
| `/digipin/:code/parent` | GET | `getParent()` | DigipinAlgorithmService.getParent() ✅ |
| `/digipin/:code/children` | GET | `getChildren()` | DigipinAlgorithmService.getChildren() ✅ |
| `/digipin/:code/ancestors` | GET | `getAncestors()` | DigipinAlgorithmService.getAncestors() ✅ |
| `/digipin/:code` | GET | `getCell()` | DigipinAlgorithmService (multiple) ✅ |

**All use CORRECT algorithm** ✅

### Conversion Endpoints

| Endpoint | Method | Service | Source Implementation |
|----------|--------|---------|----------------------|
| `/convert/pincode-to-digipin/:pincode` | GET | ConversionService | **Database column** `pincodes.digipin_cells` ✅ |
| `/convert/digipin-to-pincode/:code` | GET | ConversionService | **GIN index** lookup on `digipin_cells @> ARRAY[code]` ✅ |
| `/convert/h3-to-digipin/:h3` | GET | ConversionService | **SpatialConverter.h3ToDigipin()** ❌ |
| `/convert/digipin-to-h3/:code` | GET | ConversionService | h3-js.polygonToCells() (uses bounds from DigipinAlgorithmService ✅) |

**Key Finding:** `/convert/h3-to-digipin` uses the INCORRECT h3-digipin library!

---

## 4. Detailed Source Tracing

### Endpoint: POST /digipin/encode
```
DigipinController.encode()
  → DigipinService.encode()
    → DigipinAlgorithmService.encode() ✅ CORRECT
```

### Endpoint: GET /convert/pincode-to-digipin/:pincode
```
PincodeDigipinController (via ConversionService.pincodeToDigipin())
  → Database query: SELECT digipin_cells FROM pincodes WHERE pincode = :pincode
    → Column populated by: polygon_to_digipin_cells_level6() ✅ CORRECT
      → Which calls: encode_digipin_level6() ✅ CORRECT
```

**Also computes primaryDigipin:**
```typescript
// Line 336-340
const primaryDigipin = this.digipinAlgorithm.encode(
  centroid.coordinates[1], // latitude
  centroid.coordinates[0], // longitude
  6,
);
```
Uses DigipinAlgorithmService ✅ CORRECT

### Endpoint: GET /convert/digipin-to-pincode/:code
```
ConversionService.digipinToPincode()
  → Database query: SELECT * FROM pincodes WHERE digipin_cells @> ARRAY[:code]
    → Uses GIN index on digipin_cells ✅ CORRECT
```

### Endpoint: GET /convert/h3-to-digipin/:h3
```
ConversionService.h3ToDigipin()
  → Line 476: this.spatialConverter.h3ToDigipin(h3Index, level)
    → SpatialConverter from h3-digipin library
      → DigipinEncoder.encode() ❌ INCORRECT (geohash algorithm)
```

**This is the ONLY endpoint using the wrong algorithm!**

---

## 5. Where Incorrect Algorithm is Used

### ❌ Direct Usage of h3-digipin Library

**Location 1:** `conversion/services/conversion.service.ts`
- **Line 5:** `import { SpatialConverter } from 'h3-digipin'`
- **Line 58:** `this.spatialConverter = new SpatialConverter()`
- **Line 476:** `this.spatialConverter.h3ToDigipin(h3Index, level)` ❌

**Location 2:** `conversion/services/h3-digipin.service.ts`
- **Line 2:** `import { SpatialConverter } from 'h3-digipin'`
- **Methods:** `h3ToDigipin()`, `digipinToH3()`, bulk operations ❌

**Location 3:** `initialization/digipin-index.service.ts`
- **Line 4:** `import { SpatialConverter } from 'h3-digipin'` ❌

### Impact Assessment

| Endpoint | Algorithm | Impact |
|----------|-----------|--------|
| `/digipin/*` (8 endpoints) | DigipinAlgorithmService | ✅ CORRECT |
| `/convert/pincode-to-digipin` | PostgreSQL functions | ✅ CORRECT |
| `/convert/digipin-to-pincode` | Database lookup | ✅ CORRECT |
| `/convert/h3-to-digipin` | h3-digipin library | ❌ INCORRECT |
| `/convert/digipin-to-h3` | Partially correct | ⚠️ Uses correct bounds but wrong h3-digipin for cell generation |

---

## 6. Database Operations

### Column: `pincodes.digipin_cells`
**Type:** `text[]`  
**Index:** GIN (`idx_pincodes_digipin_cells_gin`)  
**Populated by:** `polygon_to_digipin_cells_level6()` ✅ CORRECT  
**Sample:** `['39J422', '39J427', '39J438', ...]` for pincode 110001

### Functions
- `encode_digipin_level6(lat, lng)` ✅ CORRECT
- `polygon_to_digipin_cells_level6(geom, spacing)` ✅ CORRECT

**All PostgreSQL functions use the correct 4×4 grid algorithm.**

---

## 7. Summary of Findings

### ✅ Using CORRECT Algorithm (16-char, 4×4 grid):
1. All `/digipin/*` endpoints (8 total)
2. `/convert/pincode-to-digipin/:pincode`
3. `/convert/digipin-to-pincode/:code`
4. Database column `digipin_cells`
5. PostgreSQL functions
6. DigipinAlgorithmService (all methods)

### ❌ Using INCORRECT Algorithm (32-char geohash):
1. `/convert/h3-to-digipin/:h3Index`
2. H3DigipinService (all methods)
3. Any code using `SpatialConverter` from h3-digipin

### 🤔 Production API Issue:
Based on earlier testing, production returned `M32M7L` for `/digipin/encode`, which suggests:
- **Either:** Old deployment with h3-digipin being used everywhere
- **Or:** Cached responses from when h3-digipin was used

**The current codebase has correct implementations for most endpoints!**

---

## Next Steps

1. Verify production deployment is using latest code
2. Clear Redis cache to remove stale responses
3. Fix `/convert/h3-to-digipin` to use DigipinAlgorithmService
4. Remove or replace h3-digipin library dependency
