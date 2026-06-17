# Track 1: Pincode Solo Operations

Complete API documentation for all pincode-related endpoints.

---

## Table of Contents

1. [GET /api/v1/pincodes/:pincode](#1-get-single-pincode)
2. [GET /api/v1/pincodes](#2-search-pincodes)
3. [POST /api/v1/pincodes/bulk/lookup](#3-bulk-pincode-lookup)
4. [GET /api/v1/administrative/states](#4-get-all-states)
5. [GET /api/v1/administrative/states/:code](#5-get-state-details)
6. [GET /api/v1/administrative/districts](#6-get-districts)

---

## 1. GET Single Pincode

**Endpoint:** `GET /api/v1/pincodes/:pincode`

**Description:** Get detailed information about a specific pincode.

### Request

**Path Parameters:**
- `pincode` (string, required) - 6-digit Indian pincode

**Query Parameters:**
- `includePostOffices` (boolean, optional, default: false) - Include list of post offices
- `includeBoundary` (boolean, optional, default: false) - Include GeoJSON boundary polygon

**Headers:**
- `X-API-Key` (required) - Your API key

### Example Request

```bash
GET /api/v1/pincodes/110001?includePostOffices=true&includeBoundary=true
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

**Response Body:**
```json
{
  "pincode": "110001",
  "officeName": "Parliament House",
  "state": "Delhi",
  "district": "Central Delhi",
  "city": "New Delhi",
  "coordinates": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "boundary": {
    "type": "MultiPolygon",
    "coordinates": [[[...]]]
  },
  "postOffices": [
    {
      "officeName": "Parliament House",
      "area": "New Delhi",
      "officeType": "HO",
      "deliveryStatus": "Delivery",
      "division": "New Delhi Central",
      "region": "Delhi",
      "circle": "Delhi",
      "coordinates": {
        "latitude": 28.6139,
        "longitude": 77.2090
      }
    }
  ],
  "postOfficeCount": 1,
  "isActive": true
}
```

### How Response is Formed

**Step 1: Cache Check**
- Cache key: `pincode:{pincode}:{includePostOffices}:{includeBoundary}`
- TTL: 1 hour (3600 seconds)
- If cache HIT: Return cached result (~1-10ms)

**Step 2: Database Query** (if cache MISS)
```typescript
const pincodeEntity = await this.pincodeRepository.findOne({
  where: { pincode, is_active: true },
});
```
- Query time: ~10-50ms
- Throws `NotFoundException` if pincode not found

**Step 3: Build Response**

```typescript
// Base response
const response = {
  pincode: pincodeEntity.pincode,
  officeName: pincodeEntity.office_name,
  state: pincodeEntity.state,
  district: pincodeEntity.district,
  city: pincodeEntity.city,
  isActive: pincodeEntity.is_active,
};

// Add centroid coordinates (from PostGIS POINT)
if (pincodeEntity.centroid) {
  response.coordinates = parseCoordinates(pincodeEntity.centroid);
  // Parses: "POINT(77.2090 28.6139)" → { latitude: 28.6139, longitude: 77.2090 }
}

// Add boundary if requested (from PostGIS MULTIPOLYGON)
if (includeBoundary && pincodeEntity.boundary) {
  response.boundary = parseBoundary(pincodeEntity.boundary);
  // Returns GeoJSON MultiPolygon format
}

// Add post offices if requested
if (includePostOffices) {
  const postOffices = await this.postOfficeRepository.find({
    where: { pincode: pincodeEntity.pincode, is_active: true },
  });

  response.postOffices = postOffices.map(po => ({
    officeName: po.officename,
    area: po.area,
    officeType: po.officetype,
    deliveryStatus: po.delivery === 'delivery' ? 'Delivery' : 'Non-Delivery',
    division: po.division,
    region: po.region,
    circle: po.circle,
    coordinates: { latitude: po.latitude, longitude: po.longitude }
  }));
  response.postOfficeCount = postOffices.length;
}
```

**Step 4: Cache the Result**
- Store in Redis with 1-hour TTL
- Cache set time: ~1-5ms

**Total Response Time:**
- Cache HIT: 1-10ms
- Cache MISS: 15-60ms

---

## 2. Search Pincodes

**Endpoint:** `GET /api/v1/pincodes`

**Description:** Search and filter pincodes by state, district, city, or text search.

### Request

**Query Parameters:**
- `state` (string, optional) - Filter by state name (case-insensitive)
- `district` (string, optional) - Filter by district name (case-insensitive)
- `city` (string, optional) - Filter by city name (case-insensitive)
- `search` (string, optional) - Search in pincode or office name
- `limit` (number, optional, default: 25, max: 100) - Results per page
- `page` (number, optional, default: 1) - Page number
- `includePostOffices` (boolean, optional, default: false)
- `includeBoundary` (boolean, optional, default: false)

### Example Request

```bash
GET /api/v1/pincodes?state=Delhi&district=Central%20Delhi&limit=10&page=1
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "total": 45,
  "page": 1,
  "limit": 10,
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "state": "Delhi",
      "district": "Central Delhi",
      "city": "New Delhi",
      "coordinates": {
        "latitude": 28.6139,
        "longitude": 77.2090
      },
      "isActive": true
    },
    // ... 9 more pincodes
  ]
}
```

### How Response is Formed

**Step 1: Build Query**
```typescript
const queryBuilder = this.pincodeRepository
  .createQueryBuilder('pincode')
  .where('pincode.is_active = :isActive', { isActive: true });

if (state) {
  queryBuilder.andWhere('LOWER(pincode.state) = LOWER(:state)', { state });
}

if (district) {
  queryBuilder.andWhere('LOWER(pincode.district) = LOWER(:district)', { district });
}

if (city) {
  queryBuilder.andWhere('LOWER(pincode.city) = LOWER(:city)', { city });
}

if (search) {
  queryBuilder.andWhere(
    '(pincode.pincode LIKE :search OR LOWER(pincode.office_name) LIKE LOWER(:search))',
    { search: `%${search}%` }
  );
}
```

**Step 2: Apply Pagination**
```typescript
const skip = (page - 1) * limit;
queryBuilder.skip(skip).take(limit);
```

**Step 3: Execute Query**
```typescript
const [results, total] = await queryBuilder.getManyAndCount();
```

**Step 4: Build Response Array**
- For each pincode entity, build response using same logic as GET single pincode
- Optionally include post offices and boundaries

---

## 3. Bulk Pincode Lookup

**Endpoint:** `POST /api/v1/pincodes/bulk/lookup`

**Description:** Look up multiple pincodes in a single request (max 100 pincodes).

### Request

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: your-api-key-here`

**Request Body:**
```json
{
  "pincodes": ["110001", "110002", "110003", "999999"],
  "includePostOffices": false,
  "includeBoundary": false
}
```

**Body Schema:**
- `pincodes` (string[], required, max 100) - Array of pincode strings
- `includePostOffices` (boolean, optional, default: false)
- `includeBoundary` (boolean, optional, default: false)


### Response

**Status:** 200 OK

```json
{
  "total": 4,
  "results": [
    {
      "pincode": "110001",
      "found": true,
      "data": {
        "pincode": "110001",
        "officeName": "Parliament House",
        "state": "Delhi",
        "district": "Central Delhi",
        "city": "New Delhi",
        "coordinates": { "latitude": 28.6139, "longitude": 77.2090 },
        "isActive": true
      }
    },
    {
      "pincode": "110002",
      "found": true,
      "data": { /* ... */ }
    },
    {
      "pincode": "110003",
      "found": true,
      "data": { /* ... */ }
    },
    {
      "pincode": "999999",
      "found": false,
      "error": "Pincode 999999 not found"
    }
  ]
}
```

### How Response is Formed

**Process:**
```typescript
const results = await Promise.all(
  pincodes.map(async (pincode) => {
    try {
      // Reuses findByPincode() - benefits from cache!
      const data = await this.findByPincode(pincode, includePostOffices, includeBoundary);
      return { pincode, found: true, data };
    } catch (error) {
      return { pincode, found: false, error: error.message };
    }
  })
);
```

**Advantages:**
- Each pincode lookup benefits from individual cache
- Failed lookups don't break the entire request
- Parallel execution for speed (Promise.all)

**Performance:**
- All cached: ~5-20ms for 100 pincodes
- Some cached: ~10-40ms
- None cached: ~30-100ms

---

## 4. Get All States

**Endpoint:** `GET /api/v1/administrative/states`

**Description:** Get list of all states with metadata.

### Request

```bash
GET /api/v1/administrative/states
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "total": 36,
  "states": [
    {
      "name": "Delhi",
      "code": "DL",
      "pincodeCount": 245,
      "districtCount": 11
    },
    {
      "name": "Maharashtra",
      "code": "MH",
      "pincodeCount": 4532,
      "districtCount": 36
    }
    // ... more states
  ]
}
```

### How Response is Formed

**Database Query:**
```sql
SELECT
  state,
  state_code,
  COUNT(DISTINCT pincode) as pincode_count,
  COUNT(DISTINCT district) as district_count
FROM pincodes
WHERE is_active = true
GROUP BY state, state_code
ORDER BY state
```

**TypeORM Implementation:**
```typescript
const result = await this.pincodeRepository
  .createQueryBuilder('p')
  .select('p.state', 'name')
  .addSelect('p.state_code', 'code')
  .addSelect('COUNT(DISTINCT p.pincode)', 'pincodeCount')
  .addSelect('COUNT(DISTINCT p.district)', 'districtCount')
  .where('p.is_active = :isActive', { isActive: true })
  .groupBy('p.state')
  .addGroupBy('p.state_code')
  .orderBy('p.state', 'ASC')
  .getRawMany();
```

**Response Time:** ~50-100ms (relatively static data, good candidate for caching)

---

## 5. Get State Details

**Endpoint:** `GET /api/v1/administrative/states/:code`

**Description:** Get detailed information about a specific state including all districts.

### Request

**Path Parameters:**
- `code` (string, required) - State code (e.g., "DL", "MH", "KA")

```bash
GET /api/v1/administrative/states/DL
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "name": "Delhi",
  "code": "DL",
  "pincodeCount": 245,
  "districtCount": 11,
  "districts": [
    "Central Delhi",
    "East Delhi",
    "New Delhi",
    "North Delhi",
    "North East Delhi",
    "North West Delhi",
    "Shahdara",
    "South Delhi",
    "South East Delhi",
    "South West Delhi",
    "West Delhi"
  ]
}
```

### How Response is Formed

**Step 1: Get State Stats**
```typescript
const stats = await this.pincodeRepository
  .createQueryBuilder('p')
  .select('p.state', 'name')
  .addSelect('p.state_code', 'code')
  .addSelect('COUNT(DISTINCT p.pincode)', 'pincodeCount')
  .addSelect('COUNT(DISTINCT p.district)', 'districtCount')
  .where('p.state_code = :code AND p.is_active = :isActive', { code, isActive: true })
  .groupBy('p.state')
  .addGroupBy('p.state_code')
  .getRawOne();
```

**Step 2: Get Districts List**
```typescript
const districts = await this.pincodeRepository
  .createQueryBuilder('p')
  .select('DISTINCT p.district', 'name')
  .where('p.state_code = :code AND p.is_active = :isActive', { code, isActive: true })
  .orderBy('p.district', 'ASC')
  .getRawMany();
```

**Step 3: Combine Results**
```typescript
return {
  ...stats,
  districts: districts.map(d => d.name)
};
```

---

## 6. Get Districts

**Endpoint:** `GET /api/v1/administrative/districts`

**Description:** Get list of districts, optionally filtered by state.

### Request

**Query Parameters:**
- `state` (string, optional) - Filter by state name
- `limit` (number, optional, default: 100, max: 100)
- `page` (number, optional, default: 1)

```bash
GET /api/v1/administrative/districts?state=Delhi&limit=20
X-API-Key: your-api-key-here
```

### Response

**Status:** 200 OK

```json
{
  "total": 11,
  "districts": [
    {
      "name": "Central Delhi",
      "state": "Delhi",
      "stateCode": "DL",
      "pincodeCount": 23
    },
    {
      "name": "East Delhi",
      "state": "Delhi",
      "stateCode": "DL",
      "pincodeCount": 31
    }
    // ... more districts
  ]
}
```

### How Response is Formed

**Database Query:**
```typescript
const queryBuilder = this.pincodeRepository
  .createQueryBuilder('p')
  .select('p.district', 'name')
  .addSelect('p.state', 'state')
  .addSelect('p.state_code', 'stateCode')
  .addSelect('COUNT(DISTINCT p.pincode)', 'pincodeCount')
  .where('p.is_active = :isActive', { isActive: true })
  .groupBy('p.district')
  .addGroupBy('p.state')
  .addGroupBy('p.state_code')
  .orderBy('p.district', 'ASC');

if (state) {
  queryBuilder.andWhere('LOWER(p.state) = LOWER(:state)', { state });
}

const skip = (page - 1) * limit;
queryBuilder.skip(skip).take(limit);

const [results, total] = await queryBuilder.getRawManyAndCount();
```

---

## Performance Characteristics

### Caching Strategy

| Endpoint | Cache Key | TTL | Hit Rate |
|----------|-----------|-----|----------|
| Single pincode | `pincode:{code}:{opts}` | 1 hour | ~85% |
| Query results | Not cached | - | - |
| Bulk lookup | Reuses single cache | 1 hour | ~60-70% |
| States | Not cached | - | - |
| Districts | Not cached | - | - |

### Database Optimization

- **Indexes:**
  - `pincode` (primary key)
  - `state` (B-tree index)
  - `district` (B-tree index)
  - `city` (B-tree index)
  - `is_active` (B-tree index)
  - `centroid` (PostGIS GIST index)
  - `boundary` (PostGIS GIST index)

### Response Times

| Endpoint | Cache Hit | Cache Miss | Typical |
|----------|-----------|------------|---------|
| Single pincode | 1-10ms | 15-60ms | 5ms |
| Search pincodes | - | 20-100ms | 40ms |
| Bulk (100 pincodes) | 5-20ms | 30-100ms | 25ms |
| All states | - | 50-100ms | 70ms |
| State details | - | 60-120ms | 80ms |
| Districts | - | 40-90ms | 60ms |

---

## Error Responses

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Pincode 999999 not found",
  "error": "Not Found"
}
```

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 100"],
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

## Authentication & Rate Limiting

All endpoints require API key authentication via `X-API-Key` header.

**Rate Limits (per tier):**
- Free tier: 100 requests/hour
- Basic tier: 1,000 requests/hour
- Pro tier: 10,000 requests/hour
- Enterprise: Unlimited

**Usage Tracking:**
All requests are tracked in the `api_usage` table for billing and analytics.

