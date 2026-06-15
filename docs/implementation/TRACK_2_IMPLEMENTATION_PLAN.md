# Track 2 Implementation Plan: DIGIPIN Solo Operations

## 📋 **Overview**

**Track 2** implements India Post's Digital Postal Index Number (DIGIPIN) system - a hierarchical grid-based geocoding system.

**Key Difference from Track 1**: DIGIPIN is **pure algorithmic** - no database storage needed! All operations are computed on-the-fly from coordinates.

---

## 🎯 **Endpoints to Implement (5 Total)**

### **2.1 GET /digipin/:digipinCode**
Get detailed information about a DIGIPIN cell
- **Input**: DIGIPIN code (e.g., "2C45KL")
- **Output**: Cell center, boundary, area, level, hierarchy, overlapping pincodes
- **Logic**: Decode → Calculate bounds → Query DB for pincodes in that area

### **2.2 POST /digipin/encode**
Convert coordinates to DIGIPIN codes
- **Input**: Array of {lat, lng}, target level
- **Output**: Array of DIGIPIN codes
- **Logic**: Pure algorithm (4x4 grid subdivision)

### **2.3 POST /digipin/decode**  
Convert DIGIPIN codes to center coordinates
- **Input**: Array of DIGIPIN codes
- **Output**: Array of {lat, lng, level}
- **Logic**: Pure algorithm (reverse of encode)

### **2.4 GET /digipin/neighbors/:digipinCode**
Get 8 neighboring DIGIPIN cells (same level)
- **Input**: DIGIPIN code
- **Output**: Array of 8 neighbor codes
- **Logic**: Decode → Calculate grid position → Encode neighbors

### **2.5 GET /digipin/nearby**
Find DIGIPIN cells within a radius
- **Input**: lat, lng, radius (km), level
- **Output**: Array of DIGIPIN codes within radius
- **Logic**: Encode center → Spiral outward → Filter by distance

---

## 🔧 **Implementation Strategy**

### **Phase 1: DIGIPIN Algorithm Service** ⭐ **START HERE**

Create pure algorithmic service (no database):

```typescript
// src/digipin/services/digipin-algorithm.service.ts

export class DigipinAlgorithmService {
  // Constants
  private readonly INDIA_BBOX = {
    minLat: 8.0,    // From official spec
    maxLat: 35.0,
    minLng: 68.0,
    maxLng: 97.0,
  };
  
  private readonly CHARSET = ['2','3','4','5','6','7','8','9','C','F','J','K','L','M','P','T'];
  
  // Core algorithms
  encode(lat: number, lng: number, level: number): string;
  decode(code: string): { lat: number, lng: number, level: number };
  getBounds(code: string): { minLat, maxLat, minLng, maxLng };
  getCenter(code: string): { lat: number, lng: number };
  getNeighbors(code: string): string[];
  getNearby(lat: number, lng: number, radius: number, level: number): string[];
}
```

### **Phase 2: DIGIPIN Business Logic Service**

Add database queries for pincode overlaps:

```typescript
// src/digipin/services/digipin.service.ts

export class DigipinService {
  constructor(
    private readonly algorithm: DigipinAlgorithmService,
    private readonly pincodeRepo: Repository<Pincode>,
  ) {}
  
  async getCellDetails(code: string): Promise<DigipinCellResponse> {
    const bounds = this.algorithm.getBounds(code);
    const center = this.algorithm.getCenter(code);
    
    // Query pincodes that intersect with this DIGIPIN cell
    const pincodes = await this.findOverlappingPincodes(bounds);
    
    return { code, center, bounds, pincodes, ... };
  }
}
```

### **Phase 3: DTOs**

```typescript
// src/digipin/dto/

export class EncodeDigipinDto {
  coordinates: { latitude: number; longitude: number }[];
  level: number; // 1-10
}

export class DecodeDigipinDto {
  digipinCodes: string[];
}

export class DigipinCellResponse {
  digipinCode: string;
  level: number;
  center: { latitude: number; longitude: number };
  boundary: GeoJSON.Polygon;
  area: { value: number; unit: string };
  pincodes: string[];
  parentDigipin: string;
  hierarchy: Record<string, string>;
}
```

### **Phase 4: Controller & Module**

