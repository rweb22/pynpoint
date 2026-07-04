# Getting Started with PinPoint India API

Welcome to PinPoint India - India's most comprehensive addressing API supporting both **PINCODE** (6-digit postal codes) and **DIGIPIN** (India Post's official 10-level grid-based geocoding system).

## 🚀 Quick Start

### 1. Subscribe to the API
Click the **Subscribe** button above to choose a plan and get instant API access.

### 2. Authentication
All requests require authentication via the `X-API-Key` header:

```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://pynpoint.codesense.in/api/v1/pincodes/110001
```

**Alternative**: You can also use Bearer token authentication:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://pynpoint.codesense.in/api/v1/pincodes/110001
```

### 3. Base URL
```
https://pynpoint.codesense.in
```

### 4. API Documentation
Interactive Swagger documentation with live testing:
```
https://pynpoint.codesense.in/api/docs
```

---

## 📖 Common Use Cases

### 1. Lookup a PINCODE
Get complete information about any Indian postal code including boundaries, post offices, and administrative details.

**Request:**
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://pynpoint.codesense.in/api/v1/pincodes/110001
```

**Response:**
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

**Query Parameters:**
- `includePostOffices=true` - Include list of all post offices in this pincode

---

### 2. Reverse Geocode (Find Nearest Pincodes)
Find the nearest pincode(s) to any GPS coordinates - useful when coordinates may be outside pincode boundaries.

**Request:**
```bash
curl -X POST https://pynpoint.codesense.in/api/v1/pincodes/reverse-geocode \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090,
    "maxDistance": 5,
    "limit": 3
  }'
```

**Response:**
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
    },
    {
      "pincode": "110003",
      "distance": 1.847,
      "officeName": "Indraprastha Estate",
      "state": "Delhi"
    }
  ]
}
```

**Parameters:**
- `latitude` (required): Latitude (-90 to 90)
- `longitude` (required): Longitude (-180 to 180)
- `maxDistance` (optional): Max search radius in km (default: 5, max: 50)
- `limit` (optional): Number of results (default: 1, max: 10)

---

### 3. Point-in-Polygon Lookup
Find the exact pincode that contains given coordinates using polygon boundary matching.

**Request:**
```bash
curl -X POST https://pynpoint.codesense.in/api/v1/pincodes/locate \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 28.6139,
    "longitude": 77.2090
  }'
```

**Response:**
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

---

### 4. Calculate Distance
Calculate distance between any two locations - supports PINCODE, DIGIPIN, or GPS coordinates.

**Request:**
```bash
curl -X POST https://pynpoint.codesense.in/api/v1/distance/calculate \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": { "pincode": "110001" },
    "to": { "pincode": "400001" },
    "unit": "km"
  }'
```

**Alternate formats:**
```json
{
  "from": { "digipin": "C4P8K63M4M" },
  "to": { "coordinate": { "lat": 19.0760, "lng": 72.8777 } },
  "unit": "km"
}
```

**Response:**
```json
{
  "distance": 1151.34,
  "unit": "km",
  "from": {
    "type": "pincode",
    "value": "110001",
    "coordinates": { "lat": 28.6139, "lng": 77.2090 },
    "location": "Delhi"
  },
  "to": {
    "type": "pincode",
    "value": "400001",
    "coordinates": { "lat": 18.9388, "lng": 72.8354 },
    "location": "Mumbai"
  },
  "estimatedDeliveryTime": {
    "hours": 24,
    "description": "1-2 days"
  }
}
```

**Supported units:** `km` (kilometers), `mi` (miles), `m` (meters)

---

### 5. Encode DIGIPIN
Convert GPS coordinates to DIGIPIN codes (India Post's official geocoding system).

**Request:**
```bash
curl -X POST https://pynpoint.codesense.in/api/v1/digipin/encode \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [
      { "latitude": 28.6139, "longitude": 77.2090 }
    ],
    "level": 6
  }'
