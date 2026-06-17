# Track 2: DIGIPIN Solo Operations

## Overview

DIGIPIN (Digital Postal Index Number) is India Post's hierarchical grid-based geocoding system. This track covers **5 endpoints** in the `DigipinController` that handle **pure DIGIPIN operations** without involving H3 or Pincode conversions.

**⚠️ IMPORTANT: These are PURE operations with NO database dependencies.**
- No pincode lookups
- No database queries
- Pure algorithmic grid calculations
- For DIGIPIN ↔ Pincode conversions, see Track 4 (Conversion Operations)

**Controller:** `pynpoint/src/digipin/controllers/digipin.controller.ts`
**Service:** `pynpoint/src/digipin/services/digipin.service.ts`
**Algorithm:** `pynpoint/src/digipin/services/digipin-algorithm.service.ts`

All endpoints are:
- Protected by `ApiKeyGuard` (requires valid API key)
- Rate limited by `RateLimitInterceptor`
- Usage tracked by `UsageTrackingInterceptor`

---

## Key Concepts

### DIGIPIN Grid System
- **Hierarchical**: 10 levels of precision (level 1 = ~1000km², level 10 = ~1m²)
- **Square grid**: Each cell is divided into 10x10 child cells
- **Code format**: Alphanumeric string where length = level (e.g., "A1B2C3" = level 6)
- **Coverage**: Designed for India's geographic bounds

### Services Architecture
1. **DigipinAlgorithmService** - Pure algorithmic operations (encode, decode, neighbors)
2. **DigipinService** - Business logic combining algorithm + database queries
3. **RedisCacheService** - Caching for expensive operations

---

## Endpoints

## 1. Get Cell Details

**Endpoint:** `GET /api/v1/digipin/:code`

**Description:** Get comprehensive information about a DIGIPIN cell including center, boundary, area, overlapping pincodes, and hierarchy.

### Request

**Path Parameters:**
- `code` (string, required) - DIGIPIN code (1-10 characters, case-insensitive)

**Example:**
```bash
GET /api/v1/digipin/A1B2C3
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "digipinCode": "A1B2C3",
  "level": 6,
  "center": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "bounds": {
    "minLat": 28.60,
    "maxLat": 28.62,
    "minLng": 77.20,
    "maxLng": 77.22
  },
  "boundary": {
    "type": "Polygon",
    "coordinates": [[[77.2, 28.6], [77.22, 28.6], [77.22, 28.62], [77.2, 28.62], [77.2, 28.6]]]
  },
  "area": {
    "value": 1.23,
    "unit": "km²"
  },
  "parentDigipin": "A1B2C",
  "hierarchy": {
    "level1": "A",
    "level2": "A1",
    "level3": "A1B",
    "level4": "A1B2",
    "level5": "A1B2C",
    "level6": "A1B2C3"
  }
}
```

### How Response is Formed

**Step 1: Cache Check**
```typescript
const cacheKey = `digipin:cell:${code.toUpperCase()}`;
const cached = await this.redisCache.get(cacheKey);
// Cache TTL: 1 hour
```

**Step 2: Calculate Cell Geometry** (Pure Algorithm, <1ms)
```typescript
// Get bounding box
const bounds = this.algorithm.getBounds(code);
// Returns: { minLat, maxLat, minLng, maxLng }

// Get center point
const center = this.algorithm.getCenter(code);
// Returns: { lat, lng }

// Build GeoJSON polygon from bounds
const boundary = {
  type: 'Polygon',
  coordinates: [[
    [bounds.minLng, bounds.minLat],
    [bounds.maxLng, bounds.minLat],
    [bounds.maxLng, bounds.maxLat],
    [bounds.minLng, bounds.maxLat],
    [bounds.minLng, bounds.minLat]  // Close polygon
  ]]
};
```

**Step 3: Calculate Area** (Approximate)
```typescript
const latDiff = bounds.maxLat - bounds.minLat;
const lngDiff = bounds.maxLng - bounds.minLng;
// Adjust for Earth's curvature at this latitude
const areaKm2 = latDiff * lngDiff * 111 * 111 * Math.cos(center.lat * Math.PI / 180);
```

**Step 4: Build Hierarchy**
```typescript
const hierarchy = {};
for (let i = 1; i <= code.length; i++) {
  hierarchy[`level${i}`] = code.substring(0, i);
}
// "A1B2C3" → { level1: "A", level2: "A1", ..., level6: "A1B2C3" }
```

