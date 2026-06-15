# API Endpoints Brainstorming

**Purpose**: Define all public API endpoints for PinPoint India  
**Date**: 2026-06-14  
**Status**: Draft - Brainstorming Phase

---

## 🎯 Core Data Available

From your spatial database, we have:
1. **Pincode Data** (CSV ingested)
   - Pincode (6 digits)
   - Office Name
   - Office Type (BO, SO, HO)
   - Delivery Status
   - Division Name
   - Region Name
   - Circle Name
   - Taluk
   - District Name
   - State Name
   - Telephone
   - Related Suboffice
   - Related Headoffice
   - Longitude
   - Latitude

2. **H3 Spatial Index** (32.5M hexagons at Resolution 9)
   - Hexagon ID
   - Associated pincodes (spatial containment)
   - ~340m average edge length per hexagon

3. **Administrative Boundaries** (GeoJSON)
   - States
   - Districts
   - Possibly more granular levels

---

## 💡 Proposed API Endpoints

### **1. Pincode Operations**

#### **GET /api/v1/pincodes/:pincode**
Get detailed information about a specific pincode.

**Example**: `GET /api/v1/pincodes/110001`

**Response**:
```json
{
  "pincode": "110001",
  "officeName": "Parliament House",
  "officeType": "SO",
  "deliveryStatus": "Delivery",
  "district": "Central Delhi",
  "state": "Delhi",
  "division": "New Delhi Central",
  "region": "Delhi",
  "circle": "Delhi",
  "taluk": "New Delhi",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "relatedHeadoffice": "New Delhi GPO",
  "h3Indexes": ["89283082803ffff", "89283082807ffff"]
}
```

#### **GET /api/v1/pincodes**
Search/filter pincodes with query parameters.

**Query Params**:
- `state` - Filter by state name
- `district` - Filter by district name
- `city` - Filter by city/division
- `officeType` - Filter by office type (BO, SO, HO)
- `deliveryStatus` - Filter by delivery status
- `limit` - Max results (default: 50, max: 1000)
- `offset` - Pagination offset

**Example**: `GET /api/v1/pincodes?state=Delhi&officeType=SO&limit=10`

**Response**:
```json
{
  "total": 245,
  "limit": 10,
  "offset": 0,
  "results": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "state": "Delhi",
      "district": "Central Delhi",
      ...
    }
  ]
}
```

---

### **2. Geocoding / Reverse Geocoding**

#### **GET /api/v1/geocode/forward**
Convert address/place to coordinates and pincode.

**Query Params**:
- `address` - Full or partial address
- `city` - City name
- `state` - State name

**Example**: `GET /api/v1/geocode/forward?address=Connaught Place&city=Delhi`

**Response**:
```json
{
  "query": "Connaught Place, Delhi",
  "results": [
    {
      "pincode": "110001",
      "coordinates": {
        "lat": 28.6304,
        "lng": 77.2177
      },
      "officeName": "Connaught Place",
      "district": "Central Delhi",
      "state": "Delhi",
      "confidence": 0.95
    }
  ]
}
```

#### **GET /api/v1/geocode/reverse**
Find pincode from coordinates.

**Query Params**:
- `lat` - Latitude (required)
- `lng` - Longitude (required)
- `radius` - Search radius in km (default: 5, max: 50)

**Example**: `GET /api/v1/geocode/reverse?lat=28.6139&lng=77.2090&radius=5`

**Response**:
```json
{
  "coordinates": {
    "lat": 28.6139,
    "lng": 77.2090
  },
  "nearestPincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "distance": 0.35,
      "distanceUnit": "km",
      "coordinates": {
        "lat": 28.6139,
        "lng": 77.2090
      }
    }
  ]
}
```

---

### **3. Spatial Search (H3-Powered)**

#### **GET /api/v1/spatial/hexagon/:h3Index**
Get information about a specific H3 hexagon.

**Example**: `GET /api/v1/spatial/hexagon/89283082803ffff`

**Response**:
```json
{
  "h3Index": "89283082803ffff",
  "resolution": 9,
  "center": {
    "lat": 28.6139,
    "lng": 77.2090
  },
  "boundary": {
    "type": "Polygon",
    "coordinates": [[[77.209, 28.614], ...]]
  },
  "pincodes": ["110001", "110002"],
  "area": {
    "value": 0.105,
    "unit": "km²"
  }
}
```

