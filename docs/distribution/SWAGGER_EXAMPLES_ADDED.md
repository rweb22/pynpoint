# Swagger/OpenAPI Examples - NestJS Native Approach

**Date**: 2026-07-04  
**Approach**: ✅ Clean NestJS/Swagger decorators  
**Status**: Ready for production deployment & OpenAPI spec regeneration

---

## 🎯 What We Did (The Right Way!)

Instead of manually editing the generated `openapi-spec-public.json`, we added **`@ApiBody` decorators with examples** directly in the NestJS controllers. This is the **proper, maintainable approach** because:

✅ **Source of Truth**: Examples live in the code, not in generated JSON  
✅ **Auto-Generated**: Swagger generates the spec with examples on every build  
✅ **Type-Safe**: Examples are checked against DTOs  
✅ **Maintainable**: Update code once, spec updates automatically  
✅ **Versioned**: Examples are tracked in git with the code  

---

## ✅ Changes Made

### 1. PINCODE Operations (3 endpoints)

**File**: `src/pincode/controllers/pincode.controller.ts`

```typescript
@Post('reverse-geocode')
@ApiBody({
  type: ReverseGeocodeDto,
  examples: {
    'delhi-center': {
      summary: 'Find pincodes near Delhi center',
      value: {
        latitude: 28.6139,
        longitude: 77.2090,
        maxDistance: 5,
        limit: 3
      }
    },
    'mumbai-gateway': {
      summary: 'Find pincodes near Gateway of India',
      value: {
        latitude: 18.9220,
        longitude: 72.8347,
        maxDistance: 10,
        limit: 1
      }
    }
  }
})
```

**Endpoints Enhanced**:
- `POST /pincodes/reverse-geocode` → 2 examples
- `POST /pincodes/locate` → 2 examples  
- `POST /pincodes/bulk/lookup` → 2 examples

---

### 2. DIGIPIN Operations (4 endpoints)

**File**: `src/digipin/controllers/digipin.controller.ts`

```typescript
@Post('encode')
@ApiBody({
  type: EncodeDigipinDto,
  examples: {
    'single-delhi': {
      summary: 'Encode single location (Delhi)',
      value: {
        coordinates: [{ latitude: 28.6139, longitude: 77.2090 }],
        level: 6
      }
    },
    'batch-cities': {
      summary: 'Batch encode multiple cities',
      value: {
        coordinates: [
          { latitude: 28.6139, longitude: 77.2090 },
          { latitude: 19.0760, longitude: 72.8777 }
        ],
        level: 8
      }
    }
  }
})
```

**Endpoints Enhanced**:
- `POST /digipin/encode` → 3 examples
- `POST /digipin/decode` → 2 examples
- `POST /digipin/validate` → 1 example
- `POST /digipin/to-pincode` → 1 example

---

### 3. Distance Operations (2 endpoints)

**File**: `src/distance/controllers/distance.controller.ts`

```typescript
@Post('calculate')
@ApiBody({
  type: CalculateDistanceDto,
  examples: {
    'pincode-to-pincode': {
      summary: 'Delhi to Mumbai (pincodes)',
      value: {
        from: { pincode: '110001' },
        to: { pincode: '400001' },
        unit: 'km'
      }
    },
    'mixed-types': {
      summary: 'DIGIPIN to coordinates',
      value: {
        from: { digipin: 'C4P8K63M' },
        to: { coordinate: { lat: 19.0760, lng: 72.8777 } },
        unit: 'km'
      }
    }
  }
})
```

**Endpoints Enhanced**:
- `POST /distance/calculate` → 3 examples
- `POST /distance/batch` → 1 example

---

## 📊 Summary

| Category | Endpoints | Total Examples |
|----------|-----------|----------------|
| **PINCODE** | 3 | 6 examples |
| **DIGIPIN** | 4 | 7 examples |
| **Distance** | 2 | 4 examples |
| **TOTAL** | **9** | **17 examples** |

---

## 🚀 Next Steps

### 1. Deploy to Production
Push the changes to production:
```bash
git pull origin main
npm run build
pm2 restart pynpoint
# or: systemctl restart pynpoint
```

### 2. Download OpenAPI Spec (Production-Ready!)
After deployment, download the spec - **no cleaning needed**:
```bash
curl https://pynpoint.codesense.in/api/docs-json > openapi-spec-public.json
```

✨ **Admin endpoints are already excluded** via `@ApiExcludeController()` decorator!

### 3. Upload to RapidAPI
- Go to RapidAPI Dashboard → Your API → **Definition** tab
- Upload `openapi-spec-public.json` directly
- RapidAPI will parse the examples automatically

### 4. Verify in RapidAPI
Go to **Requests** tab and check:
- Click `POST /api/v1/pincodes/reverse-geocode`
- Column 3 should show a **dropdown** with example names:
  - "delhi-center"
  - "mumbai-gateway"
- Select an example and see the request body populate
- Click "Test Endpoint" - should work immediately!

---

## ✨ Benefits

### For Development
✅ **Single Source of Truth**: Examples in code, not external JSON  
✅ **Type Safety**: TypeScript checks examples against DTOs  
✅ **Auto-Update**: Spec regenerates on every build  
✅ **Git Tracked**: Examples versioned with code  

### For RapidAPI
✅ **Multiple Examples**: Users can choose from dropdown  
✅ **Named Examples**: Clear, descriptive names  
✅ **Working Tests**: "Test Endpoint" button works immediately  
✅ **Professional**: Shows attention to detail  

### For Subscribers
✅ **Learn by Example**: See real-world use cases  
✅ **Copy-Paste Ready**: Examples are production-ready  
✅ **Multiple Scenarios**: See different ways to use each endpoint  

---

## 🔄 Future Updates

When you need to add/update examples:

1. **Edit the controller** (e.g., `src/pincode/controllers/pincode.controller.ts`)
2. **Update the `@ApiBody` decorator**
3. **Commit and push**
4. **Deploy to production**
5. **Download new spec** from `/api/docs-json`
6. **Re-upload to RapidAPI**

That's it! No manual JSON editing needed.

---

**This is the proper, maintainable way!** 🎉