**Step 6: Cache Result**
```typescript
await this.redisCache.set(cacheKey, JSON.stringify(response), 3600);
```


## 2. Encode Coordinates to DIGIPIN

**Endpoint:** `POST /api/v1/digipin/encode`

**Description:** Convert geographic coordinates (lat/lng) to DIGIPIN codes. Supports bulk encoding (max 100 coordinates).

### Request

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-api-key-here`

**Request Body:**
```json
{
  "coordinates": [
    { "latitude": 28.6139, "longitude": 77.2090 },
    { "latitude": 19.0760, "longitude": 72.8777 }
  ],
  "level": 6
}
```

**Body Schema:**
- `coordinates` (array, required, 1-100 items)
  - `latitude` (number, -90 to 90)
  - `longitude` (number, -180 to 180)
- `level` (number, optional, 1-10, default: 6) - DIGIPIN precision level

### Response

**Status:** 200 OK

```json
{
  "level": 6,
  "results": [
    {
      "input": { "latitude": 28.6139, "longitude": 77.2090 },
      "digipinCode": "A1B2C3",
      "center": { "latitude": 28.614, "longitude": 77.209 },
      "bounds": {
        "minLat": 28.60,
        "maxLat": 28.62,
        "minLng": 77.20,
        "maxLng": 77.22
      }
    },
    {
      "input": { "latitude": 19.0760, "longitude": 72.8777 },
      "digipinCode": "D4E5F6",
      "center": { "latitude": 19.076, "longitude": 72.878 },
      "bounds": {
        "minLat": 19.07,
        "maxLat": 19.09,
        "minLng": 72.87,
        "maxLng": 72.89
      }
    }
  ]
}
```

### How Response is Formed

**Process:**
```typescript
const results = dto.coordinates.map(coord => {
  // Step 1: Pure algorithmic encoding (<0.1ms per coordinate)
  const digipinCode = this.algorithm.encode(coord.latitude, coord.longitude, level);

  // Step 2: Get cell center
  const center = this.algorithm.getCenter(digipinCode);

  // Step 3: Get cell bounds
  const bounds = this.algorithm.getBounds(digipinCode);

  return {
    input: { latitude: coord.latitude, longitude: coord.longitude },
    digipinCode,
    center: { latitude: center.lat, longitude: center.lng },
    bounds: { minLat: bounds.minLat, maxLat: bounds.maxLat, minLng: bounds.minLng, maxLng: bounds.maxLng }
  };
});
```

**No Database Queries:** Pure algorithmic operations.

**No Caching:** Encoding is extremely fast (<0.1ms per coordinate), caching would add overhead.

**Performance:**
- 1 coordinate: <1ms
- 100 coordinates: 5-15ms

---

## 3. Decode DIGIPIN to Coordinates

**Endpoint:** `POST /api/v1/digipin/decode`

**Description:** Convert DIGIPIN codes to center coordinates. Supports bulk decoding (max 100 codes).

### Request

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-api-key-here`

**Request Body:**
```json
{
  "digipinCodes": ["A1B2C3", "D4E5F6", "X9Y8Z7"]
}
```

**Body Schema:**
- `digipinCodes` (string[], required, 1-100 items) - Array of DIGIPIN codes

### Response

**Status:** 200 OK

```json
{
  "results": [
    {
      "digipinCode": "A1B2C3",
      "center": { "latitude": 28.6139, "longitude": 77.2090 },
      "level": 6
    },
    {
      "digipinCode": "D4E5F6",
      "center": { "latitude": 19.0760, "longitude": 72.8777 },
      "level": 6
    },
    {
      "digipinCode": "X9Y8Z7",
      "center": { "latitude": 15.2993, "longitude": 74.1240 },
      "level": 6
    }
  ]
}
```

### How Response is Formed

**Process:**
```typescript
const results = dto.digipinCodes.map(code => {
  // Pure algorithmic decoding (<0.1ms per code)
  const { lat, lng, level } = this.algorithm.decode(code);

  return {
    digipinCode: code.toUpperCase(),
    center: { latitude: lat, longitude: lng },
    level
  };
});
```

**No Database Queries:** Pure mathematical calculation.

**No Caching:** Decoding is extremely fast (<0.1ms), caching would add overhead.

**Performance:**
- 1 code: <1ms
- 100 codes: 1-5ms

**Note:** This is one of the fastest endpoints in the entire API.

---

## 4. Get Neighbors

**Endpoint:** `GET /api/v1/digipin/neighbors/:code`

