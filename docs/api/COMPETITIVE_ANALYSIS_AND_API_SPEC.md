# Competitive Analysis & API Endpoint Specification

**Date**: 2026-06-14
**Purpose**: Define PinPoint India API endpoints based on competitive analysis and DIGIPIN research
**H3 Implementation**: Resolution 9 (~340m average edge length)

---

## 🔍 Competitive Analysis Summary

### **Existing Indian Postal/Geocoding APIs (RapidAPI Ecosystem)**

| API Provider | Key Features | Pain Points Identified |
|-------------|--------------|------------------------|
| **GetPincode API** | Basic pincode lookup, JSON responses | ❌ No spatial indexing, ❌ No coordinates |
| **India Address to Pincode** | Address → Pincode conversion | ❌ Limited reverse geocoding, ❌ No bulk operations |
| **Geo Location API (India)** | Lat/Lng → Location details | ❌ 87ms latency, ❌ No pincode-first design |
| **PostalPinCode API** | Post office lookup, address validation | ❌ No modern spatial indexing |
| **Laravel Pincode API** | State/District/Tehsil hierarchy | ✅ Rate limiting (v1.1.0), ❌ Performance issues noted |

### **Developer Pain Points in Indian GIS/Postal Space**

1. **Data Staleness** 🕒
   - Competitors rely on outdated datasets
   - No real-time validation mechanisms
   - Lack of version tracking or data freshness indicators

2. **Lack of Precise Spatial Context** 📍
   - Pincodes cover large irregular areas (avg 20-100 km²)
   - No standardized grid-based addressing
   - Poor support for exact coordinate mapping

3. **Performance Issues** ⚡
   - High latency (50-200ms typical)
   - No efficient spatial indexing
   - Limited caching strategies
   - Poor bulk operation support

4. **Limited Spatial Operations** 🗺️
   - No proximity search capabilities
   - No hexagonal grid support
   - No spatial intersection analysis
   - No "nearby pincodes" with guaranteed coverage

5. **Inconsistent APIs** 🔧
   - Various response formats
   - No standardization across providers
   - Limited filtering capabilities
   - Poor documentation

---

## 🇮🇳 DIGIPIN System Analysis

**Source**: India Post Technical Document (DIGIPIN_Technical_document.pdf)

### **DIGIPIN Characteristics:**

- **Purpose**: Digital Postal Index Number for precise location addressing
- **Encoding**: Hierarchical alphanumeric grid system
- **Symbols**: 16 characters (2-9, C, F, J, K, L, M, P, T)
- **Structure**: 4x4 grid subdivision at each level
- **Coverage**: Entire India with hierarchical precision

**Levels**:
- Level 1: 4x4 = 16 regions (1 character)
- Level 2: 16x16 = 256 subregions (2 characters)
- Level 3+: Progressive refinement

### **Our Competitive Advantage: H3 Integration**

**Why H3 > DIGIPIN for APIs:**
1. ✅ **Global Standard**: Uber H3 is industry-proven
2. ✅ **Better Geometry**: Hexagons > Squares (no edge/corner bias)
3. ✅ **Hierarchical**: 16 resolutions (0-15) vs DIGIPIN's limited levels
4. ✅ **Open Source**: Mature ecosystem, tooling, and libraries
5. ✅ **Performance**: Optimized for spatial operations
6. ✅ **Uniform Coverage**: ~340m edge at Resolution 9

**However, we should support DIGIPIN for:**
- Compatibility with India Post initiatives
- Government integration potential
- User familiarity (if adopted nationally)

---

## 🎯 Our Unique Value Proposition

### **What Makes PinPoint India Different:**

1. **H3 Spatial Index** (32.5M hexagons at Resolution 9)
   - Sub-kilometer precision
   - Guaranteed uniform coverage
   - Fast proximity searches

2. **Dual-Redis Architecture**
   - Sub-5ms response times
   - 99%+ cache hit rate
   - Persistent spatial index

3. **Tier-Based Rate Limiting**
   - Fair usage across customer tiers
   - Transparent rate limit headers

