# API Refactoring Summary - All 10 Endpoints

## Overview
Complete request/response structure for all Track 4 conversion endpoints after spatial relationship refactoring.

---

## 📊 Summary Table

| # | Endpoint | Breaking Change? | New Query Params | Response Changes |
|---|----------|-----------------|------------------|------------------|
| 1 | `GET /pincode-to-h3/:pincode` | ❌ No | ✅ relationship, includeMetadata | ✅ Added relationship, metadata |
| 2 | `GET /h3-to-pincode/:h3Index` | ❌ No | ✅ relationship, includeMetadata | ✅ Added totalPincodes, relationship, metadata |
| 3 | `GET /pincode-to-digipin/:pincode` | ❌ No | ✅ relationship, includeMetadata | ✅ Added relationship, metadata |
| 4 | `GET /digipin-to-pincode/:code` | ❌ No | ✅ relationship, includeMetadata | ✅ Added totalPincodes, relationship, metadata |
| 5 | `GET /h3-to-digipin/:h3Index` | ⚠️ **YES** | ✅ relationship, includeMetadata | ⚠️ digipinCode → digipinCodes[], +relationship, +metadata |
| 6 | `GET /digipin-to-h3/:code` | ❌ No | ✅ relationship, includeMetadata | ✅ Added primaryH3, relationship, metadata |
| 7 | `POST /bulk/pincode-to-h3` | ❌ No | None | ❌ No changes |
| 8 | `POST /bulk/h3-to-pincode` | ❌ No | None | ❌ No changes |
| 9 | `GET /spatial/intersection` | ❌ No | None | ❌ No changes |
| 10 | `POST /spatial/polygon-search` | ❌ No | None | ❌ No changes |

**Summary**: 9/10 endpoints are backward compatible. Only endpoint #5 has a breaking change.

---

## 🆕 New Query Parameters (Endpoints 1-6)

All 6 conversion endpoints now support:

### `relationship` (optional)
- Type: `'contains' | 'contained_by' | 'intersects' | 'overlaps'`
- Default: `'intersects'`
- Controls spatial relationship semantics

**Values:**
- `contains`: A completely contains B (B fully inside A)
- `contained_by`: A is completely within B (A fully inside B)
- `intersects`: A and B share any area (default, current behavior)
- `overlaps`: A and B partially overlap (excludes contains/contained_by)

### `includeMetadata` (optional)
- Type: `boolean`
- Default: `false`
- When `true`, includes detailed overlap percentages, areas, and centers for each result

**Example Usage:**
```bash
# Get H3 cells FULLY INSIDE pincode with detailed metadata
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&includeMetadata=true

# Get pincodes that FULLY CONTAIN this H3 cell
GET /api/v1/convert/h3-to-pincode/89283082803ffff?relationship=contained_by

# Get boundary cells only
GET /api/v1/convert/pincode-to-h3/110001?relationship=overlaps&resolution=9
```

---

## ⚠️ Breaking Change - Endpoint #5 Only

### GET /api/v1/convert/h3-to-digipin/:h3Index

**Before:**
```typescript
{
  h3Index: string;
  h3Resolution: number;
  digipinCode: string;  // ❌ Singular
  digipinLevel: number;
  center: { latitude: number; longitude: number };
}
```

**After:**
```typescript
{
  h3Index: string;
  h3Resolution: number;
  digipinCodes: string[];        // ✅ Array
  totalDigipinCells: number;     // ✅ New
  primaryDigipin: string;        // ✅ New (use this for single value)
  digipinLevel: number;
  relationship: string;          // ✅ New
  center: { latitude: number; longitude: number };
  metadata?: { ... };            // ✅ New
}
```

**Migration:**
```typescript
// ❌ Old code
const { digipinCode } = await fetch('/api/v1/convert/h3-to-digipin/...');

// ✅ New code (backward compatible)
const { primaryDigipin } = await fetch('/api/v1/convert/h3-to-digipin/...');
// Or use digipinCodes[] for all cells
```

---

## ✅ New Response Fields (Endpoints 1-6)

All 6 conversion endpoints now include:

### 1. `relationship` field
Shows which spatial relationship was used for the query.

### 2. `total*` count fields
- `totalHexagons` (already existed)
- `totalPincodes` (new for endpoints 2, 4)
- `totalDigipinCells` (new for endpoint 5)

### 3. `primary*` fields
Single "best" result based on centroid:
- `primaryHexagon` (already existed)
- `primaryPincode` (already existed)
- `primaryDigipin` (new for endpoints 3, 5)
- `primaryH3` (new for endpoint 6)

### 4. `metadata` object (optional, when includeMetadata=true)
Detailed information about each result:

```typescript
metadata: {
  h3Details?: Array<{
    h3Index: string;
    resolution: number;
    overlapPercentage: number;  // 0-100
    area: { value: number; unit: string };
    center: { latitude: number; longitude: number };
  }>;
  
  digipinDetails?: Array<{
    code: string;
    level: number;
    overlapPercentage: number;
    area: { value: number; unit: string };
    center: { latitude: number; longitude: number };
  }>;
  
  pincodeDetails?: Array<{
    pincode: string;
    officeName: string;
    district: string;
    state: string;
    isPrimary: boolean;
    overlapPercentage: number;
    area: { value: number; unit: string };
    center: { latitude: number; longitude: number };
  }>;
}
```

---

## 📝 Use Cases by Relationship Type

### `contains` - Find things INSIDE
```bash
# Find all H3 cells FULLY INSIDE a pincode
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&resolution=9

# Find all pincodes FULLY INSIDE a large H3 cell
GET /api/v1/convert/h3-to-pincode/86283082fffffff?relationship=contains
```

### `contained_by` - Find things that CONTAIN
```bash
# Find pincodes that FULLY CONTAIN this H3 cell
GET /api/v1/convert/h3-to-pincode/89283082803ffff?relationship=contained_by

# Find large DIGIPIN cells that CONTAIN this pincode
GET /api/v1/convert/pincode-to-digipin/110001?relationship=contained_by&level=4
```

### `intersects` - Find overlaps (default)
```bash
# Current behavior - any overlap
GET /api/v1/convert/pincode-to-h3/110001
# Same as:
GET /api/v1/convert/pincode-to-h3/110001?relationship=intersects
```

### `overlaps` - Boundary cells only
```bash
# Get cells that partially overlap (on boundary)
GET /api/v1/convert/pincode-to-h3/110001?relationship=overlaps&resolution=9
```

---

## 🔄 Backward Compatibility

### Endpoints 1-4, 6 (Fully Backward Compatible)
- All new query parameters are optional
- Default `relationship=intersects` matches current behavior
- Response structure adds fields, doesn't remove any
- Existing clients continue working without changes

### Endpoint 5 (Breaking Change - Migration Required)
- Field renamed: `digipinCode` → `digipinCodes[]`
- Migration: Use `primaryDigipin` instead of `digipinCode`
- Or iterate over `digipinCodes[]` for all results

### Endpoints 7-10 (No Changes)
- Bulk and spatial endpoints unchanged
- Already use array-based responses
- No migration needed

---

## 📖 Full Documentation

For detailed request/response examples, see:
- `NEW_API_REQUEST_RESPONSE_STRUCTURE.md` - Endpoints 1-2
- `NEW_API_EXAMPLES_3_4.md` - Endpoints 3-4
- `NEW_API_EXAMPLES_5_6.md` - Endpoints 5-6 (includes breaking change details)
- `NEW_API_EXAMPLES_7_10.md` - Endpoints 7-10 (no changes)

