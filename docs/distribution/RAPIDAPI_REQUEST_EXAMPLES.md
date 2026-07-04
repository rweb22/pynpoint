# RapidAPI Request Examples - Complete Catalog

Curated request examples for all 36 public API endpoints.
Use these examples when configuring endpoint tests in RapidAPI's "Requests" interface.

**Production URL**: `https://pynpoint.codesense.in`

---

## 📋 Table of Contents

1. [Health & Status (7 endpoints)](#health--status)
2. [PINCODE Operations (8 endpoints)](#pincode-operations)
3. [Administrative (5 endpoints)](#administrative-boundaries)
4. [DIGIPIN Operations (10 endpoints)](#digipin-operations)
5. [Distance Calculations (2 endpoints)](#distance-calculations)
6. [Convert Operations (4 endpoints)](#convert-operations)

---

## Health & Status

### 1. GET /api/v1
**Summary**: API Welcome & Status
**Auth**: Not required
**Query Params**: None
**Expected Response**: 200 OK
```json
{
  "message": "Welcome to PinPoint India API",
  "version": "1.0.0",
  "status": "operational",
  "features": ["PINCODE lookup", "DIGIPIN geocoding", "Distance calculation"],
  "documentation": "/api/docs"
}
```

### 2. GET /api/v1/health
**Summary**: Health check
**Auth**: Not required
**Query Params**: None
**Expected Response**: 200 OK

### 3. GET /api/v1/health/live
**Summary**: Liveness probe
**Auth**: Not required
**Query Params**: None
**Expected Response**: 200 OK

### 4. GET /api/v1/health/ready
**Summary**: Readiness probe
**Auth**: Not required
**Query Params**: None
**Expected Response**: 200 OK

### 5. GET /api/v1/health/status
**Summary**: Detailed health status
**Auth**: Not required
**Query Params**: None
**Expected Response**: 200 OK

### 6. POST /api/v1/health/clear-cache
**Summary**: Clear Redis cache (admin only)
**Auth**: Required (admin secret)
**Body**: None
**Expected Response**: 200 OK

### 7. POST /api/v1/health/reload-pincode-cache
**Summary**: Reload pincode cache (admin only)
**Auth**: Required (admin secret)
**Body**: None
**Expected Response**: 200 OK

---

## PINCODE Operations

### 8. GET /api/v1/pincodes/{pincode}
**Summary**: Get complete pincode details
**Auth**: Required
**Path Param**: `pincode` (e.g., `110001`)
**Query Params**:
- `includePostOffices` (optional): `true` or `false` (default: `false`)

**Example URL**: `/api/v1/pincodes/110001?includePostOffices=true`

**Expected Response**: 200 OK
```json
{
  "pincode": "110001",
  "officeName": "Parliament House",
  "state": "Delhi",
  "district": "Central Delhi",
  "city": "New Delhi",
  "region": "Delhi",
  "circle": "Delhi",
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "postOfficeCount": 15,
  "isActive": true
}
```

### 9. GET /api/v1/pincodes
**Summary**: Search/filter pincodes
**Auth**: Required
**Query Params**:
- `state` (optional): e.g., `Delhi`
- `district` (optional): e.g., `Central Delhi`
- `search` (optional): e.g., `Connaught`
- `limit` (optional): `1-100` (default: `25`)
- `page` (optional): `1+` (default: `1`)
- `includePostOffices` (optional): `true` or `false`

**Example URL**: `/api/v1/pincodes?state=Delhi&district=Central Delhi&limit=10`

**Expected Response**: 200 OK with array of pincodes

### 10. GET /api/v1/pincodes/{pincode}/validate
**Summary**: Validate pincode format and existence
**Auth**: Required
**Path Param**: `pincode` (e.g., `110001`)

**Example URL**: `/api/v1/pincodes/110001/validate`

**Expected Response**: 200 OK
```json
{
  "pincode": "110001",
  "isValid": true,
  "exists": true,
  "format": "valid"
}
```

### 11. GET /api/v1/pincodes/{pincode}/nearby
**Summary**: Find pincodes within radius
**Auth**: Required
**Path Param**: `pincode` (e.g., `110001`)
**Query Params**:
- `radius` (optional): `0.1-500` km (default: `50`)
- `unit` (optional): `km` or `m` (default: `km`)
- `limit` (optional): `1-100` (default: `50`)
- `includeDistance` (optional): `true` or `false` (default: `true`)

**Example URL**: `/api/v1/pincodes/110001/nearby?radius=10&limit=20`

**Expected Response**: 200 OK with array of nearby pincodes

### 12. POST /api/v1/pincodes/reverse-geocode
**Summary**: Find nearest pincode(s) by distance
**Auth**: Required
**Request Body**:
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "maxDistance": 5,
  "limit": 3
}
```

**Field Constraints**:
- `latitude` (required): `-90` to `90`
- `longitude` (required): `-180` to `180`
- `maxDistance` (optional): `0.1` to `50` km (default: `5`)
- `limit` (optional): `1` to `10` (default: `1`)

**Expected Response**: 200 OK
```json
{
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "results": [
    {
      "pincode": "110001",
      "distance": 0.125,
      "officeName": "Parliament House",
      "state": "Delhi",
      "district": "Central Delhi"
    }
  ]
}
```

### 13. POST /api/v1/pincodes/locate
**Summary**: Find pincode containing coordinates (point-in-polygon)
**Auth**: Required
**Request Body**:
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090
}
```

**Field Constraints**:
- `latitude` (required): `-90` to `90`
- `longitude` (required): `-180` to `180`

**Expected Response**: 200 OK
```json
{
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "withinIndiaBounds": true
  },
  "pincode": "110001",
  "found": true,
  "details": {
    "pincode": "110001",
    "officeName": "Parliament House",
    "state": "Delhi",
    "district": "Central Delhi"
  }
}
```

### 14. POST /api/v1/pincodes/bulk/lookup
**Summary**: Bulk pincode lookup (up to 100)
**Auth**: Required
**Request Body**:
```json
{
  "pincodes": ["110001", "400001", "560001", "700001"],
  "includePostOffices": false
}
```

**Field Constraints**:
- `pincodes` (required): Array of 1-100 pincode strings
- `includePostOffices` (optional): Boolean (default: `false`)

**Expected Response**: 200 OK with array of pincode details

### 15. GET /api/v1/pincodes/search
**Summary**: Search pincodes (legacy alias, use GET /api/v1/pincodes instead)
**Auth**: Required
**Note**: Same as endpoint #9

---

## Administrative Boundaries

### 16. GET /api/v1/administrative/states
**Summary**: List all states and union territories
**Auth**: Required
**Query Params**: None

**Expected Response**: 200 OK
```json
{
  "states": [
    {
      "code": "DL",
      "name": "Delhi",
      "type": "Union Territory",
      "districtCount": 11
    }
  ],
  "totalCount": 36
}
```

### 17. GET /api/v1/administrative/states/{code}
**Summary**: Get state details with districts
**Auth**: Required
**Path Param**: `code` (e.g., `DL` for Delhi)

**Example URL**: `/api/v1/administrative/states/DL`

**Expected Response**: 200 OK
```json
{
  "code": "DL",
  "name": "Delhi",
  "type": "Union Territory",
  "districts": [
    {"name": "Central Delhi", "pincodeCount": 45},
    {"name": "North Delhi", "pincodeCount": 38}
  ]
}
```

### 18. GET /api/v1/administrative/districts
**Summary**: List all districts
**Auth**: Required
**Query Params**:
- `state` (optional): Filter by state name
- `limit` (optional): `1-100` (default: `100`)
- `page` (optional): `1+` (default: `1`)

**Example URL**: `/api/v1/administrative/districts?state=Maharashtra&limit=50`

**Expected Response**: 200 OK with array of districts

### 19. GET /api/v1/administrative/regions
**Summary**: List administrative regions
**Auth**: Required
**Query Params**:
- `state` (optional): Filter by state name
- `circle` (optional): Filter by postal circle
- `limit` (optional): `1-500` (default: `100`)
- `page` (optional): `1+` (default: `1`)

**Example URL**: `/api/v1/administrative/regions?state=Delhi`

**Expected Response**: 200 OK with array of regions

### 20. GET /api/v1/administrative/cities
**Summary**: List cities (if implemented)
**Auth**: Required
**Note**: Check if this endpoint exists in your implementation

---

## DIGIPIN Operations

### 21. POST /api/v1/digipin/encode
**Summary**: Encode coordinates to DIGIPIN codes
**Auth**: Required
**Request Body**:
```json
{
  "coordinates": [
    {"latitude": 28.6139, "longitude": 77.2090},
    {"latitude": 19.0760, "longitude": 72.8777}
  ],
  "level": 6
}
```

**Field Constraints**:
- `coordinates` (required): Array of 1-100 coordinate objects
  - `latitude`: `-90` to `90`
  - `longitude`: `-180` to `180`
- `level` (optional): `1` to `10` (default: `6`)
  - Level 1 = ~100km, Level 10 = ~4m accuracy

**Expected Response**: 200 OK
```json
{
  "results": [
    {
      "input": {"latitude": 28.6139, "longitude": 77.2090},
      "digipinCode": "C4P8K63M",
      "level": 6,
      "precision": "~100m",
      "center": {"latitude": 28.6139, "longitude": 77.2090},
      "bounds": {
        "north": 28.6145,
        "south": 28.6133,
        "east": 77.2096,
        "west": 77.2084
      }
    }
  ],
  "count": 1
}
```

### 22. POST /api/v1/digipin/decode
**Summary**: Decode DIGIPIN codes to coordinates
**Auth**: Required
**Request Body**:
```json
{
  "digipinCodes": ["C4P8K63M", "4QHVFP2G"]
}
```

**Field Constraints**:
- `digipinCodes` (required): Array of 1-100 DIGIPIN code strings

**Expected Response**: 200 OK
```json
{
  "results": [
    {
      "digipinCode": "C4P8K63M",
      "level": 8,
      "center": {"latitude": 28.6139, "longitude": 77.2090},
      "bounds": {
        "north": 28.6142,
        "south": 28.6136,
        "east": 77.2093,
        "west": 77.2087
      },
      "precision": "~25m"
    }
  ],
  "count": 1
}
```

### 23. POST /api/v1/digipin/validate
**Summary**: Validate DIGIPIN code format and bounds
**Auth**: Required
**Request Body**:
```json
{
  "digipinCode": "C4P8K63M"
}
```

**Expected Response**: 200 OK
```json
{
  "digipinCode": "C4P8K63M",
  "isValid": true,
  "level": 8,
  "withinIndiaBounds": true
}
```

### 24. POST /api/v1/digipin/to-pincode
**Summary**: Convert DIGIPIN to nearest pincode
**Auth**: Required
**Request Body**:
```json
{
  "digipinCode": "C4P8K63M"
}
```

**Expected Response**: 200 OK
```json
{
  "digipinCode": "C4P8K63M",
  "pincode": "110001",
  "distance": 0.125,
  "officeName": "Parliament House"
}
```

### 25. GET /api/v1/digipin/{code}
**Summary**: Get DIGIPIN cell details
**Auth**: Required
**Path Param**: `code` (e.g., `C4P8K63M`)

**Example URL**: `/api/v1/digipin/C4P8K63M`

**Expected Response**: 200 OK with cell details

### 26. GET /api/v1/digipin/{code}/parent
**Summary**: Get parent DIGIPIN cell (one level up)
**Auth**: Required
**Path Param**: `code` (e.g., `C4P8K63M`)

**Example URL**: `/api/v1/digipin/C4P8K63M/parent`

**Expected Response**: 200 OK with parent cell

### 27. GET /api/v1/digipin/{code}/children
**Summary**: Get child DIGIPIN cells (one level down)
**Auth**: Required
**Path Param**: `code` (e.g., `C4P8K6`)

**Example URL**: `/api/v1/digipin/C4P8K6/children`

**Expected Response**: 200 OK with array of 16 children cells

### 28. GET /api/v1/digipin/{code}/ancestors
**Summary**: Get all ancestor cells (level 1 to parent)
**Auth**: Required
**Path Param**: `code` (e.g., `C4P8K63M4M`)

**Example URL**: `/api/v1/digipin/C4P8K63M4M/ancestors`

**Expected Response**: 200 OK with array of ancestors

### 29. GET /api/v1/digipin/neighbors/{code}
**Summary**: Get 8 neighboring DIGIPIN cells
**Auth**: Required
**Path Param**: `code` (e.g., `C4P8K63M`)

**Example URL**: `/api/v1/digipin/neighbors/C4P8K63M`

**Expected Response**: 200 OK
```json
{
  "center": "C4P8K63M",
  "level": 8,
  "neighbors": ["C4P8K63N", "C4P8K63P", "..."],
  "totalCount": 8
}
```

### 30. GET /api/v1/digipin/nearby
**Summary**: Find DIGIPIN cells within radius
**Auth**: Required
**Query Params**:
- `lat` (required): `-90` to `90`
- `lng` (required): `-180` to `180`
- `radius` (optional): `0.1` to `50` km (default: `5`)
- `level` (optional): `1` to `10` (default: `6`)

**Example URL**: `/api/v1/digipin/nearby?lat=28.6139&lng=77.2090&radius=5&level=6`

**Expected Response**: 200 OK with array of nearby cells

---

## Distance Calculations

### 31. POST /api/v1/distance/calculate
**Summary**: Calculate distance between two locations
**Auth**: Required
**Request Body** (Pincode to Pincode):
```json
{
  "from": {"pincode": "110001"},
  "to": {"pincode": "400001"},
  "unit": "km"
}
```

**Request Body** (Mixed types):
```json
{
  "from": {"digipin": "C4P8K63M"},
  "to": {"coordinate": {"lat": 19.0760, "lng": 72.8777}},
  "unit": "km"
}
```

**Field Constraints**:
- `from` (required): LocationDto (pincode OR digipin OR coordinate)
- `to` (required): LocationDto (pincode OR digipin OR coordinate)
- `unit` (optional): `km`, `mi`, or `m` (default: `km`)

**Expected Response**: 200 OK
```json
{
  "from": {
    "type": "pincode",
    "value": "110001",
    "coordinates": {"lat": 28.6139, "lng": 77.2090},
    "location": "Delhi"
  },
  "to": {
    "type": "pincode",
    "value": "400001",
    "coordinates": {"lat": 18.9388, "lng": 72.8354},
    "location": "Mumbai"
  },
  "distance": {
    "value": 1151.34,
    "unit": "km"
  },
  "method": "haversine"
}
```

### 32. POST /api/v1/distance/batch
**Summary**: Batch distance calculations (up to 100 pairs)
**Auth**: Required
**Request Body**:
```json
{
  "pairs": [
    {
      "from": {"pincode": "110001"},
      "to": {"pincode": "400001"}
    },
    {
      "from": {"pincode": "110001"},
      "to": {"pincode": "560001"}
    }
  ],
  "unit": "km"
}
```

**Field Constraints**:
- `pairs` (required): Array of 1-100 location pair objects
- `unit` (optional): `km`, `mi`, or `m` (default: `km`)

**Expected Response**: 200 OK with array of distance calculations

---

## Convert Operations

### 33. GET /api/v1/convert/pincode-to-digipin/{pincode}
**Summary**: Convert pincode to DIGIPIN (if exists)
**Auth**: Required
**Path Param**: `pincode` (e.g., `110001`)

**Example URL**: `/api/v1/convert/pincode-to-digipin/110001`

### 34. GET /api/v1/convert/digipin-to-pincode/{code}
**Summary**: Convert DIGIPIN to pincode (legacy, use POST /digipin/to-pincode)
**Auth**: Required
**Path Param**: `code` (e.g., `C4P8K63M`)

### 35. POST /api/v1/convert/coordinates-to-pincode
**Summary**: Convert coordinates to pincode (legacy, use POST /pincodes/locate)
**Auth**: Required

### 36. POST /api/v1/convert/coordinates-to-digipin
**Summary**: Convert coordinates to DIGIPIN (legacy, use POST /digipin/encode)
**Auth**: Required

---

## 📝 Notes for RapidAPI Configuration

### Authentication Headers (Auto-added by RapidAPI)
```
X-RapidAPI-Key: {user's subscription key}
X-RapidAPI-Host: pinpoint-india-pincode-digipin.p.rapidapi.com
```

### Common Issues to Fix

1. **Empty query params on POST endpoints**
   - ❌ Wrong: `?=&=` at end of URL
   - ✅ Fix: Remove empty params

2. **Missing request body on POST endpoints**
   - Add proper JSON body with required fields

3. **Path parameters in URL**
   - Replace `{pincode}` with actual value like `110001`
   - Replace `{code}` with actual value like `C4P8K63M`

### Testing Priority

**Test these first** (most critical):
1. ✅ GET /api/v1/pincodes/110001
2. ✅ POST /api/v1/pincodes/reverse-geocode
3. ✅ POST /api/v1/digipin/encode
4. ✅ POST /api/v1/distance/calculate

---

**Total Endpoints**: 36
**Requires Auth**: 29 endpoints
**Public (no auth)**: 7 health endpoints

**Last Updated**: 2026-07-04


