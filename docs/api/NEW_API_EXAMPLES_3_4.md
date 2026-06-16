# API Examples - Endpoints 3 & 4

### 3. GET /api/v1/convert/pincode-to-digipin/:pincode

#### Request Parameters
```typescript
Path: pincode (string, required)

Query Parameters:
- level?: number (1-10, default: 6)
- relationship?: 'contains' | 'contained_by' | 'intersects' | 'overlaps' (default: 'intersects')
- includeMetadata?: boolean (default: false)
```

#### Example Requests
```bash
# Simple (current behavior)
GET /api/v1/convert/pincode-to-digipin/110001

# High precision DIGIPIN cells
GET /api/v1/convert/pincode-to-digipin/110001?level=10

# Get DIGIPIN cells FULLY INSIDE pincode
GET /api/v1/convert/pincode-to-digipin/110001?relationship=contains&level=8

# Get large DIGIPIN cells that CONTAIN the pincode
GET /api/v1/convert/pincode-to-digipin/110001?relationship=contained_by&level=4

# With metadata
GET /api/v1/convert/pincode-to-digipin/110001?relationship=contains&level=8&includeMetadata=true
```

#### Response Structure
```typescript
{
  pincode: string;
  level: number;
  digipinCodes: string[];
  totalCells: number;
  coverage: {
    pincodeArea: number;
    digipinCoverage: number;
    areaUnit: string;
  };
  primaryDigipin: string;
  relationship: 'contains' | 'contained_by' | 'intersects' | 'overlaps';
  pincodeCenter: {
    latitude: number;
    longitude: number;
  };
  metadata?: {
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

#### Example Response
```json
{
  "pincode": "110001",
  "level": 6,
  "digipinCodes": [
    "NJ4VJM",
    "NJ4VJQ",
    "NJ4VJR"
  ],
  "totalCells": 3,
  "coverage": {
    "pincodeArea": 5.23,
    "digipinCoverage": 5.15,
    "areaUnit": "km²"
  },
  "primaryDigipin": "NJ4VJM",
  "relationship": "intersects",
  "pincodeCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

---

### 4. GET /api/v1/convert/digipin-to-pincode/:digipinCode

#### Request Parameters
```typescript
Path: digipinCode (string, required)

Query Parameters:
- relationship?: 'contains' | 'contained_by' | 'intersects' | 'overlaps' (default: 'intersects')
- includeMetadata?: boolean (default: false)
```

#### Example Requests
```bash
# Simple (current behavior)
GET /api/v1/convert/digipin-to-pincode/NJ4VJM

# Get pincodes that FULLY CONTAIN this DIGIPIN cell
GET /api/v1/convert/digipin-to-pincode/NJ4VJM?relationship=contained_by

# Get pincodes INSIDE this large DIGIPIN cell (for level 4-5)
GET /api/v1/convert/digipin-to-pincode/NJ4V?relationship=contains

# With metadata
GET /api/v1/convert/digipin-to-pincode/NJ4VJM?relationship=contained_by&includeMetadata=true
```

#### Response Structure
```typescript
{
  digipinCode: string;
  level: number;
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
  digipinCenter: {
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
```

#### Example Response
```json
{
  "digipinCode": "NJ4VJM",
  "level": 6,
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "district": "Central Delhi",
      "state": "Delhi",
      "isPrimary": true,
      "overlapPercentage": 85.3
    }
  ],
  "totalPincodes": 1,
  "primaryPincode": "110001",
  "relationship": "intersects",
  "digipinCenter": {
    "latitude": 28.614,
    "longitude": 77.209
  }
}
```