**Description:** Get all adjacent DIGIPIN cells at the same level. DIGIPIN uses a 10x10 grid system, so cells have up to 8 neighbors (like a chessboard).

### Request

**Path Parameters:**
- `code` (string, required) - DIGIPIN code

**Example:**
```bash
GET /api/v1/digipin/neighbors/A1B2C3
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "center": "A1B2C3",
  "level": 6,
  "neighbors": [
    "A1B2C2",  // North-West
    "A1B2C3",  // North (same column)
    "A1B2C4",  // North-East
    "A1B2D2",  // West (same row)
    "A1B2D4",  // East (same row)
    "A1B2E2",  // South-West
    "A1B2E3",  // South (same column)
    "A1B2E4"   // South-East
  ],
  "totalCount": 8,
  "note": "DIGIPIN cells have up to 8 neighbors (4x4 grid system, edge cells have fewer)"
}
```

### How Response is Formed

**Process:**
```typescript
// Pure algorithmic neighbor calculation
const neighbors = this.algorithm.getNeighbors(code);
// Returns array of neighbor DIGIPIN codes at same level

return {
  center: code.toUpperCase(),
  level: code.length,
  neighbors,
  totalCount: neighbors.length,
  note: 'DIGIPIN cells have up to 8 neighbors (4x4 grid system, edge cells have fewer)'
};
```

**No Database Queries:** Pure algorithmic grid navigation.

**No Caching:** Extremely fast (<0.1ms), caching unnecessary.

**Performance:** <1ms

**Edge Cases:**
- Edge cells (on grid boundaries): May have 5-7 neighbors
- Corner cells: May have 3 neighbors
- Interior cells: Always 8 neighbors

---

## 5. Get Nearby Cells

**Endpoint:** `GET /api/v1/digipin/nearby`

**Description:** Find all DIGIPIN cells within a specified radius from a coordinate. Useful for proximity searches.

### Request

**Query Parameters:**
- `lat` (number, required, -90 to 90) - Latitude
- `lng` (number, required, -180 to 180) - Longitude
- `radius` (number, optional, 0.1-50, default: 5) - Search radius in kilometers
- `level` (number, optional, 1-10, default: 6) - DIGIPIN precision level

**Example:**
```bash
GET /api/v1/digipin/nearby?lat=28.6139&lng=77.2090&radius=10&level=6
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "center": { "latitude": 28.6139, "longitude": 77.2090 },
  "radius": 10,
  "radiusUnit": "km",
  "level": 6,
  "cells": [
    {
      "digipinCode": "A1B2C3",
      "distance": 0.52,
      "center": { "latitude": 28.614, "longitude": 77.209 },
      "bounds": {
        "minLat": 28.60,
        "maxLat": 28.62,
        "minLng": 77.20,
        "maxLng": 77.22
      }
    },
    {
      "digipinCode": "A1B2C4",
      "distance": 1.23,
      "center": { "latitude": 28.620, "longitude": 77.215 },
      "bounds": {
        "minLat": 28.61,
        "maxLat": 28.63,
        "minLng": 77.21,
        "maxLng": 77.23
      }
    }
    // ... more cells sorted by distance
  ],
  "totalCells": 45
}
```

### How Response is Formed

**Step 1: Cache Check**
```typescript
const cacheKey = `digipin:nearby:${lat}:${lng}:${radius}:${level}`;
const cached = await this.redisCache.get(cacheKey);
// Cache TTL: 1 hour
```

**Step 2: Find Nearby Cells** (Algorithm)
```typescript
// Get all DIGIPIN cells that might overlap with the radius
const nearbyCells = this.algorithm.getNearby(lat, lng, radius, level);
// Returns array of DIGIPIN codes
```

**Step 3: Calculate Distances**
```typescript
const cells = nearbyCells.map(cellCode => {
  // Get cell center
  const cellCenter = this.algorithm.getCenter(cellCode);

  // Calculate distance using Haversine formula
  const distance = this.haversineDistance(lat, lng, cellCenter.lat, cellCenter.lng);

  // Get cell bounds
  const bounds = this.algorithm.getBounds(cellCode);

  return {
    digipinCode: cellCode,
    distance: parseFloat(distance.toFixed(2)),
    center: { latitude: cellCenter.lat, longitude: cellCenter.lng },
    bounds: { minLat: bounds.minLat, maxLat: bounds.maxLat, minLng: bounds.minLng, maxLng: bounds.maxLng }
  };
});
```

**Step 4: Sort by Distance**
```typescript
cells.sort((a, b) => a.distance - b.distance);
```

