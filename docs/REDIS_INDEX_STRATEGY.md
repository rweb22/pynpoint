# Redis Index Strategy for Constant-Time Filtered Queries

**Goal:** Achieve O(1) or O(log n) lookups for all filter combinations in `GET /pincodes`

---

## 📊 **Query Patterns to Support**

```http
GET /pincodes?state=Delhi                                    # Pattern 1
GET /pincodes?state=Delhi&district=Central Delhi             # Pattern 2
GET /pincodes?state=Delhi&district=Central Delhi&city=...    # Pattern 3
GET /pincodes?city=Mumbai                                    # Pattern 4
GET /pincodes?search=Connaught                               # Pattern 5
GET /pincodes (no filters, all pincodes)                     # Pattern 6
```

---

## 🎯 **Optimal Data Structure: Inverted Indexes with SETs**

### **Strategy:**
Use **Redis SETs** for each filter dimension, then perform **SET intersection** for combinations.

```redis
# Index 1: By State (normalized lowercase)
state:delhi → SET {110001, 110002, 110003, ...}
state:maharashtra → SET {400001, 400002, ...}

# Index 2: By District (state:district compound key)
district:delhi:central-delhi → SET {110001, 110002, ...}
district:delhi:south-delhi → SET {110055, 110065, ...}
district:maharashtra:mumbai → SET {400001, 400002, ...}

# Index 3: By City
city:new-delhi → SET {110001, 110011, 110021, ...}
city:mumbai → SET {400001, 400002, ...}

# Index 4: Full-text search (prefix-based, limited)
search:con → SET {110001}  # "Connaught Place"
search:anna → SET {600002}  # "Anna Nagar"

# Metadata: All active pincodes
pincodes:all → SET {110001, 110002, ..., 999999}
```

---

## ⚡ **Query Execution Logic**

### **Query 1: State Only**
```
GET /pincodes?state=Delhi

Redis: SMEMBERS state:delhi
Time: O(n) where n = pincodes in Delhi (~5000)
Result: Direct SET retrieval
```

### **Query 2: State + District**
```
GET /pincodes?state=Delhi&district=Central Delhi

Redis: SMEMBERS district:delhi:central-delhi
Time: O(n) where n = pincodes in district (~500)
Result: Direct SET retrieval (pre-computed compound index)
```

### **Query 3: State + District + City**
```
GET /pincodes?state=Delhi&district=Central Delhi&city=New Delhi

Redis: SINTER district:delhi:central-delhi city:new-delhi
Time: O(n*m) where n and m are SET sizes (typically <1000 each)
Result: SET intersection
```

### **Query 4: City Only**
```
GET /pincodes?city=Mumbai

Redis: SMEMBERS city:mumbai
Time: O(n) where n = pincodes in city
Result: Direct SET retrieval
```

### **Query 5: Search (Office Name or Pincode)**
```
GET /pincodes?search=Connaught

Strategy: Two approaches
1. SCAN pattern matching (slower, flexible)
2. Prefix index (faster, limited)

Option A (Simple, Slower):
- Fetch ALL pincodes from cache
- Filter in memory by office_name or pincode
- Time: O(n) where n = total pincodes (~19k)

Option B (Complex, Faster):
- Build prefix index: search:con → SET {110001, ...}
- Time: O(1) lookup + O(m) retrieval
```

### **Query 6: No Filters (All Pincodes)**
```
GET /pincodes

Redis: SMEMBERS pincodes:all
Time: O(n) where n = 19,000
Alternative: Use SCAN with pagination
```

---

## 🏗️ **Implementation: Index Building**

Update `PincodeCacheService.buildSearchIndexes()`:

```typescript
async buildSearchIndexes(): Promise<void> {
  this.logger.log('📇 Building search indexes...');

  const pipeline = this.redisCache.getClient().pipeline();
  const pincodes = await this.pincodeRepository.find({
    where: { is_active: true },
    select: ['pincode', 'state', 'district', 'city', 'office_name'],
  });

  const stateIndex = new Map<string, Set<string>>();
  const districtIndex = new Map<string, Set<string>>();
  const cityIndex = new Map<string, Set<string>>();
  const allPincodes = new Set<string>();

  for (const pc of pincodes) {
    const pincode = pc.pincode;
    allPincodes.add(pincode);

    // State index
    if (pc.state) {
      const stateKey = this.normalizeKey(pc.state);
      if (!stateIndex.has(stateKey)) {
        stateIndex.set(stateKey, new Set());
      }
      stateIndex.get(stateKey)!.add(pincode);
    }

    // District index (compound: state:district)
    if (pc.state && pc.district) {
      const districtKey = `${this.normalizeKey(pc.state)}:${this.normalizeKey(pc.district)}`;
      if (!districtIndex.has(districtKey)) {
        districtIndex.set(districtKey, new Set());
      }
      districtIndex.get(districtKey)!.add(pincode);
    }

    // City index
    if (pc.city) {
      const cityKey = this.normalizeKey(pc.city);
      if (!cityIndex.has(cityKey)) {
        cityIndex.set(cityKey, new Set());
      }
      cityIndex.get(cityKey)!.add(pincode);
    }
  }

  // Write to Redis
  stateIndex.forEach((pincodes, state) => {
    pipeline.sadd(`state:${state}`, ...Array.from(pincodes));
  });

  districtIndex.forEach((pincodes, district) => {
    pipeline.sadd(`district:${district}`, ...Array.from(pincodes));
  });

  cityIndex.forEach((pincodes, city) => {
    pipeline.sadd(`city:${city}`, ...Array.from(pincodes));
  });

  pipeline.sadd('pincodes:all', ...Array.from(allPincodes));

  await pipeline.exec();
  this.logger.log(`✅ Built indexes: ${stateIndex.size} states, ${districtIndex.size} districts, ${cityIndex.size} cities`);
}

private normalizeKey(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '-');
}
```

---

## 🚀 **Service Implementation**

```typescript
async findPincodes(query: PincodeQueryDto): Promise<PincodeListResponseDto> {
  const { state, district, city, search, limit = 25, page = 1 } = query;

  let pincodeSet: string[] = [];

  // Strategy: Use Redis indexes when possible
  if (state && district) {
    // Use compound district index
    const key = `district:${normalize(state)}:${normalize(district)}`;
    pincodeSet = await this.redisCache.getClient().smembers(key);
  } else if (state) {
    // Use state index
    const key = `state:${normalize(state)}`;
    pincodeSet = await this.redisCache.getClient().smembers(key);
  } else if (city) {
    // Use city index
    const key = `city:${normalize(city)}`;
    pincodeSet = await this.redisCache.getClient().smembers(key);
  } else if (!search) {
    // No filters: get all
    pincodeSet = await this.redisCache.getClient().smembers('pincodes:all');
  }

  // Additional filtering (city filter on state+district results)
  if (city && (state || district)) {
    const cityKey = `city:${normalize(city)}`;
    const citySet = await this.redisCache.getClient().smembers(cityKey);
    pincodeSet = pincodeSet.filter(p => citySet.includes(p));
  }

  // Search filter (in-memory on Redis results)
  if (search) {
    // If no other filters, fetch all and search
    if (pincodeSet.length === 0) {
      pincodeSet = await this.redisCache.getClient().smembers('pincodes:all');
    }
    
    // Filter by search term
    pincodeSet = pincodeSet.filter(pincode => {
      // Match pincode number or fetch office_name from cache
      if (pincode.includes(search)) return true;
      // TODO: Fetch office_name from cache and check
      return false;
    });
  }

  // Pagination
  const total = pincodeSet.length;
  const start = (page - 1) * limit;
  const paginated = pincodeSet.slice(start, start + limit);

  // Fetch full details for paginated results
  const results = await Promise.all(
    paginated.map(pincode => this.pincodeCacheService.getPincode(pincode))
  );

  return { pincodes: results, total, page, limit };
}
```

---

## 📊 **Performance Comparison**

| Query | PostgreSQL | Redis (Proposed) | Improvement |
|-------|-----------|------------------|-------------|
| State only | 50-100ms (BTREE scan) | 5-10ms (SMEMBERS) | **10x** |
| State + District | 30-50ms (index scan) | 2-5ms (SMEMBERS) | **10x** |
| City only | 50-100ms (full scan) | 5-10ms (SMEMBERS) | **10x** |
| Search | 100-200ms (LIKE query) | 20-50ms (in-memory filter) | **5x** |

---

**Next:** Implement this indexing strategy in `PincodeCacheService`