```

**Batch encoding (up to 100 coordinates):**
```json
{
  "coordinates": [
    { "latitude": 28.6139, "longitude": 77.2090 },
    { "latitude": 19.0760, "longitude": 72.8777 },
    { "latitude": 13.0827, "longitude": 80.2707 }
  ],
  "level": 8
}
```

**Response:**
```json
{
  "results": [
    {
      "input": {
        "latitude": 28.6139,
        "longitude": 77.2090
      },
      "digipinCode": "C4P8K63M",
      "level": 6,
      "precision": "~100m",
      "center": {
        "latitude": 28.6139,
        "longitude": 77.2090
      },
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

**Levels:** 1-10 (Level 1 = ~100km, Level 10 = ~4m×4m accuracy)

---

### 6. Decode DIGIPIN
Convert DIGIPIN codes back to GPS coordinates.

**Request:**
```bash
curl -X POST https://pynpoint.codesense.in/api/v1/digipin/decode \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "digipinCodes": ["C4P8K63M", "4QHVFP2G"]
  }'
```

**Response:**
```json
{
  "results": [
    {
      "digipinCode": "C4P8K63M",
      "level": 8,
      "center": {
        "latitude": 28.6139,
        "longitude": 77.2090
      },
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

---

## 🛤️ Complete API Reference

### PINCODE Operations (8 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/pincodes/{pincode}` | Get complete pincode details |
| `GET` | `/api/v1/pincodes` | Search/filter pincodes by state, district, name |
| `GET` | `/api/v1/pincodes/{pincode}/validate` | Validate pincode format and existence |
| `GET` | `/api/v1/pincodes/{pincode}/nearby` | Find pincodes within radius |
| `POST` | `/api/v1/pincodes/reverse-geocode` | Find nearest pincode(s) by distance |
| `POST` | `/api/v1/pincodes/locate` | Find pincode containing coordinates (point-in-polygon) |
| `POST` | `/api/v1/pincodes/bulk/lookup` | Bulk pincode lookup (up to 100) |

### Administrative Boundaries (4 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/administrative/states` | List all states and union territories |
| `GET` | `/api/v1/administrative/states/{code}` | Get state details with districts |
| `GET` | `/api/v1/administrative/districts` | List all districts (filter by state) |
| `GET` | `/api/v1/administrative/regions` | List administrative regions |

### DIGIPIN Operations (10 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/digipin/encode` | Coordinates → DIGIPIN (batch: up to 100) |
| `POST` | `/api/v1/digipin/decode` | DIGIPIN → Coordinates (batch: up to 100) |
| `POST` | `/api/v1/digipin/validate` | Validate DIGIPIN code format and bounds |
| `POST` | `/api/v1/digipin/to-pincode` | DIGIPIN → PINCODE conversion |
| `GET` | `/api/v1/digipin/{code}` | Get DIGIPIN cell details |
| `GET` | `/api/v1/digipin/{code}/parent` | Get parent cell (one level up) |
| `GET` | `/api/v1/digipin/{code}/children` | Get all child cells (one level down) |
| `GET` | `/api/v1/digipin/{code}/ancestors` | Get all ancestors (levels 1 to parent) |
| `GET` | `/api/v1/digipin/neighbors/{code}` | Get 8 neighboring cells |
| `GET` | `/api/v1/digipin/nearby` | Find nearby cells within radius |

### Distance Calculations (2 endpoints)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/distance/calculate` | Calculate distance between two locations |
| `POST` | `/api/v1/distance/batch` | Batch distance calculations (up to 100 pairs) |

### Health & Status (1 endpoint)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1` | API welcome and status |

---

## 💡 Key Features

### Data Coverage
✅ **19,000+ Pincodes** with precise PostGIS polygon boundaries
✅ **150,000+ Post Offices** with GPS coordinates
✅ **28 States + 8 Union Territories** - complete coverage
✅ **700+ Districts** with hierarchical relationships
✅ **Official India Post data** - authoritative and accurate

### Technical Capabilities
✅ **Polygon-accurate location validation** - point-in-polygon matching
✅ **DIGIPIN support** - India Post's 10-level grid system
✅ **Dual conversion** - PINCODE ↔ DIGIPIN ↔ Coordinates
✅ **Batch operations** - process up to 100 items per request
✅ **Mixed-type distance** - calculate between any location types

### Performance
✅ **Sub-2ms response times** with intelligent caching
✅ **100+ req/sec** sustained throughput
✅ **Token Bucket rate limiting** - allows legitimate bursts
✅ **Production-grade infrastructure** - battle-tested under load

---

## 📊 Data Coverage Details

| Category | Count | Details |
|----------|-------|---------|
| **Pincodes** | 19,000+ | Complete polygon boundaries for spatial queries |
| **Post Offices** | 150,000+ | Head offices, sub-offices, branch offices |
| **States** | 36 | 28 states + 8 union territories |
| **Districts** | 700+ | Complete administrative hierarchy |
| **DIGIPIN Levels** | 10 | From ~100km (Level 1) to ~4m (Level 10) |

---

## 🔐 Rate Limits & Response Headers

### Rate Limits by Tier
| Tier | Requests/Minute | Burst Capacity | Best For |
|------|----------------|----------------|----------|
| **FREE** | 10 | Up to 10 | Testing & development |
| **BASIC** | 100 | Up to 100 | Small applications |
| **PRO** | 500 | Up to 500 | Production applications |
| **ULTRA** | 1,000 | Up to 1,000 | High-volume applications |
| **ENTERPRISE** | Unlimited | Unlimited | Custom requirements |

### Response Headers
Every API response includes rate limit information:
```
X-RateLimit-Limit: 100           # Your tier limit
X-RateLimit-Remaining: 95         # Requests remaining
X-RateLimit-Reset: 1678901234     # Unix timestamp when limit resets
```

**Rate Limiting Algorithm**: Token Bucket (allows bursts up to your limit)

---

## ⚠️ Error Handling

### HTTP Status Codes
| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | Success | Request processed successfully |
| `400` | Bad Request | Invalid parameters, malformed JSON |
| `401` | Unauthorized | Missing or invalid API key |
| `404` | Not Found | Pincode/DIGIPIN doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Server Error | Internal server error |

### Error Response Format
```json
{
  "statusCode": 400,
  "message": "Invalid coordinates",
  "error": "Bad Request",
  "timestamp": "2026-07-04T12:34:56.789Z",
  "path": "/api/v1/pincodes/reverse-geocode"
}
```

---

## 🎯 Best Practices

### Performance Optimization
1. **Use bulk endpoints** for multiple lookups instead of individual calls
2. **Cache responses** client-side for frequently accessed data
3. **Use point-in-polygon (`/locate`)** instead of reverse-geocode when possible - it's faster
4. **Leverage batch distance calculations** for route optimization

### Request Optimization
5. **Include only needed fields** using query parameters (e.g., `includePostOffices=false`)
6. **Set appropriate `maxDistance`** in reverse-geocode to avoid unnecessary searches
7. **Use DIGIPIN Level 6-8** for most use cases (good balance of accuracy and performance)

### Error Handling
8. **Check status codes** before parsing response body
9. **Handle `404` gracefully** - pincode may not exist in database
10. **Implement exponential backoff** on `429` (rate limit) errors
11. **Monitor `X-RateLimit-Remaining`** header to avoid hitting limits

### Security
12. **Never expose API keys** in client-side code or public repositories
13. **Rotate keys periodically** for security
14. **Use HTTPS only** - never make API calls over HTTP

---

## 🆘 Support & Resources

### Documentation
- **Interactive API Docs**: https://pynpoint.codesense.in/api/docs
  Live testing with Swagger UI
- **OpenAPI Spec**: https://pynpoint.codesense.in/api/docs-json
  Import into Postman, Insomnia, etc.
- **Code Examples**: Available in Swagger UI for multiple languages

### Need Help?
- **Technical Issues**: Contact RapidAPI support via the Support tab above
- **Feature Requests**: Share your use case and we'll help design the solution
- **Integration Help**: Examples available in JavaScript, Python, cURL, and more

### Stay Updated
- **API Version**: Check `/api/v1` endpoint for current version
- **Rate Limits**: Monitor response headers to track usage
- **Status**: All systems operational

---

## 📚 Additional Examples

### Search Pincodes
```bash
# By state
GET /api/v1/pincodes?state=Delhi&limit=10

# By district
GET /api/v1/pincodes?state=Maharashtra&district=Mumbai&limit=25

# Search by name
GET /api/v1/pincodes?search=Connaught&limit=5
```

### Validate Pincode
```bash
GET /api/v1/pincodes/110001/validate
```

### Find Nearby Pincodes
```bash
GET /api/v1/pincodes/110001/nearby?radius=10&unit=km&limit=20
```

### Get DIGIPIN Hierarchy
```bash
# Get parent
GET /api/v1/digipin/C4P8K63M/parent

# Get all children
GET /api/v1/digipin/C4P8K6/children

# Get full ancestry
GET /api/v1/digipin/C4P8K63M4M/ancestors
```

---

**Ready to get started?** Subscribe above and get instant API access! 🚀
