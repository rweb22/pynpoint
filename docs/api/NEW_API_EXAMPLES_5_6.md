# API Examples - Stack 2: DIGIPIN-H3 Bridge (Endpoints 5 & 6)

## Stack 2: DIGIPIN-H3 Bridge Conversions (2 endpoints)

### 5. GET /api/v1/convert/h3-to-digipin/:h3Index

⚠️ **BREAKING CHANGE**: Response changed from singular `digipinCode` to array `digipinCodes[]`

#### Request Parameters
```typescript
Path: h3Index (string, required)

Query Parameters:
- level?: number (1-10, default: 6)
- relationship?: 'contains' | 'contained_by' | 'intersects' | 'overlaps' (default: 'intersects')
- includeMetadata?: boolean (default: false)
```

#### Example Requests
```bash
# Simple - BREAKING CHANGE: Now returns array
GET /api/v1/convert/h3-to-digipin/89283082803ffff

# Higher precision DIGIPIN
GET /api/v1/convert/h3-to-digipin/89283082803ffff?level=8

# Get DIGIPIN cells FULLY INSIDE H3 cell
GET /api/v1/convert/h3-to-digipin/89283082803ffff?relationship=contains&level=8

# Get large DIGIPIN that CONTAINS this H3 cell
GET /api/v1/convert/h3-to-digipin/89283082803ffff?relationship=contained_by&level=4

# With metadata
GET /api/v1/convert/h3-to-digipin/89283082803ffff?relationship=contains&level=8&includeMetadata=true
```

#### Old Response (Before Refactoring) ❌
```typescript
{
  h3Index: string;
  h3Resolution: number;
  digipinCode: string;  // ❌ SINGULAR - This is gone
  digipinLevel: number;
  center: { latitude: number; longitude: number };
}
```

#### New Response Structure ✅
```typescript
{
  h3Index: string;
  h3Resolution: number;
  digipinCodes: string[];           // ✅ NOW ARRAY
  totalDigipinCells: number;        // ✅ NEW
  primaryDigipin: string;           // ✅ NEW - Use this for single value
  digipinLevel: number;
  relationship: 'contains' | 'contained_by' | 'intersects' | 'overlaps';  // ✅ NEW
  center: {
    latitude: number;
    longitude: number;
  };
  metadata?: {                      // ✅ NEW
    digipinDetails: Array<{
      code: string;
      level: number;
      overlapPercentage: number;
      area: {
        value: number;
        unit: string;
      };
      center: {
        latitude: number;
        longitude: number;
      };
    }>;
  };
}
```

#### Example Response (Simple)
```json
{
  "h3Index": "89283082803ffff",
  "h3Resolution": 9,
  "digipinCodes": ["39J438"],
  "totalDigipinCells": 1,
  "primaryDigipin": "39J438",
  "digipinLevel": 6,
  "relationship": "intersects",
  "center": {
    "latitude": 28.614,
    "longitude": 77.209
  }
}
```

#### Example Response (Contains - Multiple Results)
```json
{
  "h3Index": "89283082803ffff",
  "h3Resolution": 9,
  "digipinCodes": ["39J438AB", "39J438AC", "39J438AD"],
  "totalDigipinCells": 3,
  "primaryDigipin": "39J438AB",
  "digipinLevel": 8,
  "relationship": "contains",
  "center": {
    "latitude": 28.614,
    "longitude": 77.209
  }
}
```

#### Migration Guide
```typescript
// ❌ OLD CODE (will break)
const response = await fetch('/api/v1/convert/h3-to-digipin/89283082803ffff');
const { digipinCode } = await response.json();
console.log(digipinCode);  // ❌ undefined - field doesn't exist

// ✅ NEW CODE (backward compatible single value)
const response = await fetch('/api/v1/convert/h3-to-digipin/89283082803ffff');
const { primaryDigipin, digipinCodes } = await response.json();
console.log(primaryDigipin);   // ✅ "39J438" - single centroid-based value
console.log(digipinCodes);     // ✅ ["39J438"] - array of all cells

// ✅ NEW CODE (using all cells)
const { digipinCodes } = await response.json();
digipinCodes.forEach(code => {
  console.log(code);  // Process each DIGIPIN cell
});
```

---

### 6. GET /api/v1/convert/digipin-to-h3/:digipinCode

#### Request Parameters
```typescript
Path: digipinCode (string, required)

Query Parameters:
- resolution?: number (0-15, default: 9)
- relationship?: 'contains' | 'contained_by' | 'intersects' | 'overlaps' (default: 'intersects')
- includeMetadata?: boolean (default: false)
```

#### Example Requests
```bash
# Simple (current behavior)
GET /api/v1/convert/digipin-to-h3/39J438

# Different H3 resolution
GET /api/v1/convert/digipin-to-h3/39J438?resolution=8

# Get H3 cells FULLY INSIDE DIGIPIN
GET /api/v1/convert/digipin-to-h3/39J438?relationship=contains&resolution=10

# Get large H3 cells that CONTAIN this DIGIPIN
GET /api/v1/convert/digipin-to-h3/39J438?relationship=contained_by&resolution=7

# With metadata
GET /api/v1/convert/digipin-to-h3/39J438?relationship=contains&resolution=10&includeMetadata=true
```

#### Response Structure
```typescript
{
  digipinCode: string;
  digipinLevel: number;
  h3Resolution: number;
  h3Indexes: string[];
  totalHexagons: number;
  primaryH3: string;                // ✅ NEW
  coverage: {
    digipinArea: number;
    h3Coverage: number;
    areaUnit: string;
  };
  relationship: 'contains' | 'contained_by' | 'intersects' | 'overlaps';  // ✅ NEW
  metadata?: {                      // ✅ NEW
    h3Details: Array<{
      h3Index: string;
      resolution: number;
      overlapPercentage: number;
      area: {
        value: number;
        unit: string;
      };
      center: {
        latitude: number;
        longitude: number;
      };
    }>;
  };
}
```

#### Example Response
```json
{
  "digipinCode": "39J438",
  "digipinLevel": 6,
  "h3Resolution": 9,
  "h3Indexes": [
    "89283082803ffff",
    "89283082807ffff"
  ],
  "totalHexagons": 2,
  "primaryH3": "89283082803ffff",
  "coverage": {
    "digipinArea": 1.05,
    "h3Coverage": 1.02,
    "areaUnit": "km²"
  },
  "relationship": "intersects"
}
```

