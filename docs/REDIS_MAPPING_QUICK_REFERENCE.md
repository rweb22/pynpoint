# Redis Mapping Quick Reference

**Quick lookup guide for all Redis keys**

---

## 📋 **All Redis Keys by Category**

### **1️⃣ Core Data**

| Key Pattern | Type | Count | Example | Use Case |
|-------------|------|-------|---------|----------|
| `pincode:{code}` | HASH | 19k | `pincode:110001` | Get pincode details |
| `postoffices:{code}` | LIST | 19k | `postoffices:110001` | Get post offices |

---

### **2️⃣ Search Indexes (Paginated)**

| Key Pattern | Type | Count | Example | Use Case |
|-------------|------|-------|---------|----------|
| `pincodes:all` | ZSET | 1 | `pincodes:all` | All pincodes (no filter) |
| `state:index:{state}` | ZSET | 37 | `state:index:delhi` | Pincodes by state |
| `district:index:{state}:{district}` | ZSET | 700 | `district:index:delhi:central-delhi` | Pincodes by district |
| `city:index:{city}` | ZSET | 4k | `city:index:mumbai` | Pincodes by city |

---

### **3️⃣ Multi-Criteria Lookups**

| Key Pattern | Type | Count | Example | Use Case |
|-------------|------|-------|---------|----------|
| `lookup:state-city:{state}:{city}` | ZSET | 5k | `lookup:state-city:delhi:new-delhi` | State + City filter |
| `lookup:district-city:{state}:{district}:{city}` | ZSET | 5k | `lookup:district-city:delhi:central-delhi:new-delhi` | District + City filter |

---

### **4️⃣ Count Caches (Instant Totals)**

| Key Pattern | Type | Count | Example | Value |
|-------------|------|-------|---------|-------|
| `count:all` | STRING | 1 | `count:all` | `"19042"` |
| `count:state:{state}` | STRING | 37 | `count:state:delhi` | `"5234"` |
| `count:district:{state}:{district}` | STRING | 700 | `count:district:delhi:central-delhi` | `"842"` |
| `count:city:{city}` | STRING | 4k | `count:city:mumbai` | `"1205"` |
| `count:state-city:{state}:{city}` | STRING | 5k | `count:state-city:delhi:new-delhi` | `"842"` |
| `count:district-city:{state}:{district}:{city}` | STRING | 5k | `count:district-city:delhi:central-delhi:new-delhi` | `"120"` |

---

### **5️⃣ Geospatial**

| Key Pattern | Type | Count | Example | Use Case |
|-------------|------|-------|---------|----------|
| `geo:pincodes` | GEOSPATIAL | 1 (19k members) | `geo:pincodes` | Nearby searches |

---

### **6️⃣ Administrative Metadata**

| Key Pattern | Type | Count | Example | Fields |
|-------------|------|-------|---------|--------|
| `states:meta` | HASH | 1 (37 fields) | `states:meta` | `delhi: {JSON}` |
| `districts:meta` | HASH | 1 (700 fields) | `districts:meta` | `delhi:central-delhi: {JSON}` |
| `cities:meta` | HASH | 1 (4k fields) | `cities:meta` | `mumbai: {JSON}` |

---

## 🎯 **Query Decision Tree**

```
User Query: GET /pincodes?{filters}
│
├─ No filters?
│  └─ Use: pincodes:all + count:all
│
├─ state + district + city?
│  └─ Use: lookup:district-city:{s}:{d}:{c} + count:district-city:{s}:{d}:{c}
│
├─ state + city?
│  └─ Use: lookup:state-city:{s}:{c} + count:state-city:{s}:{c}
│
├─ state + district?
│  └─ Use: district:index:{s}:{d} + count:district:{s}:{d}
│
├─ state only?
│  └─ Use: state:index:{s} + count:state:{s}
│
└─ city only?
   └─ Use: city:index:{c} + count:city:{c}
```

---

## 🔑 **Key Normalization Examples**