4. **Multi-System Support**
   - Traditional Pincodes (India Post)
   - DIGIPIN (India Post's grid system)
   - H3 Hexagonal Index (Uber's spatial system)
   - Bidirectional conversions between all three

5. **Hybrid Operations**
   - Pincode ↔ H3 ↔ DIGIPIN conversions
   - Spatial intersection logic
   - Multi-pincode hexagon containment

6. **Developer-First Design**
   - RESTful + clean JSON
   - Comprehensive error messages
   - Pagination + filtering built-in

---

## 📋 API Endpoint Specification

### **Base URL**: `https://api.pinpointindia.com/api/v1`

### **Authentication**: All endpoints require API key in `Authorization` header
```
Authorization: Bearer ppk_live_sk_...
```

### **Response Format**: JSON
### **Rate Limiting**: Tier-based (see headers)

---

## 🏗️ Track 1: Pincode Solo Operations

Standard RESTful endpoints for traditional pincode operations.

### **1.1 GET /pincodes/:pincode**
Get comprehensive details about a specific pincode.

**URL**: `/pincodes/110001`

**Response**:
```json
{
  "pincode": "110001",
  "officeName": "Parliament House",
  "officeType": "SO",
  "deliveryStatus": "Delivery",
  "district": "Central Delhi",
  "state": "Delhi",
  "stateName": "Delhi",
  "division": "New Delhi Central",

### **1.3 GET /administrative/states**
List all states/UTs with metadata.

**Response**:
```json
{
  "total": 36,
  "states": [
    {
      "name": "Delhi",
      "code": "DL",
      "capital": "New Delhi",
      "pincodeCount": 245,
      "districtCount": 11,
      "divisionCount": 15
    }
  ]
}
```

---

### **1.4 GET /administrative/states/:stateCode**
Get detailed state information with optional geometry.

**URL**: `/administrative/states/DL?includeGeometry=true`

**Query Parameters**:
- `includeGeometry` (boolean, default: false) - Include GeoJSON boundaries

**Response**:
```json
{
  "name": "Delhi",
  "code": "DL",
  "capital": "New Delhi",
  "pincodeRange": {
    "min": "110001",
    "max": "110096"
  },
  "statistics": {
    "totalPincodes": 245,
    "totalDistricts": 11,
    "totalDivisions": 15,
    "area": {
      "value": 1484,
      "unit": "km²"
    }
  },
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [...]
  }
}
```

---

### **1.5 GET /administrative/districts**
List districts with optional state filter.

**Query Parameters**:
- `state` (string) - Filter by state code or name
- `limit` (integer, default: 100)
- `offset` (integer, default: 0)

**Example**: `/administrative/districts?state=DL`

---

### **1.6 POST /pincodes/bulk/lookup**
Lookup multiple pincodes in one request (up to 100).

**Request Body**:
```json
{
  "pincodes": ["110001", "400001", "560001"],
  "includeGeometry": false
}
```

**Response**:
```json
{
  "total": 3,
  "found": 3,
  "notFound": [],
  "results": {
    "110001": { /* full pincode data */ },
    "400001": { /* full pincode data */ },
    "560001": { /* full pincode data */ }
  }
}
```

---

## 🔷 Track 2: DIGIPIN Solo Operations

Endpoints for India Post's official Digital Postal Index Number (DIGIPIN) system.

**Note**: DIGIPIN is India Post's official grid-based addressing system using 16-symbol alphanumeric codes (2-9, C, F, J, K, L, M, P, T).

---

### **2.1 GET /digipin/:digipinCode**
Get detailed information about a DIGIPIN cell.

**URL**: `/digipin/2C45KL`

**Response**:
```json
{
  "digipinCode": "2C45KL",
  "level": 6,
  "center": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "boundary": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.208, 28.614],
        [77.220, 28.614],
        [77.220, 28.626],
        [77.208, 28.626],
        [77.208, 28.614]
      ]
    ]
  },
  "area": {
    "value": 1.2,
    "unit": "km²"
  },
  "pincodes": ["110001", "110002"],
  "pincodeCount": 2,
  "parentDigipin": "2C45K",
  "hierarchy": {
    "level1": "2",
    "level2": "2C",
    "level3": "2C4",
    "level4": "2C45",
    "level5": "2C45K",
    "level6": "2C45KL"
  }
}
```

---

### **2.2 POST /digipin/encode**
Convert coordinates to DIGIPIN code.

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

**Response**:
```json
{
  "level": 6,
  "results": [
    {
      "input": {"latitude": 28.6139, "longitude": 77.2090},
      "digipinCode": "2C45KL",
      "pincodes": ["110001"]
    },
    {
      "input": {"latitude": 19.0760, "longitude": 72.8777},
      "digipinCode": "3F89TM",
      "pincodes": ["400001", "400002"]
    }
  ]
}
```

---

### **2.3 POST /digipin/decode**
Convert DIGIPIN codes to center coordinates.

**Request Body**:
```json
{
  "digipinCodes": ["2C45KL", "3F89TM"]
}
```

**Response**:
```json
{
  "results": [
    {
      "digipinCode": "2C45KL",
      "center": {"latitude": 28.6139, "longitude": 77.2090},
      "level": 6
    },
    {
      "digipinCode": "3F89TM",
      "center": {"latitude": 19.0760, "longitude": 72.8777},
      "level": 6
    }
  ]
}
```

---

### **2.4 GET /digipin/neighbors/:digipinCode**
Get neighboring DIGIPIN cells (same level).

**URL**: `/digipin/neighbors/2C45KL`

**Response**:
```json
{
  "center": "2C45KL",
  "level": 6,
  "neighbors": [
    "2C45KM",
    "2C45KP",
    "2C45KF",
    "2C45KT",
    "2C45K2",
    "2C45K3",
    "2C45K4",
    "2C45K5"
  ],
  "totalCount": 8,
  "note": "Grid cells have 8 neighbors (4x4 grid system)"
}
```

---

### **2.5 GET /digipin/nearby**
Find all DIGIPIN cells within a radius.

**Query Parameters**:
- `lat` (float, required) - Latitude
- `lng` (float, required) - Longitude
- `radius` (float, default: 5, max: 50) - Radius in km
- `level` (integer, default: 6, range: 1-8) - DIGIPIN level

**Example**: `/digipin/nearby?lat=28.6139&lng=77.2090&radius=5&level=6`

**Response**:
```json
{
  "center": {"latitude": 28.6139, "longitude": 77.2090},
  "radius": 5,
  "radiusUnit": "km",
  "level": 6,
  "cells": [
    {
      "digipinCode": "2C45KL",
      "distance": 0,
      "pincodes": ["110001"],
      "center": {"latitude": 28.6139, "longitude": 77.2090}
    },
    {
      "digipinCode": "2C45KM",
      "distance": 1.2,
      "pincodes": ["110002"],
      "center": {"latitude": 28.6150, "longitude": 77.2100}
    }
  ],
  "totalCells": 12,
  "uniquePincodes": 8
}
```

---

## 🔶 Track 3: H3 Spatial Index Operations

Endpoints for Uber H3 hexagonal spatial indexing (our internal spatial index).

---

### **3.1 GET /h3/:h3Index**
Get detailed information about an H3 hexagon.

**URL**: `/h3/89283082803ffff`

**Response**:
```json
{
  "h3Index": "89283082803ffff",
  "resolution": 9,
  "center": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "boundary": {
    "type": "Polygon",
    "coordinates": [
      [
        [77.2085, 28.6142],
        [77.2095, 28.6142],
        [77.2100, 28.6137],
        [77.2095, 28.6132],
        [77.2085, 28.6132],
        [77.2080, 28.6137],
        [77.2085, 28.6142]
      ]
    ]
  },
  "area": {
    "value": 0.105,
    "unit": "km²"
  },
  "pincodes": ["110001", "110002"],
  "pincodeCount": 2,
  "metadata": {
    "edgeLength": {
      "average": 0.174,
      "unit": "km"
    },
    "isPentagon": false
  }
}
```

---

### **3.2 POST /h3/encode**
Convert coordinates to H3 indexes.

**Request Body**:
```json
{
  "coordinates": [
    {"latitude": 28.6139, "longitude": 77.2090},
    {"latitude": 19.0760, "longitude": 72.8777}
  ],
  "resolution": 9
}
```

**Response**:
```json
{
  "resolution": 9,
  "results": [
    {
      "input": {"latitude": 28.6139, "longitude": 77.2090},
      "h3Index": "89283082803ffff",
      "pincodes": ["110001"]
    },
    {
      "input": {"latitude": 19.0760, "longitude": 72.8777},
      "h3Index": "8928308a4b7ffff",
      "pincodes": ["400001", "400002"]
    }
  ]
}
```

---

### **3.3 POST /h3/decode**
Convert H3 indexes to center coordinates.

**Request Body**:
```json
{
  "h3Indexes": ["89283082803ffff", "8928308a4b7ffff"]
}
```

**Response**:
```json
{
  "results": [
    {
      "h3Index": "89283082803ffff",
      "center": {"latitude": 28.6139, "longitude": 77.2090},
      "resolution": 9,
      "pincodes": ["110001"]
    },
    {
      "h3Index": "8928308a4b7ffff",
      "center": {"latitude": 19.0760, "longitude": 72.8777},
      "resolution": 9,
      "pincodes": ["400001", "400002"]
    }
  ]
}
```

---

### **3.4 GET /h3/neighbors/:h3Index**
Get neighboring H3 cells (k-ring).

**URL**: `/h3/neighbors/89283082803ffff?k=1`

**Query Parameters**:
- `k` (integer, default: 1, max: 5) - Ring distance

**Response**:
```json
{
  "center": "89283082803ffff",
  "k": 1,
  "neighbors": [
    "89283082807ffff",
    "8928308280bffff",
    "8928308280fffff",
    "89283082813ffff",
    "89283082817ffff",
    "8928308281bffff"
  ],
  "totalCount": 6,
  "totalWithCenter": 7
}
```

---

### **3.5 GET /h3/nearby**
Find all H3 cells within a radius.

**Query Parameters**:
- `lat` (float, required) - Latitude
- `lng` (float, required) - Longitude
- `radius` (float, default: 5, max: 50) - Radius in km
- `resolution` (integer, default: 9, range: 6-12) - H3 resolution

**Example**: `/h3/nearby?lat=28.6139&lng=77.2090&radius=5&resolution=9`

**Response**:
```json
{
  "center": {"latitude": 28.6139, "longitude": 77.2090},
  "radius": 5,
  "radiusUnit": "km",
  "resolution": 9,
  "hexagons": [
    {
      "h3Index": "89283082803ffff",
      "distance": 0,
      "pincodes": ["110001"],
      "center": {"latitude": 28.6139, "longitude": 77.2090}
    }
  ],
  "totalHexagons": 127,
  "uniquePincodes": 23
}
```

---

## 🔀 Track 4: Hybrid & Conversion Operations

High-performance bidirectional conversion between Pincodes, DIGIPINs, and H3 indexes.

---

### **4.1 GET /convert/pincode-to-h3/:pincode**
Convert pincode to all intersecting H3 cells.

**URL**: `/convert/pincode-to-h3/110001?resolution=9`

**Query Parameters**:
- `resolution` (integer, default: 9, range: 6-12) - H3 resolution

**Response**:
```json
{
  "pincode": "110001",
  "resolution": 9,
  "h3Indexes": [
    "89283082803ffff",
    "89283082807ffff"
  ],
  "totalHexagons": 2,
  "coverage": {
    "pincodeArea": 23.5,
    "hexagonsCoverage": 0.21,
    "areaUnit": "km²"
  },
  "primaryHexagon": "89283082803ffff",
  "pincodeCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

---

### **4.2 GET /convert/h3-to-pincode/:h3Index**
Convert H3 cell to all intersecting pincodes.

**URL**: `/convert/h3-to-pincode/89283082803ffff`

**Response**:
```json
{
  "h3Index": "89283082803ffff",
  "resolution": 9,
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "district": "Central Delhi",
      "state": "Delhi",
      "isPrimary": true,
      "overlapPercentage": 75.5
    },
    {
      "pincode": "110002",
      "officeName": "Indraprastha Estate",
      "district": "Central Delhi",
      "state": "Delhi",
      "isPrimary": false,
      "overlapPercentage": 24.5
    }
  ],
  "primaryPincode": "110001",
  "hexagonCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

---

### **4.3 GET /convert/pincode-to-digipin/:pincode**
Convert pincode to DIGIPIN code(s).

**URL**: `/convert/pincode-to-digipin/110001?level=6`

**Query Parameters**:
- `level` (integer, default: 6, range: 1-8) - DIGIPIN level

**Response**:
```json
{
  "pincode": "110001",
  "level": 6,
  "digipinCodes": [
    "2C45KL",
    "2C45KM"
  ],
  "totalCells": 2,
  "coverage": {
    "pincodeArea": 23.5,
    "digipinCoverage": 2.4,
    "areaUnit": "km²"
  },
  "primaryDigipin": "2C45KL",
  "pincodeCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

---

### **4.4 GET /convert/digipin-to-pincode/:digipinCode**
Convert DIGIPIN cell to all intersecting pincodes.

**URL**: `/convert/digipin-to-pincode/2C45KL`

**Response**:
```json
{
  "digipinCode": "2C45KL",
  "level": 6,
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "district": "Central Delhi",
      "state": "Delhi",
      "isPrimary": true,
      "overlapPercentage": 75.5
    },
    {
      "pincode": "110002",
      "officeName": "Indraprastha Estate",
      "district": "Central Delhi",
      "state": "Delhi",
      "isPrimary": false,
      "overlapPercentage": 24.5
    }
  ],
  "primaryPincode": "110001",
  "digipinCenter": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

---

### **4.5 GET /convert/h3-to-digipin/:h3Index**
Convert H3 cell to DIGIPIN code.

**URL**: `/convert/h3-to-digipin/89283082803ffff?level=6`

**Query Parameters**:
- `level` (integer, default: 6, range: 1-8) - DIGIPIN level

**Response**:
```json
{
  "h3Index": "89283082803ffff",
  "h3Resolution": 9,
  "digipinCode": "2C45KL",
  "digipinLevel": 6,
  "center": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}
```

---

### **4.6 GET /convert/digipin-to-h3/:digipinCode**
Convert DIGIPIN cell to H3 cells.

**URL**: `/convert/digipin-to-h3/2C45KL?resolution=9`

**Query Parameters**:
- `resolution` (integer, default: 9, range: 6-12) - H3 resolution

**Response**:
```json
{
  "digipinCode": "2C45KL",
  "digipinLevel": 6,
  "h3Resolution": 9,
  "h3Indexes": [
    "89283082803ffff",
    "89283082807ffff",
    "8928308280bffff"
  ],
  "totalHexagons": 3,
  "coverage": {
    "digipinArea": 1.2,
    "h3Coverage": 0.315,
    "areaUnit": "km²"
  }
}
```

---

### **4.7 POST /convert/bulk/pincode-to-h3**
Bulk convert pincodes to H3 (up to 50 pincodes).

**Request Body**:
```json
{
  "pincodes": ["110001", "400001", "560001"],
  "resolution": 9
}
```

**Response**:
```json
{
  "resolution": 9,
  "total": 3,
  "results": {
    "110001": {
      "h3Indexes": ["89283082803ffff", "89283082807ffff"],
      "totalHexagons": 2
    },
    "400001": {
      "h3Indexes": ["8928308a4b7ffff"],
      "totalHexagons": 1
    }
  }
}
```

---

### **4.8 POST /convert/bulk/h3-to-pincode**
Bulk convert H3 cells to pincodes (up to 100 cells).

**Request Body**:
```json
{
  "h3Indexes": ["89283082803ffff", "8928308a4b7ffff"]
}
```

---

### **4.9 GET /spatial/intersection**
Find spatial intersection between pincode and coordinate.

**Query Parameters**:
- `pincode` (string, required)
- `lat` (float, required)
- `lng` (float, required)

**Example**: `/spatial/intersection?pincode=110001&lat=28.6139&lng=77.2090`

**Response**:
```json
{
  "pincode": "110001",
  "coordinates": {"latitude": 28.6139, "longitude": 77.2090},
  "isInside": true,
  "h3Index": "89283082803ffff",
  "distance": {
    "toPincodeCenter": 0.35,
    "unit": "km"
  },
  "nearestPostOffice": {
    "name": "Parliament House",
    "type": "SO",
    "distance": 0.35,
    "unit": "km"
  }
}
```

---

### **4.10 POST /spatial/polygon-search**
Find all pincodes within a custom polygon.

**Request Body**:
```json
{
  "polygon": {
    "type": "Polygon",
    "coordinates": [
      [[77.1, 28.5], [77.3, 28.5], [77.3, 28.7], [77.1, 28.7], [77.1, 28.5]]
    ]
  },
  "includeH3": true
}
```

**Response**:
```json
{
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "overlapPercentage": 100.0,
      "h3Indexes": ["89283082803ffff", "89283082807ffff"]
    }
  ],
  "totalPincodes": 15,
  "totalH3Cells": 234,
  "searchArea": {
    "value": 125.3,
    "unit": "km²"
  }
}
```

---

## 📏 Track 5: Distance & Measurement Operations

High-performance distance calculations between any spatial entities with automatic type detection.

---

### **5.1 POST /distance/calculate**
Universal distance calculator - supports any combination of pincodes, DIGIPIN codes, H3 indexes, or coordinates.

**Request Body**:
```json
{
  "from": {
    "pincode": "110001"
    // OR "digipin": "2C45KL6M8P"
    // OR "h3": "89283082803ffff"
    // OR "coordinate": {"lat": 28.6139, "lng": 77.2090}
  },
  "to": {
    "pincode": "400001"
    // OR "digipin": "3F89TMW4X2"
    // OR "h3": "8928308a4b7ffff"
    // OR "coordinate": {"lat": 19.0760, "lng": 72.8777}
  },
  "unit": "km",  // Optional: "km" (default), "mi", "m"
  "includeGridDistance": false  // Optional: for H3-to-H3 calculations only
}
```

**Example 1: Pincode to Pincode**
```json
{
  "from": {"pincode": "110001"},
  "to": {"pincode": "400001"},
  "unit": "km"
}
```

**Response**:
```json
{
  "from": {
    "type": "pincode",
    "pincode": "110001",
    "officeName": "Parliament House",
    "coordinates": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "to": {
    "type": "pincode",
    "pincode": "400001",
    "officeName": "Mumbai GPO",
    "coordinates": {
      "latitude": 18.9322,
      "longitude": 72.8264
    }
  },
  "distance": {
    "value": 1151.3,
    "unit": "km"
  },
  "method": "haversine"
}
```

**Example 2: Coordinate to H3**
```json
{
  "from": {"coordinate": {"lat": 28.6139, "lng": 77.2090}},
  "to": {"h3": "8928308a4b7ffff"}
}
```

**Response**:
```json
{
  "from": {
    "type": "coordinate",
    "coordinates": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "to": {
    "type": "h3",
    "h3Index": "8928308a4b7ffff",
    "resolution": 9,
    "center": {
      "latitude": 19.0760,
      "longitude": 72.8777
    }
  },
  "distance": {
    "value": 1151.3,
    "unit": "km"
  },
  "method": "haversine"
}
```

**Example 3: DIGIPIN to DIGIPIN**
```json
{
  "from": {"digipin": "2C45KL6M8P"},
  "to": {"digipin": "3F89TMW4X2"}
}
```

**Response**:
```json
{
  "from": {
    "type": "digipin",
    "digipinCode": "2C45KL6M8P",
    "level": 10,
    "center": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "to": {
    "type": "digipin",
    "digipinCode": "3F89TMW4X2",
    "level": 10,
    "center": {
      "latitude": 19.0760,
      "longitude": 72.8777
    }
  },
  "distance": {
    "value": 1151.3,
    "unit": "km"
  },
  "method": "haversine"
}
```

**Example 4: H3 to H3 with Grid Distance**
```json
{
  "from": {"h3": "89283082803ffff"},
  "to": {"h3": "8928308a4b7ffff"},
  "includeGridDistance": true
}
```

**Response**:
```json
{
  "from": {
    "type": "h3",
    "h3Index": "89283082803ffff",
    "resolution": 9,
    "center": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "to": {
    "type": "h3",
    "h3Index": "8928308a4b7ffff",
    "resolution": 9,
    "center": {
      "latitude": 19.0760,
      "longitude": 72.8777
    }
  },
  "distance": {
    "value": 1151.3,
    "unit": "km"
  },
  "gridDistance": 6542,
  "method": "haversine",
  "note": "Grid distance is the number of H3 cells between the two points"
}
```

**Performance**:
- Coordinate ↔ Coordinate: ~0.1ms
- DIGIPIN ↔ Any: ~0.5-5ms
- H3 ↔ Any: ~1-5ms
- Pincode ↔ Any: ~2-10ms (depends on cache hit)

**Validation Rules**:
- Each location object must have exactly ONE property: `pincode`, `digipin`, `h3`, or `coordinate`
- Coordinates must have both `lat` and `lng`
- `includeGridDistance` only applicable when both `from` and `to` are H3 indexes

---

### **5.2 POST /distance/batch**
Calculate distances for multiple location pairs (up to 100).

**Request Body**:
```json
{
  "pairs": [
    {
      "from": {"pincode": "110001"},
      "to": {"pincode": "400001"}
    },
    {
      "from": {"coordinate": {"lat": 28.6139, "lng": 77.2090}},
      "to": {"coordinate": {"lat": 19.0760, "lng": 72.8777}}
    },
    {
      "from": {"h3": "89283082803ffff"},
      "to": {"digipin": "3F89TMW4X2"}
    }
  ],
  "unit": "km"
}
```

**Response**:
```json
{
  "total": 3,
  "unit": "km",
  "results": [
    {
      "from": {"type": "pincode", "pincode": "110001"},
      "to": {"type": "pincode", "pincode": "400001"},
      "distance": 1151.3
    },
    {
      "from": {"type": "coordinate", "coordinates": {"lat": 28.6139, "lng": 77.2090}},
      "to": {"type": "coordinate", "coordinates": {"lat": 19.0760, "lng": 72.8777}},
      "distance": 1151.3
    },
    {
      "from": {"type": "h3", "h3Index": "89283082803ffff"},
      "to": {"type": "digipin", "digipinCode": "3F89TMW4X2"},
      "distance": 523.7
    }
  ]
}
```

**Performance**: ~5-100ms depending on pair count, types, and cache hits

---

## 🌟 Track 6: Advanced Endpoints (Future Phases)

### **6.1 GET /geocoding/forward** (Address → Coordinates + Pincode)
### **6.2 GET /geocoding/reverse** (Coordinates → Address)
### **6.3 GET /autocomplete** (Address search suggestions)
### **6.4 GET /serviceability** (Check delivery serviceability)
### **6.5 GET /route** (Calculate route between pincodes)

---

## 📊 Performance Targets

| Endpoint Type | Target Latency | Cache Strategy |
|---------------|----------------|----------------|
| Pincode Lookup | < 10ms | Redis (1 hour TTL) |
| H3 Operations | < 5ms | Redis (permanent) |
| Distance (Coordinates) | < 1ms | Pure calculation |
| Distance (DIGIPIN/H3) | < 5ms | Decode + haversine |
| Distance (Pincode) | < 10ms | Cache + haversine |
| Bulk Operations | < 50ms | Batch processing |
| Spatial Search | < 100ms | Spatial index |
| Polygon Search | < 200ms | H3 polyfill |

---

## ✅ Implementation Alignment

All endpoints designed to work with:
- ✅ **ApiKeyGuard** - Automatic authentication
- ✅ **RateLimitInterceptor** - Tier-based throttling
- ✅ **UsageTrackingInterceptor** - Analytics
- ✅ **Decoupled Identity** - No customer entity in API
- ✅ **Dual-Redis** - Persistent H3 + ephemeral cache

---

**Next Step**: Prioritize Track 1 (Pincode Solo) for Phase 6 implementation.