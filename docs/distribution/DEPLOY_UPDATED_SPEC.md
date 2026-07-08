# Deploy Updated OpenAPI Spec with Schema Examples

**Date**: 2026-07-08  
**Status**: ⚠️ LOCAL ONLY - Need to deploy to production

---

## 🔍 Current Situation

✅ **Local File**: `pynpoint/openapi-spec-public.json` has schema examples  
❌ **Production Server**: `https://pynpoint.codesense.in/api/docs-json` does NOT have schema examples  
❌ **RapidAPI**: Using old spec from production (incomplete data in examples)

---

## 🚨 The Problem

The examples we added are in the **local Git repo** but not on your **production NestJS server**.

RapidAPI is showing incomplete data like:
```bash
--data '{"unit":"km"}'  # ❌ Missing "from" and "to"
```

Because the production server's OpenAPI spec doesn't have the schema examples yet!

---

## ✅ Solution: Update Production Code

The schema examples need to be added **in your NestJS source code**, not just the JSON file.

### Step 1: Update DTOs with @ApiProperty Examples

**File**: `pynpoint/src/distance/dto/calculate-distance.dto.ts`

**Before**:
```typescript
export class CalculateDistanceDto {
  @ApiProperty({
    description: 'Starting location',
    type: LocationDto
  })
  from: LocationDto;

  @ApiProperty({
    description: 'Destination location',
    type: LocationDto
  })
  to: LocationDto;

  @ApiProperty({
    description: 'Distance unit',
    enum: ['km', 'mi', 'm'],
    default: 'km'
  })
  unit?: string;
}
```

**After**:
```typescript
export class CalculateDistanceDto {
  @ApiProperty({
    description: 'Starting location (pincode, digipin, or coordinates)',
    type: LocationDto,
    example: { pincode: '110001' }  // ← Add this!
  })
  from: LocationDto;

  @ApiProperty({
    description: 'Destination location (pincode, digipin, or coordinates)',
    type: LocationDto,
    example: { pincode: '400001' }  // ← Add this!
  })
  to: LocationDto;

  @ApiProperty({
    description: 'Distance unit (km=kilometers, mi=miles, m=meters)',
    enum: ['km', 'mi', 'm'],
    default: 'km',
    example: 'km'  // ← Add this!
  })
  unit?: string;
}
```

### Step 2: Add Class-Level Example

At the **class level**, add `@ApiExtraModels` and example:

```typescript
import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';

@ApiExtraModels()  // If needed for complex types
export class CalculateDistanceDto {
  // ... properties with examples above ...

  // Add static example method or use decorator
  static example = {
    from: { pincode: '110001' },
    to: { pincode: '400001' },
    unit: 'km'
  };
}
```

**OR** use the `@ApiExample` decorator in the controller:

```typescript
@Post('calculate')
@ApiOperation({ summary: 'Calculate distance between locations' })
@ApiBody({
  type: CalculateDistanceDto,
  examples: {
    'pincode-to-pincode': {
      summary: 'Distance between two pincodes',
      value: {
        from: { pincode: '110001' },
        to: { pincode: '400001' },
        unit: 'km'
      }
    },
    'mixed-types': {
      summary: 'Pincode to coordinates',
      value: {
        from: { pincode: '110001' },
        to: { coordinate: { lat: 19.0760, lng: 72.8777 } },
        unit: 'km'
      }
    }
  }
})
async calculateDistance(@Body() dto: CalculateDistanceDto) {
  // ...
}
```

---

## 📋 All DTOs That Need Examples

Based on our fix, these 9 DTOs need schema-level examples:

1. `ReverseGeocodeDto` → `src/pincode/dto/reverse-geocode.dto.ts`
2. `LocatePincodeDto` → `src/pincode/dto/locate-pincode.dto.ts`
3. `BulkPincodeLookupDto` → `src/pincode/dto/bulk-pincode-lookup.dto.ts`
4. `EncodeDigipinDto` → `src/digipin/dto/encode-digipin.dto.ts`
5. `DecodeDigipinDto` → `src/digipin/dto/decode-digipin.dto.ts`
6. `ValidateDigipinDto` → `src/digipin/dto/validate-digipin.dto.ts`
7. `DigipinToPincodeDto` → `src/digipin/dto/digipin-to-pincode.dto.ts`
8. `CalculateDistanceDto` → `src/distance/dto/calculate-distance.dto.ts`
9. `BatchDistanceDto` → `src/distance/dto/batch-distance.dto.ts`

---

## 🔧 NestJS Example Best Practices

### Option 1: Property-Level Examples (Simple)
```typescript
@ApiProperty({
  description: 'User latitude',
  example: 28.6139,
  minimum: -90,
  maximum: 90
})
latitude: number;
```

### Option 2: Controller-Level Examples (Complex/Multiple)
```typescript
@ApiBody({
  type: MyDto,
  examples: {
    'example1': { value: { ... } },
    'example2': { value: { ... } }
  }
})
```

### Option 3: Schema Serialization (Advanced)
```typescript
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export class MyDto {
  static schema: SchemaObject = {
    type: 'object',
    properties: { ... },
    example: { ... }
  };
}
```

---

## 🚀 Deployment Steps

### 1. Update Source Code
```bash
# Update all 9 DTOs with @ApiProperty examples
# Test locally first
npm run start:dev

# Check http://localhost:3000/api/docs-json
# Verify schemas have "example" fields
```

### 2. Commit & Deploy
```bash
git add src/
git commit -m "feat: Add schema-level examples to DTOs for RapidAPI

Added example values to 9 DTO classes so OpenAPI spec
includes examples in component schemas (not just at
content level).

This ensures RapidAPI's code generator shows complete
request body examples with all required fields."

git push origin main

# Deploy to production
# (your deployment process)
```

### 3. Verify Production
```bash
curl -s https://pynpoint.codesense.in/api/docs-json | \
  python3 -c "
import json, sys
spec = json.load(sys.stdin)
schema = spec['components']['schemas']['CalculateDistanceDto']
print('Example:', schema.get('example'))
"

# Should output:
# Example: {'from': {'pincode': '110001'}, 'to': {'pincode': '400001'}, 'unit': 'km'}
```

### 4. Download & Upload to RapidAPI
```bash
# Download fresh from production
curl -s https://pynpoint.codesense.in/api/docs-json | \
  python3 -m json.tool > openapi-spec-rapidapi.json

# Upload to RapidAPI
# (via Dashboard → Definition tab)
```

---

## 📊 Expected Result

After deployment and RapidAPI upload:

```bash
curl --request POST \
  --url https://...rapidapi.com/api/v1/distance/calculate \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Host: ...' \
  --header 'X-RapidAPI-Key: ...' \
  --data '{"from":{"pincode":"110001"},"to":{"pincode":"400001"},"unit":"km"}'
```

✅ Complete data with all required fields!

---

## ❓ About the X-RapidAPI-Key Header

The missing `X-RapidAPI-Key` in your cURL preview is normal if:
- You're looking at static code examples (not "Test Endpoint")
- RapidAPI shows placeholders in documentation
- Real users see their actual key when they copy the code

To verify:
1. Click **"Test Endpoint"** button
2. Check the actual HTTP request headers
3. User's key should be there

---

## 📚 References

- NestJS Swagger: https://docs.nestjs.com/openapi/operations
- @ApiProperty: https://docs.nestjs.com/openapi/types-and-parameters
- @ApiBody: https://docs.nestjs.com/openapi/operations#request-payloads

---

**Next**: Update NestJS DTOs, deploy, then download & re-upload to RapidAPI! 🚀
