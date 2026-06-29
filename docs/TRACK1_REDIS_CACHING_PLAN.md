# Track 1 Redis Caching Implementation Plan

## 🎯 Goal
Implement persistent Redis caching for all Track 1 endpoints to achieve:
- **<10ms response times** for 95%+ of queries
- **Zero database load** for cached queries
- **Simple fallback** to PostgreSQL when cache misses

---

## 📋 Track 1 Endpoints (11 total)

### **Track 1A - Pincodes** (7 endpoints)

| # | Method | Endpoint | Status | Cache Strategy |
|---|--------|----------|--------|----------------|
| 1 | GET | `/pincodes/:pincode` | ✅ **DONE** | Redis HASH `pincode:{code}` + DB fallback |
| 2 | GET | `/pincodes` | 🔄 TODO | Redis SET operations (state/district indexes) |
| 3 | GET | `/pincodes/:pincode/validate` | ✅ **DONE** | Redis EXISTS + HGET + DB fallback |
| 4 | GET | `/pincodes/:pincode/nearby` | 🔄 TODO | Redis GEORADIUS for centroid-based |
| 5 | POST | `/pincodes/locate` | ⚠️ PostGIS | No cache (ST_Contains required) |
| 6 | POST | `/pincodes/reverse-geocode` | ⚠️ PostGIS | No cache (ST_Distance required) |
| 7 | POST | `/pincodes/bulk/lookup` | ✅ **DONE** | Redis pipeline + DB fallback |

### **Track 1B - Administrative** (4 endpoints)

| # | Method | Endpoint | Status | Cache Strategy |
|---|--------|----------|--------|----------------|
| 8 | GET | `/administrative/states` | 🔄 TODO | Redis HASH `states:meta` |
| 9 | GET | `/administrative/states/:code` | 🔄 TODO | Redis HASH field |
| 10 | GET | `/administrative/districts` | 🔄 TODO | Redis HASH `districts:meta` |
| 11 | GET | `/administrative/regions` | 🔄 TODO | Redis HASH `regions:meta` |

---

## 🏗️ Redis Data Structures (Already Designed)

```redis
# 1. Pincode Core Data
pincode:110001 (HASH)
  ├─ id, pincode, office_name, state, district, city
  ├─ region, circle, centroid_lat, centroid_lng
  └─ post_office_count, is_active

# 2. Post Offices
postoffices:110001 (LIST) → [JSON, JSON, ...]

# 3. State Index
state:index:delhi (SET) → {110001, 110002, ...}

# 4. District Index
district:index:delhi:central delhi (SET) → {110001, 110002, ...}

# 5. Geospatial Index
geo:pincodes (GEOSPATIAL) → [(77.2090, 28.6139, "110001"), ...]

# 6. Administrative Metadata
states:meta (HASH) → {delhi: {name, code, pincode_count}, ...}
districts:meta (HASH) → {delhi_central-delhi: {state, name, count}, ...}
regions:meta (HASH) → {delhi-region: {circle, count}, ...}
```

---

## ✅ Implementation Progress

### **Phase 1: Core Caching (Endpoints 1, 3, 7)** ✅ **COMPLETED**
1. ✅ Injected `PincodeCacheService` into `PincodeService`
2. ✅ Updated `findByPincode()` to check Redis first with DB fallback
3. ✅ Updated `validatePincode()` to use Redis EXISTS + HGET with DB fallback
4. ✅ Updated `bulkLookup()` to use Redis pipeline with DB fallback

### **Phase 2: Search Endpoints (Endpoint 2)**
5. Update `findPincodes()` to use SET operations for state/district filtering

### **Phase 3: Geospatial (Endpoint 4)**
6. Update `findNearbyPincodes()` to use Redis GEORADIUS

### **Phase 4: Administrative (Endpoints 8-11)**
7. Update `AdministrativeService` to use Redis HASH for states/districts/regions

### **Phase 5: PostGIS Fallback Documentation**
8. Document that `/locate` and `/reverse-geocode` require PostGIS (no caching)

---

## 🔧 Code Pattern

```typescript
// Pattern for all endpoints
async findByPincode(pincode: string, includePostOffices = false) {
  // 1. Try Redis first
  const cached = await this.pincodeCacheService.getPincode(pincode);
  
  if (cached) {
    this.logger.log(`✅ Cache HIT: ${pincode}`);
    
    if (includePostOffices) {
      const postOffices = await this.pincodeCacheService.getPostOffices(pincode);
      return { ...cached, postOffices };
    }
    
    return cached;
  }
  
  // 2. Fallback to database
  this.logger.warn(`⚠️ Cache MISS: ${pincode} - falling back to DB`);
  return this.findByPincodeFromDB(pincode, includePostOffices);
}
```

---

## 📊 Expected Results

| Metric | Before (DB) | After (Redis) | Improvement |
|--------|-------------|---------------|-------------|
| Avg Response Time | 50-200ms | <10ms | **20x faster** |
| P95 Response Time | 300ms | <15ms | **20x faster** |
| DB Queries/sec | 100-1000 | <5 | **200x reduction** |
| Cache Hit Rate | 0% | 95%+ | ✅ |
| Memory Usage | 0 MB | 60 MB | Acceptable |

---

## 🚀 Rollout Plan

1. **Deploy with feature flag OFF** (cache loaded but not used)
2. **Monitor Redis memory usage** (should be ~60 MB)
3. **Enable caching for Endpoint #1** (single pincode lookup)
4. **Monitor response times and cache hit rates**
5. **Gradually enable remaining endpoints**
6. **Full rollout after 48 hours of stable operation**

---

**Next:** Start with Endpoint #1 (`GET /pincodes/:pincode`)