#### **GET /api/v1/spatial/nearby**
Find pincodes near coordinates using H3 spatial index.

**Query Params**:
- `lat` - Latitude (required)
- `lng` - Longitude (required)
- `distance` - Distance in km (default: 5, max: 50)
- `resolution` - H3 resolution (default: 9, range: 6-10)

**Example**: `GET /api/v1/spatial/nearby?lat=28.6139&lng=77.2090&distance=10`

**Response**:
```json
{
  "center": {"lat": 28.6139, "lng": 77.2090},
  "searchRadius": 10,
  "searchRadiusUnit": "km",
  "hexagonsSearched": 127,
  "pincodes": [
    {
      "pincode": "110001",
      "officeName": "Parliament House",
      "distance": 0.35,
      "h3Indexes": ["89283082803ffff"]
    }
  ]
}
```

---

### **4. Administrative Boundaries**

#### **GET /api/v1/boundaries/states**
List all states with metadata.

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
      "districtCount": 11
    }
  ]
}
```

#### **GET /api/v1/boundaries/states/:stateCode**
Get detailed state information.

**Example**: `GET /api/v1/boundaries/states/DL`

**Response**:
```json
{
  "name": "Delhi",
  "code": "DL",
  "capital": "New Delhi",
  "geometry": {
    "type": "MultiPolygon",
    "coordinates": [...]
  },
  "districts": ["Central Delhi", "North Delhi", ...],
  "pincodeRange": ["110001", "110096"],
  "statistics": {
    "totalPincodes": 245,
    "totalDistricts": 11,
    "area": 1484,
    "areaUnit": "km²"
  }
}
```

#### **GET /api/v1/boundaries/districts**
List districts with optional state filter.

**Query Params**:
- `state` - Filter by state code or name

**Example**: `GET /api/v1/boundaries/districts?state=DL`

#### **GET /api/v1/boundaries/districts/:districtId**
Get detailed district information with geometry.

---

### **5. Bulk Operations**

#### **POST /api/v1/pincodes/bulk/lookup**
Lookup multiple pincodes in one request.

**Request Body**:
```json
{
  "pincodes": ["110001", "400001", "560001", "700001"]
}
```

**Response**:
```json
{
  "total": 4,
  "found": 4,
  "notFound": [],
  "results": {
    "110001": {...},
    "400001": {...},
    ...
  }
}
```

#### **POST /api/v1/geocode/bulk/reverse**
Reverse geocode multiple coordinates.

**Request Body**:
```json
{
  "coordinates": [
    {"lat": 28.6139, "lng": 77.2090},
    {"lat": 19.0760, "lng": 72.8777}
  ]
}
```

---

### **6. Distance & Route (Future)**

#### **GET /api/v1/distance**
Calculate distance between two pincodes.

**Query Params**:
- `from` - Starting pincode
- `to` - Destination pincode
- `unit` - Distance unit (km, miles)

**Example**: `GET /api/v1/distance?from=110001&to=400001&unit=km`

**Response**:
```json
{
  "from": "110001",
  "to": "400001",
  "straightLine": {
    "distance": 1151.3,
    "unit": "km"
  }
}
```

---

### **7. Statistics & Analytics (Future)**

#### **GET /api/v1/stats/coverage**
Get API coverage statistics.

**Response**:
```json
{
  "totalPincodes": 154725,
  "totalStates": 36,
  "totalDistricts": 640,
  "h3IndexesGenerated": 32500000,
  "lastUpdated": "2024-06-14T00:00:00Z"
}
```

---

## 🤔 Questions to Consider

1. **Data Priority**: Which endpoints are most important for your use case?
2. **Autocomplete**: Do you need `/api/v1/autocomplete?q=Delhi` for search suggestions?
3. **Validation**: Do you need `/api/v1/validate/pincode/:pincode` (check if valid)?
4. **Historical Data**: Will pincodes change over time? Need versioning?
5. **Serviceability**: Do you need delivery serviceability checks?
6. **Polygon Search**: Search pincodes within a custom polygon boundary?
7. **Export**: Allow users to export data in CSV/GeoJSON format?

---

## 💭 Your Input Needed

Please provide feedback on:
1. Which endpoints are **MUST HAVE** for initial launch?
2. Which endpoints are **NICE TO HAVE** (can wait)?
3. Any **MISSING** endpoints you need?
4. Any **USE CASES** I haven't considered?

Let's discuss and prioritize! 🚀
