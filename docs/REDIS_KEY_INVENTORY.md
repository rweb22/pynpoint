# Redis Key Inventory

**Last Updated:** 2026-06-29  
**Purpose:** Complete inventory of all Redis keys created by PincodeCacheService

---

## 📊 **Expected Key Count**

### **Total Expected Keys: ~40,740**

| Category | Key Pattern | Count | Type | Description |
|----------|-------------|-------|------|-------------|
| **Pincode Data** | `pincode:{code}` | ~19,000 | HASH | Individual pincode details |
| **Post Offices** | `postoffices:{code}` | ~19,000 | LIST | Post offices grouped by pincode |
| **State Indexes** | `state:index:{state}` | ~37 | ZSET | Pincodes by state |
| **State Counts** | `count:state:{state}` | ~37 | STRING | Count cache for state |
| **District Indexes** | `district:index:{state}:{district}` | ~700 | ZSET | Pincodes by state+district |
| **District Counts** | `count:district:{state}:{district}` | ~700 | STRING | Count cache for district |
| **All Pincodes** | `pincodes:all` | 1 | ZSET | All active pincodes |
| **All Count** | `count:all` | 1 | STRING | Total pincode count |
| **Geospatial Index** | `geo:pincodes` | 1 | ZSET (geo) | Centroid locations for GEORADIUS |
| **State Metadata** | `states:meta` | 1 | HASH | State names and counts |
| **District Metadata** | `districts:meta` | 1 | HASH | District names and counts |
| **Cache Status** | `cache:pincode:loaded` | 1 | STRING | Initialization flag |
| **TOTAL** | | **~40,740** | | |

---

## 🔍 **Key Breakdown by Category**

### **1. Core Data (38,000 keys)**

#### **Pincode HASHes** - `pincode:{code}` (~19,000 keys)
```redis
HGETALL pincode:110001
```
**Fields:**
- `id` - Database ID
- `pincode` - 6-digit code
- `office_name` - Main post office name
- `state` - State name (normalized)
- `district` - District name (normalized)
- `city` - City (always empty, kept for completeness)
- `region` - Postal region
- `circle` - Postal circle
- `centroid_lat` - Geometric center latitude
- `centroid_lng` - Geometric center longitude
- `office_lat` - Physical office latitude (HO > SO > BO)
- `office_lng` - Physical office longitude
- `office_type` - Office type that provided coordinates (HO/SO/BO)
- `is_active` - Active status
- `post_office_count` - Number of post offices

**Memory:** ~10 MB

---

#### **Post Office LISTs** - `postoffices:{code}` (~19,000 keys)
```redis
LRANGE postoffices:110001 0 -1
```
**Each entry is JSON:**
```json
{
  "id": 12345,
  "officename": "Connaught Place H.O",
  "area": "Connaught Place",
  "officetype": "HO",
  "delivery": "delivery",
  "district": "Central Delhi",
  "state": "Delhi",
  "division": "New Delhi Central",
  "region": "Delhi Region",
  "circle": "Delhi Circle",
  "latitude": 28.6139,
  "longitude": 77.2090
}
```

**Memory:** ~30 MB

---

### **2. Search Indexes (1,476 keys)**

#### **State Indexes** - `state:index:{state}` (~37 keys)
```redis
ZRANGE state:index:delhi 0 -1
# Returns: ["110001", "110002", ..., "110096"]
```
- **Type:** ZSET (Sorted Set)
- **Score:** Pincode number (for natural sorting)
- **Members:** Pincode strings
- **Count Keys:** `count:state:{state}` (~37 keys)

**Memory:** ~2 MB

---

#### **District Indexes** - `district:index:{state}:{district}` (~700 keys)
```redis
ZRANGE district:index:delhi:central-delhi 0 -1
# Returns: ["110001", "110003", "110005", ...]
```
- **Type:** ZSET (Sorted Set)
- **Score:** Pincode number
- **Members:** Pincode strings
- **Count Keys:** `count:district:{state}:{district}` (~700 keys)

**Memory:** ~5 MB

---

### **3. Global Indexes (2 keys)**

#### **All Pincodes** - `pincodes:all` (1 key)
```redis
ZRANGE pincodes:all 0 -1
# Returns all 19,000 pincodes sorted by pincode number
```
- **Type:** ZSET
- **Score:** Pincode number
- **Members:** All active pincodes
- **Count Key:** `count:all` (1 key)

**Memory:** ~1 MB

---

### **4. Geospatial Index (1 key)**

