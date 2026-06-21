# API Examples - Stack 3: Advanced/Bulk Operations (Endpoints 7-10)

## Stack 3: Advanced/Bulk Operations (4 endpoints)

### 7. POST /api/v1/convert/bulk/pincode-to-h3

#### Request Body
```typescript
{
  pincodes: string[];               // Max 50
  resolution?: number;              // 0-15, default: 9
}
```

#### Response Structure
**No Changes** - Already uses arrays
```typescript
{
  resolution: number;
  total: number;
  results: {
    [pincode: string]: {
      h3Indexes: string[];
      totalHexagons: number;
      success: boolean;
      error?: string;
    };
  };
}
```

#### Example Request
```bash
POST /api/v1/convert/bulk/pincode-to-h3
Content-Type: application/json

{
  "pincodes": ["110001", "400001", "560001"],
  "resolution": 9
}
```

#### Example Response
```json
{
  "resolution": 9,
  "total": 3,
  "results": {
    "110001": {
      "h3Indexes": ["89283082803ffff", "89283082807ffff"],
      "totalHexagons": 127,
      "success": true
    },
    "400001": {
      "h3Indexes": ["8928308a403ffff", "8928308a407ffff"],
      "totalHexagons": 93,
      "success": true
    },
    "560001": {
      "h3Indexes": [],
      "totalHexagons": 0,
      "success": false,
      "error": "Pincode not found"
    }
  }
}
```

---

### 8. POST /api/v1/convert/bulk/h3-to-pincode

#### Request Body
```typescript
{
  h3Indexes: string[];              // Max 100
}
```

#### Response Structure
**No Changes** - Already uses arrays
```typescript
{
  total: number;
  results: {
    [h3Index: string]: {
      pincodes: string[];
      primaryPincode: string;
      success: boolean;
      error?: string;
    };
  };
}
```

#### Example Request
```bash
POST /api/v1/convert/bulk/h3-to-pincode
Content-Type: application/json

{
  "h3Indexes": [
    "89283082803ffff",
    "8928308a403ffff",
    "invalid_h3"
  ]
}
```

#### Example Response
```json
{
  "total": 3,
  "results": {
    "89283082803ffff": {
      "pincodes": ["110001"],
      "primaryPincode": "110001",
      "success": true
    },
    "8928308a403ffff": {
      "pincodes": ["400001", "400002"],
      "primaryPincode": "400001",
      "success": true
    },
    "invalid_h3": {
      "pincodes": [],
      "primaryPincode": "",
      "success": false,
      "error": "Invalid H3 index"
    }
  }
}
```

---

### 9. GET /api/v1/spatial/intersection

#### Request Parameters
```typescript
Query Parameters:
- pincode: string (required)
- lat: number (required)
- lng: number (required)
```

#### Response Structure
**No Changes**
```typescript
{
  pincode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  isInside: boolean;
  h3Index: string;
  digipinCode: string;
  distance: {
    toPincodeCenter: number;
    unit: string;
  };
}
```

#### Example Request
```bash
GET /api/v1/spatial/intersection?pincode=110001&lat=28.6139&lng=77.2090
```

#### Example Response
```json
{
  "pincode": "110001",
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "isInside": true,
  "h3Index": "89283082803ffff",
  "digipinCode": "39J438",
  "distance": {
    "toPincodeCenter": 0.35,
    "unit": "km"
  }
}
```

---

### 10. POST /api/v1/spatial/polygon-search

#### Request Body
```typescript
{
  polygon: {
    type: 'Polygon';
    coordinates: number[][][];      // GeoJSON polygon
  };
  includeH3?: boolean;              // default: false
  includeDigipin?: boolean;         // default: false
  h3Resolution?: number;            // default: 9
  digipinLevel?: number;            // default: 6
}
```

#### Response Structure
**No Changes** - Already comprehensive
```typescript
{
  pincodes: Array<{
    pincode: string;
    officeName: string;
    district: string;
    state: string;
    overlapPercentage: number;
    h3Indexes?: string[];           // If includeH3=true
    digipinCodes?: string[];        // If includeDigipin=true
  }>;
  totalPincodes: number;
  totalH3Cells?: number;            // If includeH3=true
  totalDigipinCells?: number;       // If includeDigipin=true
  searchArea: {
    value: number;
    unit: string;
  };
}
```

#### Example Request
```bash
POST /api/v1/spatial/polygon-search
Content-Type: application/json

{
  "polygon": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.20, 28.61],
        [77.21, 28.61],
        [77.21, 28.62],
        [77.20, 28.62],
        [77.20, 28.61]
      ]
    ]
  },
  "includeH3": true,
  "includeDigipin": true,
  "h3Resolution": 9,
  "digipinLevel": 6
}
```

#### Example Response
```json
{
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "district": "Central Delhi",
      "state": "Delhi",
      "overlapPercentage": 85.3,
      "h3Indexes": ["89283082803ffff", "89283082807ffff"],
      "digipinCodes": ["39J438", "NJ4VJQ"]
    }
  ],
  "totalPincodes": 1,
  "totalH3Cells": 12,
  "totalDigipinCells": 8,
  "searchArea": {
    "value": 1.23,
    "unit": "km²"
  }
}
```