| Original | Normalized Key |
|----------|----------------|
| `"Delhi"` | `delhi` |
| `"Central Delhi"` | `central-delhi` |
| `"New Delhi"` | `new-delhi` |
| `"Andaman and Nicobar"` | `andaman-and-nicobar` |
| `"Dadra and Nagar Haveli"` | `dadra-and-nagar-haveli` |

**Rules:**
1. Lowercase
2. Trim whitespace
3. Replace spaces with hyphens

---

## ⚡ **Performance Cheat Sheet**

| Operation | Redis Key(s) | Time Complexity | Typical Time |
|-----------|--------------|-----------------|--------------|
| Get pincode | `pincode:{code}` | O(1) | <1ms |
| Get post offices | `postoffices:{code}` | O(N) | <2ms |
| Paginated search | `state:index:{s}` + `count:state:{s}` | O(log N + M) | <5ms |
| Get count only | `count:state:{s}` | O(1) | <1ms |
| Nearby search | `geo:pincodes` GEORADIUS | O(log N + M) | <5ms |
| Get all states | `states:meta` HGETALL | O(N) | <1ms |
| Get all districts | `districts:meta` HGETALL | O(N) | <2ms |

---

## 💾 **Memory Breakdown**

| Category | Memory | Percentage |
|----------|--------|------------|
| Pincode HASHes | 10 MB | 9% |
| Post Office LISTs | 30 MB | 27% |
| Search ZSETs | 38 MB | 34% |
| Lookup ZSETs | 30 MB | 27% |
| Counts | 150 KB | <1% |
| Geospatial | 3 MB | 3% |
| Admin HASHes | 100 KB | <1% |
| **TOTAL** | **~111 MB** | **100%** |

---

## 🔍 **Common Redis Commands**

```redis
# Get pincode details
HGETALL pincode:110001

# Get pincodes in Delhi (first page, 25 items)
ZRANGE state:index:delhi 0 24

# Get total count for Delhi
GET count:state:delhi

# Or get count directly from ZSET
ZCARD state:index:delhi

# Get post offices for pincode
LRANGE postoffices:110001 0 -1

# Find 10 pincodes within 5km of coordinates
GEORADIUS geo:pincodes 77.2090 28.6139 5 km WITHDIST ASC COUNT 10

# Get all states metadata
HGETALL states:meta

# Get specific state metadata
HGET states:meta delhi

# Get all districts for a state (requires filtering)
HGETALL districts:meta
# Then filter keys that start with "delhi:"
```

---

## 🎨 **Visual Schema**

```
Redis Database
│
├── Core Data (~40 MB)
│   ├── pincode:110001 (HASH)
│   ├── pincode:110002 (HASH)
│   ├── ...19,000 HASHes
│   ├── postoffices:110001 (LIST)
│   ├── postoffices:110002 (LIST)
│   └── ...19,000 LISTs
│
├── Search Indexes (~38 MB)
│   ├── pincodes:all (ZSET)
│   ├── state:index:delhi (ZSET)
│   ├── state:index:maharashtra (ZSET)
│   ├── ...37 state ZSETs
│   ├── district:index:delhi:central-delhi (ZSET)
│   ├── ...700 district ZSETs
│   ├── city:index:mumbai (ZSET)
│   └── ...4,000 city ZSETs
│
├── Multi-Criteria Lookups (~30 MB)
│   ├── lookup:state-city:delhi:new-delhi (ZSET)
│   ├── ...5,000 state-city ZSETs
│   ├── lookup:district-city:delhi:central-delhi:new-delhi (ZSET)
│   └── ...5,000 district-city ZSETs
│
├── Count Caches (~150 KB)
│   ├── count:all (STRING)
│   ├── count:state:delhi (STRING)
│   ├── count:district:delhi:central-delhi (STRING)
│   └── ...15,000 count STRINGs
│
├── Geospatial Index (~3 MB)
│   └── geo:pincodes (GEOSPATIAL, 19k members)
│
└── Administrative Metadata (~100 KB)
    ├── states:meta (HASH, 37 fields)
    ├── districts:meta (HASH, 700 fields)
    └── cities:meta (HASH, 4,000 fields)
```

---

**Total Keys:** ~67,740  
**Total Memory:** ~111 MB  
**All data loaded on startup, never expires!**
