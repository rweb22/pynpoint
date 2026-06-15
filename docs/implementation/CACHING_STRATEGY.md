# Caching Strategy for PinPoint India API

## 🏗️ Dual-Redis Architecture

We use **two Redis instances** with different purposes and configurations:

### **1. RedisCacheService** (Ephemeral Cache)
**Purpose**: API authentication, rate limiting, and temporary data

**Configuration**:
- `maxmemory-policy: allkeys-lru` (evict least recently used)
- NO RDB snapshots (ephemeral data)
- NO persistent volume (data can be lost on restart)

**Environment Variable**: `REDIS_CACHE_URL`

**Use Cases**:
- ✅ API key validation cache (TTL: 1 hour)
- ✅ Rate limit counters (TTL: 1 minute to 1 day)
- ✅ Pincode lookup cache (TTL: 1-24 hours)
- ✅ Administrative data cache (states/districts, TTL: 24 hours)
- ✅ Distance calculation cache (TTL: 1 hour)
- ✅ DIGIPIN metadata cache (TTL: 1 hour)
- ✅ Temporary session data

---

### **2. RedisPersistentService** (H3 Spatial Index)
**Purpose**: Long-term H3 hexagon → pincode mapping

**Configuration**:
- `maxmemory-policy: noeviction` (never evict data)
- RDB snapshots enabled (`save 60 1`)
- Persistent volume: `/data/dump.rdb`

**Environment Variable**: `REDIS_PERSISTENT_URL`

**Use Cases**:
- ✅ H3 hexagon → pincode mapping (32.5M entries)
- ✅ H3 spatial index (MUST survive restarts)
- ❌ NO ephemeral data (API keys, rate limits, etc.)

---

## 📋 Caching Strategy by Track

### **Track 1: Pincode Solo Operations**

| Endpoint | Cache Service | Key Pattern | TTL | Rationale |
|----------|---------------|-------------|-----|-----------|
| `GET /pincodes/:pincode` | **RedisCacheService** | `pincode:{pincode}` | 1 hour | Pincodes rarely change |
| `GET /pincodes?state=...` | **RedisCacheService** | `pincode:query:{hash}` | 10 min | Queries change frequently |
| `GET /administrative/states` | **RedisCacheService** | `admin:states` | 24 hours | Static data |
| `GET /administrative/districts` | **RedisCacheService** | `admin:districts:{state}` | 24 hours | Static data |
| `POST /pincodes/bulk/lookup` | **RedisCacheService** | Individual pincode keys | 1 hour | Reuse single lookups |

**Cache Invalidation**: Manual via admin CLI when India Post updates data.

---

### **Track 2: DIGIPIN Solo Operations**

| Endpoint | Cache Service | Key Pattern | TTL | Rationale |
|----------|---------------|-------------|-----|-----------|
| `GET /digipin/:code` | **RedisCacheService** | `digipin:{code}:meta` | 1 hour | Metadata (pincodes in cell) |
| `POST /digipin/encode` | **None** | N/A | N/A | Pure algorithm (~0.1ms) |
| `POST /digipin/decode` | **None** | N/A | N/A | Pure algorithm (~0.1ms) |
| `GET /digipin/neighbors` | **None** | N/A | N/A | Pure algorithm (~0.5ms) |
| `GET /digipin/nearby` | **RedisPersistentService** | `h3:{hexId}` | Permanent | H3 lookup for performance |

**Rationale**: DIGIPIN encode/decode is pure algorithm (no DB/Redis needed). Only cache pincode metadata.

---

### **Track 3: H3 Operations**

| Endpoint | Cache Service | Key Pattern | TTL | Rationale |
|----------|---------------|-------------|-----|-----------|
| `GET /h3/:h3Index` | **RedisPersistentService** | `h3:{hexId}` | Permanent | Core spatial index |
| `POST /h3/encode` | **RedisPersistentService** | `h3:{hexId}` | Permanent | After encoding, lookup pincode |
| `POST /h3/decode` | **None** | N/A | N/A | Pure h3-js decode (~1ms) |
| `GET /h3/neighbors` | **RedisPersistentService** | `h3:{hexId}` | Permanent | kRing neighbors lookup |
| `GET /h3/nearby` | **RedisPersistentService** | `h3:{hexId}` | Permanent | Polyfill → multiple H3 lookups |