#### **Geo Index** - `geo:pincodes` (1 key)
```redis
GEORADIUS geo:pincodes 77.2090 28.6139 50 km WITHDIST COUNT 10
# Returns pincodes within 50km of coordinates
```
- **Type:** ZSET (geospatial)
- **Members:** Pincode strings
- **Geohash:** Redis automatically stores geohash for each point
- **Used For:** Nearby pincode queries

**Memory:** ~3 MB

---

### **5. Metadata (2 keys)**

#### **States Metadata** - `states:meta` (1 key)
```redis
HGETALL states:meta
# Returns: {
#   "delhi": "{\"name\":\"Delhi\",\"pincodeCount\":5234}",
#   "maharashtra": "{\"name\":\"Maharashtra\",\"pincodeCount\":7821}",
#   ...
# }
```
- **Type:** HASH
- **Fields:** ~37 (one per state)
- **Values:** JSON strings with state metadata

---

#### **Districts Metadata** - `districts:meta` (1 key)
```redis
HGETALL districts:meta
# Returns: {
#   "delhi:central-delhi": "{\"name\":\"Central Delhi\",\"state\":\"Delhi\",\"pincodeCount\":842}",
#   ...
# }
```
- **Type:** HASH
- **Fields:** ~700 (one per district)
- **Values:** JSON strings with district metadata

**Combined Memory:** ~100 KB

---

### **6. Control Keys (1 key)**

#### **Cache Loaded Flag** - `cache:pincode:loaded` (1 key)
```redis
GET cache:pincode:loaded
# Returns: "true"
```
- **Type:** STRING
- **Value:** "true" when cache is fully loaded
- **TTL:** No expiration (persistent)
- **Purpose:** Prevents duplicate initialization

---

## 📈 **Memory Usage Summary**

| Component | Keys | Memory |
|-----------|------|--------|
| Pincode HASHes | 19,000 | ~10 MB |
| Post Office LISTs | 19,000 | ~30 MB |
| State Indexes | 74 | ~2 MB |
| District Indexes | 1,400 | ~5 MB |
| Global Indexes | 2 | ~1 MB |
| Geospatial Index | 1 | ~3 MB |
| Metadata | 2 | ~100 KB |
| Control | 1 | <1 KB |
| **TOTAL** | **~40,740** | **~51 MB** |

---

## 🔧 **Verification Commands**

### **Count all keys:**
```bash
redis-cli DBSIZE
# Expected: ~40,740
```

### **Count by pattern:**
```bash
redis-cli --scan --pattern "pincode:*" | wc -l
# Expected: ~19,000

redis-cli --scan --pattern "postoffices:*" | wc -l
# Expected: ~19,000

redis-cli --scan --pattern "state:index:*" | wc -l
# Expected: ~37

redis-cli --scan --pattern "district:index:*" | wc -l
# Expected: ~700
```

### **Check memory:**
```bash
redis-cli INFO memory | grep used_memory_human
# Expected: ~51 MB (plus Redis overhead)
```

### **Sample keys:**
```bash
# Get a random pincode
redis-cli HGETALL pincode:110001

# Get state list
redis-cli HKEYS states:meta

# Get district count
redis-cli HLEN districts:meta

# Check geospatial
redis-cli ZCARD geo:pincodes
```

---

## ✅ **After Cache Initialization**

You should see logs like:
```
[PincodeCacheService] 📦 Loading pincodes into Redis...
[PincodeCacheService] Found 19042 pincodes to cache
[PincodeCacheService] ✅ Cached 19042 pincodes (18234 with office coords, 808 centroid-only)
[PincodeCacheService] 📦 Loading post offices into Redis...
[PincodeCacheService] Found 165627 post offices to cache
[PincodeCacheService] ✅ Cached 165627 post offices across 19042 pincodes
[PincodeCacheService] 📦 Building search indexes...
[PincodeCacheService] ✅ Built indexes: 37 states, 700 districts
[PincodeCacheService] 📦 Building geospatial index...
[PincodeCacheService] ✅ Built geospatial index with 19042 centroids
[PincodeCacheService] ✅ Pincode cache initialization complete (8.43s)
```

---

## 📋 **Key Naming Conventions**

- **Singular entities:** `pincode:{code}`, `postoffices:{code}`
- **Indexes:** `{entity}:index:{filter}`
- **Counts:** `count:{scope}:{filter}`
- **Metadata:** `{entities}:meta`
- **Geospatial:** `geo:{entity}`
- **Control:** `cache:{service}:{flag}`
- **Normalization:** Lowercase, hyphens, no spaces
