# Complete Redis Persistent Cache Mappings

**Last Updated:** 2026-06-29  
**Purpose:** Document ALL Redis data structures for O(1) lookups

---

## 📊 **Complete Redis Schema**

### **Category 1: Core Data (19k entries)**

#### **1.1 Pincode Details**
```redis
Key Pattern: pincode:{code}
Type: HASH
Count: ~19,000
Example: pincode:110001

Fields:
  pincode: "110001"
  office_name: "Connaught Place H.O"
  office_type: "HO"
  delivery_status: "Delivery"
  division_name: "New Delhi Central"
  region_name: "Delhi Region"
  circle_name: "Delhi Circle"
  taluk: "New Delhi"
  district: "Central Delhi"
  state: "Delhi"
  country: "India"
  city: "New Delhi"
  centroid_lat: "28.6139"
  centroid_lng: "77.2090"
  post_office_count: "5"
  is_active: "true"

Access Time: O(1) - HGETALL
Use Case: GET /pincodes/:pincode
```

#### **1.2 Post Offices**
```redis
Key Pattern: postoffices:{pincode}
Type: LIST
Count: ~19,000 lists (~150k total post offices)
Example: postoffices:110001

Value: [JSON, JSON, JSON, ...]
Each JSON:
  {
    "id": 12345,
    "officename": "Connaught Place H.O",
    "area": "Connaught Place",
    "officetype": "HO",
    "delivery": "Delivery",
    "district": "Central Delhi",
    "state": "Delhi",
    "division": "New Delhi Central",
    "region": "Delhi Region",
    "circle": "Delhi Circle",
    "latitude": 28.6139,
    "longitude": 77.2090
  }

Access Time: O(N) where N = post offices in pincode (typically 1-10)
Use Case: GET /pincodes/:pincode?includePostOffices=true
```

---

### **Category 2: Search Indexes (ZSETs for pagination)**

#### **2.1 All Pincodes**
```redis
Key: pincodes:all
Type: SORTED SET (ZSET)
Count: ~19,000 members
Score: Pincode number (for natural sorting)

Example:
  ZRANGE pincodes:all 0 24  → First 25 pincodes
  ZCARD pincodes:all → Total count

Access Time: O(log N + M) where M = page size
Use Case: GET /pincodes (no filters)
```

#### **2.2 State Indexes**
```redis
Key Pattern: state:index:{state}
Type: SORTED SET (ZSET)
Count: ~37 keys (one per state)
Score: Pincode number

Example: state:index:delhi
Members: {110001: 110001, 110002: 110002, ..., 110096: 110096}

Example queries:
  ZRANGE state:index:delhi 0 24  → First 25 pincodes in Delhi
  ZCARD state:index:delhi → Total pincodes in Delhi

Access Time: O(log N + M)
Use Case: GET /pincodes?state=Delhi
```

#### **2.3 District Indexes**
```redis
Key Pattern: district:index:{state}:{district}
Type: SORTED SET (ZSET)
Count: ~700 keys (one per district)
Score: Pincode number

Example: district:index:delhi:central-delhi
Members: {110001: 110001, 110055: 110055, ...}

Note: Key uses normalized format (lowercase, hyphens)
  "Central Delhi" → "central-delhi"

Access Time: O(log N + M)
Use Case: GET /pincodes?state=Delhi&district=Central+Delhi
```

#### **2.4 City Indexes**
```redis
Key Pattern: city:index:{city}
Type: SORTED SET (ZSET)
Count: ~4,000 keys (one per city)
Score: Pincode number

Example: city:index:new-delhi
Members: {110001: 110001, 110011: 110011, ...}

Access Time: O(log N + M)
Use Case: GET /pincodes?city=New+Delhi
```

---

### **Category 3: Multi-Criteria Lookup Tables**

#### **3.1 State + City Combinations**
```redis
Key Pattern: lookup:state-city:{state}:{city}
Type: SORTED SET (ZSET)
Count: ~5,000 keys (pre-computed combinations)
Score: Pincode number

Example: lookup:state-city:delhi:new-delhi
Members: {110001: 110001, 110011: 110011, ...}

Purpose: Avoid client-side SET intersection
Access Time: O(log N + M)
Use Case: GET /pincodes?state=Delhi&city=New+Delhi
```

#### **3.2 District + City Combinations**
```redis
Key Pattern: lookup:district-city:{state}:{district}:{city}
Type: SORTED SET (ZSET)
Count: ~5,000 keys (pre-computed combinations)
Score: Pincode number

Example: lookup:district-city:delhi:central-delhi:new-delhi
Members: {110001: 110001, ...}

Access Time: O(log N + M)
Use Case: GET /pincodes?state=Delhi&district=Central+Delhi&city=New+Delhi
```

---

### **Category 4: Count Caches (Instant Totals)**

#### **4.1 Total Count**
```redis
Key: count:all
Type: STRING
Value: "19042"

Access Time: O(1)
Use Case: Pagination metadata
```

#### **4.2 State Counts**
```redis
Key Pattern: count:state:{state}
Type: STRING
Count: ~37 keys

Example: count:state:delhi
Value: "5234"

Access Time: O(1)
```