**Rationale**: H3 index is the **core spatial data structure**. All H3 → pincode mappings are persistent.

---

### **Track 4: Hybrid & Conversion Operations**

| Endpoint | Cache Service | Key Pattern | TTL | Rationale |
|----------|---------------|-------------|-----|-----------|
| `POST /convert/pincode-to-h3` | **RedisPersistentService** | `h3:{hexId}` | Permanent | H3 lookup after coord → h3 |
| `POST /convert/pincode-to-digipin` | **RedisCacheService** | `pincode:{pincode}` | 1 hour | Pincode coords cached |
| `POST /convert/h3-to-pincode` | **RedisPersistentService** | `h3:{hexId}` | Permanent | Core H3 index |
| `POST /convert/digipin-to-pincode` | **RedisPersistentService** | `h3:{hexId}` | Permanent | DIGIPIN → coord → h3 → pincode |
| `GET /h3/cells-in-pincode` | **RedisCacheService** | `pincode:{pincode}:h3cells` | 1 hour | Expensive computation |
| `GET /digipin/cells-in-pincode` | **RedisCacheService** | `pincode:{pincode}:digipins` | 1 hour | Expensive computation |

**Rationale**: Cache expensive computations (polygon → h3 cells). Use persistent for H3 lookups.

---

### **Track 5: Distance & Measurement**

| Endpoint | Cache Service | Key Pattern | TTL | Rationale |
|----------|---------------|-------------|-----|-----------|
| `POST /distance/calculate` | **RedisCacheService** | `distance:{from}:{to}:{unit}` | 1 hour | Frequently repeated queries |
| `POST /distance/batch` | **RedisCacheService** | Individual distance keys | 1 hour | Reuse single calculations |

**Rationale**: Distance calculations are pure math, but cache results for frequently queried pairs.

---

## 🎯 Key Principles

### **RedisCacheService** (Use When)
- ✅ Data can be recomputed from DB or algorithm
- ✅ TTL makes sense (1 min to 24 hours)
- ✅ Data can be safely evicted (LRU policy)
- ✅ Examples: API keys, rate limits, pincode lookups, query results

### **RedisPersistentService** (Use When)
- ✅ Data MUST survive restarts
- ✅ Core spatial index (H3 → pincode)
- ✅ Expensive to regenerate (32.5M entries)
- ✅ Examples: H3 spatial index ONLY

### **No Cache** (Use When)
- ✅ Pure algorithm < 1ms (DIGIPIN encode/decode, haversine)
- ✅ Response time is already fast enough
- ✅ Examples: Coordinate calculations, H3 decode

---

## 📊 Cache Key Naming Convention

```
# RedisCacheService (Ephemeral)
apikey:{keyHash}                      # API key validation
ratelimit:{customerId}:minute:{ts}    # Rate limit counters
pincode:{pincode}                     # Pincode details
pincode:query:{queryHash}             # Pincode search results
admin:states                          # States list
admin:districts:{stateCode}           # Districts by state
distance:{fromType}:{fromVal}:{toType}:{toVal}:{unit}  # Distance results
digipin:{code}:meta                   # DIGIPIN pincode metadata

# RedisPersistentService (Persistent)
h3:{hexId}                            # H3 → pincode mapping (ONLY!)
```

---

## 🚀 Implementation Checklist

- [x] RedisCacheService created and tested
- [x] RedisPersistentService created and tested
- [x] ApiKeyService uses RedisCacheService
- [x] RateLimitInterceptor uses RedisCacheService
- [ ] PincodeService caching (Track 1)
- [ ] H3Service uses RedisPersistentService (Track 3)
- [ ] DistanceService caching (Track 5)
- [ ] Cache invalidation CLI commands

---

**Next**: Implement Track 1 with proper RedisCacheService integration.
