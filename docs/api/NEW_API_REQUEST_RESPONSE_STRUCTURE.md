# New API Request/Response Structure - All 10 Endpoints

## Overview
This document shows the complete request/response structure for all 10 Track 4 conversion endpoints after the spatial relationship refactoring.

---

## Stack 1: Pincode-Centric Conversions (4 endpoints)

### 1. GET /api/v1/convert/pincode-to-h3/:pincode

#### Request Parameters
```typescript
Path: pincode (string, required)

Query Parameters:
- resolution?: number (0-15, default: 9)
- relationship?: 'contains' | 'contained_by' | 'intersects' | 'overlaps' (default: 'intersects')
- includeMetadata?: boolean (default: false)
```

#### Example Requests
```bash
# Simple (current behavior, backward compatible)
GET /api/v1/convert/pincode-to-h3/110001

# With custom resolution
GET /api/v1/convert/pincode-to-h3/110001?resolution=8

# Get only H3 cells FULLY INSIDE pincode
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&resolution=9

# Get H3 cells that CONTAIN the pincode (rare, usually 0 or 1 result)
GET /api/v1/convert/pincode-to-h3/110001?relationship=contained_by&resolution=7

# Get cells on the boundary only
GET /api/v1/convert/pincode-to-h3/110001?relationship=overlaps&resolution=9

# Include detailed metadata
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&includeMetadata=true
```

#### Response Structure
```typescript
{
  pincode: string;
  resolution: number;
  h3Indexes: string[];              // Array of H3 indexes
  totalHexagons: number;
  coverage: {
    pincodeArea: number;
    hexagonsCoverage: number;
    areaUnit: string;               // "km²"
  };
  primaryHexagon: string;           // Centroid-based primary H3
  relationship: 'contains' | 'contained_by' | 'intersects' | 'overlaps';
  pincodeCenter: {
    latitude: number;
    longitude: number;
  };
  metadata?: {                      // Only if includeMetadata=true
    h3Details: Array<{
      h3Index: string;
      resolution: number;
      overlapPercentage: number;    // 0-100
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
  "pincode": "110001",
  "resolution": 9,
  "h3Indexes": [
    "89283082803ffff",
    "89283082807ffff",
    "8928308280bffff"
  ],
  "totalHexagons": 127,
  "coverage": {
    "pincodeArea": 5.23,
    "hexagonsCoverage": 5.18,
    "areaUnit": "km²"
  },
  "primaryHexagon": "89283082803ffff",
  "relationship": "intersects",
  "pincodeCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

#### Example Response (With Metadata)
```json
{
  "pincode": "110001",
  "resolution": 9,
  "h3Indexes": ["89283082803ffff", "89283082807ffff"],
  "totalHexagons": 2,
  "coverage": {
    "pincodeArea": 5.23,
    "hexagonsCoverage": 0.21,
    "areaUnit": "km²"
  },
  "primaryHexagon": "89283082803ffff",
  "relationship": "contains",
  "pincodeCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "metadata": {
    "h3Details": [
      {
        "h3Index": "89283082803ffff",
        "resolution": 9,
        "overlapPercentage": 100.0,
        "area": {
          "value": 0.105,
          "unit": "km²"
        },
        "center": {
          "latitude": 28.614,
          "longitude": 77.209
        }
      },
      {
        "h3Index": "89283082807ffff",
        "resolution": 9,
        "overlapPercentage": 100.0,
        "area": {
          "value": 0.105,
          "unit": "km²"
        },
        "center": {
          "latitude": 28.615,
          "longitude": 77.210
        }
      }
    ]
  }
}
```

---

### 2. GET /api/v1/convert/h3-to-pincode/:h3Index

#### Request Parameters
```typescript
Path: h3Index (string, required)

Query Parameters:
- relationship?: 'contains' | 'contained_by' | 'intersects' | 'overlaps' (default: 'intersects')
- includeMetadata?: boolean (default: false)
```

#### Example Requests
```bash
# Simple (current behavior)
GET /api/v1/convert/h3-to-pincode/89283082803ffff

# Get pincodes that FULLY CONTAIN this H3 cell
GET /api/v1/convert/h3-to-pincode/89283082803ffff?relationship=contained_by

# Get pincodes INSIDE this H3 cell (rare for res-9, more common for res-6)
GET /api/v1/convert/h3-to-pincode/86283082fffffff?relationship=contains

# Include metadata
GET /api/v1/convert/h3-to-pincode/89283082803ffff?relationship=contained_by&includeMetadata=true
```

#### Response Structure
```typescript
{
  h3Index: string;
  resolution: number;
  pincodes: Array<{
    pincode: string;
    officeName: string;
    district: string;
    state: string;
    isPrimary: boolean;
    overlapPercentage: number;
  }>;
  totalPincodes: number;
  primaryPincode: string;
  relationship: 'contains' | 'contained_by' | 'intersects' | 'overlaps';
  hexagonCenter: {
    latitude: number;
    longitude: number;
  };
  metadata?: {
    pincodeDetails: Array<{
      pincode: string;
      officeName: string;
      district: string;
      state: string;
      isPrimary: boolean;
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