**Step 5: Cache Result**
```typescript
await this.redisCache.set(cacheKey, JSON.stringify(response), 3600);
```

**Performance:**
- Cache HIT: 1-10ms
- Cache MISS: 10-100ms (pure algorithmic calculation)
- Radius 5km, level 6: ~20-50 cells, ~15-30ms
- Radius 50km, level 6: ~500+ cells, ~100-200ms

**Haversine Distance Formula:**
```typescript
private haversineDistance(lat1, lng1, lat2, lng2): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

---



## Performance Summary

### Caching Strategy

| Endpoint | Cache Key | TTL | Reason |
|----------|-----------|-----|--------|
| GET /:code | `digipin:cell:{code}` | 1 hour | Avoid recomputing geometry/hierarchy |
| POST /encode | Not cached | - | Pure algorithm (<0.1ms) |
| POST /decode | Not cached | - | Pure algorithm (<0.1ms) |
| GET /neighbors/:code | Not cached | - | Pure algorithm (<1ms) |
| GET /nearby | `digipin:nearby:{lat}:{lng}:{r}:{lvl}` | 1 hour | Many distance calculations |

### Response Times

| Endpoint | Cache Hit | Cache Miss | Typical |
|----------|-----------|------------|---------|
| GET /:code | 1-5ms | 5-15ms | 8ms |
| POST /encode (1 coord) | - | <1ms | <1ms |
| POST /encode (100 coords) | - | 5-15ms | 10ms |
| POST /decode (1 code) | - | <1ms | <1ms |
| POST /decode (100 codes) | - | 1-5ms | 2ms |
| GET /neighbors/:code | - | <1ms | <1ms |
| GET /nearby (5km, lvl 6) | 1-10ms | 15-30ms | 20ms |
| GET /nearby (50km, lvl 6) | 1-10ms | 100-200ms | 150ms |

### Algorithm Performance

**All operations are pure algorithmic calculations (No DB queries):**
- Encode coordinate: <0.1ms
- Decode DIGIPIN: <0.1ms
- Get center: <0.05ms
- Get bounds: <0.05ms
- Get neighbors: <1ms
- Get nearby cells (algorithm): 1-10ms depending on radius
- Calculate Haversine distance: <0.01ms per calculation

---

## Error Responses

### 400 Bad Request - Invalid Coordinates
```json
{
  "statusCode": 400,
  "message": ["latitude must not be greater than 90"],
  "error": "Bad Request"
}
```

### 400 Bad Request - Invalid Level
```json
{
  "statusCode": 400,
  "message": ["level must not be greater than 10"],
  "error": "Bad Request"
}
```

### 400 Bad Request - Too Many Items
```json
{
  "statusCode": 400,
  "message": ["coordinates must contain no more than 100 elements"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid or missing API key",
  "error": "Unauthorized"
}
```

### 429 Too Many Requests
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded. Try again later.",
  "error": "Too Many Requests"
}
```

---

## Notes

### DIGIPIN vs H3

| Feature | DIGIPIN | H3 |
|---------|---------|-----|
| Grid shape | Square | Hexagonal |
| Hierarchy | 10x10 subdivision | 7 children per parent |
| Levels | 10 levels | 16 resolutions |
| Geographic focus | India-centric | Global |
| Neighbors | Up to 8 (orthogonal + diagonal) | Always 6 |
| Algorithm speed | Very fast | Fast |

### Best Practices

1. **Use appropriate level:**
   - Level 6: ~100m² (neighborhood-level)
   - Level 8: ~1m² (building-level)
   - Level 10: ~1cm² (room-level)

2. **Batch operations:**
   - Use POST /encode or /decode for multiple coordinates/codes
   - More efficient than multiple single requests

3. **Cache-aware queries:**
   - Repeated nearby queries benefit from cache
   - Decode/encode don't benefit from cache (already fast)

4. **Radius limits:**
   - Keep radius ≤50km for reasonable response times
   - Large radius + low level = many cells = slow query

---

## Authentication & Rate Limiting

All endpoints require API key authentication via `X-API-Key` header.

**Rate Limits (per tier):**
- Free tier: 100 requests/hour
- Basic tier: 1,000 requests/hour
- Pro tier: 10,000 requests/hour
- Enterprise: Unlimited

**Usage Tracking:**
All requests are tracked in the `api_usage` table for billing and analytics.

**Performance:**
- Cache HIT: 1-5ms
- Cache MISS: 20-80ms (depends on pincode query)

---