#### **4.3 District Counts**
```redis
Key Pattern: count:district:{state}:{district}
Type: STRING
Count: ~700 keys

Example: count:district:delhi:central-delhi
Value: "842"

Access Time: O(1)
```

#### **4.4 City Counts**
```redis
Key Pattern: count:city:{city}
Type: STRING
Count: ~4,000 keys

Example: count:city:new-delhi
Value: "1205"

Access Time: O(1)
```

#### **4.5 Multi-Criteria Counts**
```redis
Key Pattern: count:state-city:{state}:{city}
Key Pattern: count:district-city:{state}:{district}:{city}
Type: STRING
Count: ~10,000 keys total

Example: count:state-city:delhi:new-delhi
Value: "842"

Access Time: O(1)
```

---

### **Category 5: Geospatial Index**

#### **5.1 Pincode Centroids**
```redis
Key: geo:pincodes
Type: GEOSPATIAL
Count: ~19,000 members
Encoding: Geohash (52-bit integer)

Members: Each pincode with its centroid coordinates
Example: GEOADD geo:pincodes 77.2090 28.6139 110001

Commands:
  GEORADIUS geo:pincodes 77.2090 28.6139 5 km WITHDIST ASC COUNT 10
  → Returns 10 nearest pincodes with distances

  GEODIST geo:pincodes 110001 110002 km
  → Distance between two pincodes

Access Time: O(log N + M) where M = results
Use Case: GET /pincodes/:pincode/nearby
```

---

### **Category 6: Administrative Metadata**

#### **6.1 States Metadata**
```redis
Key: states:meta
Type: HASH
Count: ~37 fields

Fields (JSON values):
  delhi: {"name": "Delhi", "pincodeCount": 5234}
  maharashtra: {"name": "Maharashtra", "pincodeCount": 7821}
  ...

Access Time: O(1) for HGETALL, O(1) for HGET
Use Case: GET /administrative/states
```

#### **6.2 Districts Metadata**
```redis
Key: districts:meta
Type: HASH
Count: ~700 fields

Fields (JSON values):
  delhi:central-delhi: {"name": "Central Delhi", "state": "Delhi", "pincodeCount": 842}
  maharashtra:mumbai: {"name": "Mumbai", "state": "Maharashtra", "pincodeCount": 1205}
  ...

Access Time: O(1) for HGETALL, O(1) for HGET
Use Case: GET /administrative/districts
```

#### **6.3 Cities Metadata**
```redis
Key: cities:meta
Type: HASH
Count: ~4,000 fields

Fields (JSON values):
  new-delhi: {"name": "New Delhi", "pincodeCount": 842}
  mumbai: {"name": "Mumbai", "pincodeCount": 1205}
  ...

Access Time: O(1) for HGETALL, O(1) for HGET
Use Case: Future city-based queries
```

---

## 📈 **Summary Statistics**

| Category | Data Type | Count | Memory |
|----------|-----------|-------|--------|
| Pincode HASHes | HASH | 19,000 | ~10 MB |
| Post Office LISTs | LIST | 19,000 | ~30 MB |
| Search Indexes (ZSETs) | ZSET | ~4,737 | ~38 MB |
| Multi-Criteria Lookups | ZSET | ~10,000 | ~30 MB |
| Count Caches | STRING | ~15,000 | ~150 KB |
| Geospatial Index | GEOSPATIAL | 1 (19k members) | ~3 MB |
| Administrative HASHes | HASH | 3 (multi-field) | ~100 KB |
| **TOTAL** | | **~67,740 keys** | **~111 MB** |

---

## 🔍 **Key Normalization Rules**

All filter-based keys use consistent normalization:
- **Lowercase:** "Central Delhi" → "central delhi"
- **Trim whitespace:** " Delhi " → "delhi"
- **Replace spaces with hyphens:** "central delhi" → "central-delhi"

Example transformations:
- "Andaman and Nicobar" → "andaman-and-nicobar"
- "Central Delhi" → "central-delhi"
- "New Delhi" → "new-delhi"

---

## ⚡ **Access Patterns**

### **Pattern 1: Direct Lookup (O(1))**
```typescript
// Get pincode details
await redis.hgetall('pincode:110001');  // O(1)
```

### **Pattern 2: Filtered + Paginated (O(log N + M))**
```typescript
// Get pincodes in Delhi, page 1 (25 items)
await redis.zrange('state:index:delhi', 0, 24);  // O(log N + 25)
```

### **Pattern 3: Count Only (O(1))**
```typescript
// Get total pincodes in Delhi
await redis.get('count:state:delhi');  // O(1)
```

### **Pattern 4: Geospatial Query (O(log N + M))**
```typescript
// Find 10 pincodes within 5km
await redis.georadius('geo:pincodes', 77.209, 28.614, 5, 'km', 'WITHDIST', 'ASC', 'COUNT', 10);
```

### **Pattern 5: Administrative Metadata (O(1))**
```typescript
// Get all states
await redis.hgetall('states:meta');  // O(N) where N = 37 states
```

---

**Total Keys:** ~67,740  
**Total Memory:** ~111 MB  
**All lookups:** O(1) to O(log N + M) — effectively constant time!