```typescript
// src/digipin/digipin.controller.ts

@Controller('api/v1/digipin')
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)
export class DigipinController {
  @Get(':code')
  async getCell(@Param('code') code: string) { ... }
  
  @Post('encode')
  async encode(@Body() dto: EncodeDigipinDto) { ... }
  
  @Post('decode')
  async decode(@Body() dto: DecodeDigipinDto) { ... }
  
  @Get('neighbors/:code')
  async neighbors(@Param('code') code: string) { ... }
  
  @Get('nearby')
  async nearby(@Query() query: NearbyQuery) { ... }
}
```

---

## 🎨 **Caching Strategy**

**Key Insight**: DIGIPIN operations are **pure functions** (same input = same output)

| Operation | Cache? | TTL | Reason |
|-----------|--------|-----|--------|
| encode() | ❌ NO | - | < 0.1ms, not worth caching |
| decode() | ❌ NO | - | < 0.1ms, not worth caching |
| getCell() | ✅ YES | 24h | DB query for pincodes |
| neighbors() | ❌ NO | - | < 0.1ms, pure algorithm |
| nearby() | ✅ YES | 1h | Expensive calculation + DB |

**Rationale**: Only cache operations that hit the database or are expensive (nearby spiral search).

---

## ⚡ **Performance Targets**

| Endpoint | Target | Expected |
|----------|--------|----------|
| encode | < 1ms | ~0.1ms ✅ |
| decode | < 1ms | ~0.1ms ✅ |
| getCell (cached) | < 10ms | ~1-5ms ✅ |
| getCell (uncached) | < 50ms | ~20-30ms ✅ |
| neighbors | < 1ms | ~0.5ms ✅ |
| nearby | < 100ms | ~50-80ms ✅ |

---

## 📝 **Implementation Steps**

### **Step 1**: Create DIGIPIN Algorithm Service (2-3 hours)
- [ ] Implement encode() - lat/lng → DIGIPIN
- [ ] Implement decode() - DIGIPIN → lat/lng
- [ ] Implement getBounds() - DIGIPIN → bounding box
- [ ] Implement getCenter() - DIGIPIN → center point
- [ ] Write unit tests with official examples

### **Step 2**: Create DIGIPIN Business Service (1-2 hours)
- [ ] Implement getCellDetails() - DIGIPIN → full details + pincodes
- [ ] Implement getNeighbors() - DIGIPIN → 8 neighbors
- [ ] Implement getNearby() - coordinates + radius → cells

### **Step 3**: Create DTOs (30 min)
- [ ] Request DTOs (encode, decode, nearby)
- [ ] Response DTOs (cell details, neighbor list, etc.)
- [ ] Add validation decorators

### **Step 4**: Create Controller (1 hour)
- [ ] Implement 5 endpoints
- [ ] Add guards & interceptors
- [ ] Add logging

### **Step 5**: Create Module (30 min)
- [ ] Wire up all dependencies
- [ ] Add to AppModule

### **Step 6**: Testing (2 hours)
- [ ] Test each endpoint
- [ ] Verify algorithm correctness
- [ ] Check pincode overlaps
- [ ] Performance testing

---

## 🧪 **Test Cases**

```typescript
describe('DigipinAlgorithmService', () => {
  it('should encode Delhi coordinates correctly', () => {
    const code = service.encode(28.6139, 77.2090, 6);
    expect(code).toMatch(/^[2-9CFJKLMPT]{6}$/);
  });
  
  it('should decode back to same coordinates', () => {
    const code = '2C45KL';
    const { lat, lng } = service.decode(code);
    expect(lat).toBeCloseTo(28.6139, 3);
    expect(lng).toBeCloseTo(77.2090, 3);
  });
  
  it('should find 8 neighbors', () => {
    const neighbors = service.getNeighbors('2C45KL');
    expect(neighbors).toHaveLength(8);
  });
});
```

---

## 🚀 **Next Steps**

1. ✅ Read this plan
2. 🔜 Implement DigipinAlgorithmService (pure algorithm)
3. ⏸️ Implement DigipinService (business logic + DB)
4. ⏸️ Create DTOs, Controller, Module
5. ⏸️ Test & Deploy

---

**Estimated Time**: 6-8 hours total

**Ready to start implementing!** 🎯
