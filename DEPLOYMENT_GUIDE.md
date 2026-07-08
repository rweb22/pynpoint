# Deployment Guide - Schema Examples Update

**Date**: 2026-07-08  
**Changes**: Added schema-level examples to DTOs for RapidAPI  
**Status**: Ready to deploy

---

## 📋 What Was Changed

Added schema-level examples to 9 request DTOs:
1. `ReverseGeocodeDto`
2. `LocatePincodeDto`
3. `BulkPincodeLookupDto`
4. `EncodeDigipinDto`
5. `DecodeDigipinDto`
6. `ValidateDigipinDto`
7. `DigipinToPincodeDto`
8. `CalculateDistanceDto`
9. `BatchDistanceDto`

---

## 🚀 Deployment Steps

### Step 1: Build the Application

```bash
cd pynpoint
npm run build
```

**Expected**: No errors, build completes successfully

---

### Step 2: Test Locally (Optional but Recommended)

```bash
npm run start:dev
```

Then verify the OpenAPI spec has schema examples:

```bash
curl -s http://localhost:3000/api/docs-json | \
  python3 -c "
import json, sys
spec = json.load(sys.stdin)

# Check a few schemas
schemas_to_check = ['CalculateDistanceDto', 'LocatePincodeDto', 'EncodeDigipinDto']

for schema_name in schemas_to_check:
    if schema_name in spec['components']['schemas']:
        schema = spec['components']['schemas'][schema_name]
        has_example = 'example' in schema
        print(f'{schema_name}: {\"✅\" if has_example else \"❌\"} example')
        if has_example:
            print(f'  {schema[\"example\"]}')
"
```

**Expected output**:
```
CalculateDistanceDto: ✅ example
  {'from': {'pincode': '110001'}, 'to': {'pincode': '400001'}, 'unit': 'km'}
LocatePincodeDto: ✅ example
  {'latitude': 28.6139, 'longitude': 77.209}
EncodeDigipinDto: ✅ example
  {'coordinates': [{'latitude': 28.6139, 'longitude': 77.209}], 'level': 6}
```

If you see ✅ for all three, you're good to go!

---

### Step 3: Deploy to Production

**Using PM2**:
```bash
git pull origin main
npm install  # If dependencies changed
npm run build
pm2 restart pynpoint
```

**Using Docker**:
```bash
git pull origin main
docker build -t pynpoint:latest .
docker stop pynpoint-container
docker rm pynpoint-container
docker run -d --name pynpoint-container -p 3000:3000 pynpoint:latest
```

**Using systemd**:
```bash
git pull origin main
npm install
npm run build
sudo systemctl restart pynpoint
```

---

### Step 4: Verify Production

```bash
curl -s https://pynpoint.codesense.in/api/docs-json | \
  python3 -c "
import json, sys
spec = json.load(sys.stdin)

# Check all 9 schemas
schemas = [
    'ReverseGeocodeDto',
    'LocatePincodeDto',
    'BulkPincodeLookupDto',
    'EncodeDigipinDto',
    'DecodeDigipinDto',
    'ValidateDigipinDto',
    'DigipinToPincodeDto',
    'CalculateDistanceDto',
    'BatchDistanceDto'
]

print('Schema Example Verification:')
print('='*60)

all_good = True
for schema_name in schemas:
    if schema_name in spec['components']['schemas']:
        schema = spec['components']['schemas'][schema_name]
        has_example = 'example' in schema
        status = '✅' if has_example else '❌'
        print(f'{status} {schema_name}')
        if not has_example:
            all_good = False

print('='*60)
if all_good:
    print('✅ All schemas have examples! Ready for RapidAPI!')
else:
    print('❌ Some schemas missing examples - check deployment')
"
```

**Expected**:
```
Schema Example Verification:
============================================================
✅ ReverseGeocodeDto
✅ LocatePincodeDto
✅ BulkPincodeLookupDto
✅ EncodeDigipinDto
✅ DecodeDigipinDto
✅ ValidateDigipinDto
✅ DigipinToPincodeDto
✅ CalculateDistanceDto
✅ BatchDistanceDto
============================================================
✅ All schemas have examples! Ready for RapidAPI!
```

---

### Step 5: Download Updated Spec

```bash
curl -s https://pynpoint.codesense.in/api/docs-json | \
  python3 -m json.tool > openapi-spec-rapidapi.json
```

**Verify it's complete**:
```bash
ls -lh openapi-spec-rapidapi.json
# Should be ~90KB or similar
```

---

### Step 6: Upload to RapidAPI

1. **Go to RapidAPI Provider Dashboard**
2. **Navigate to**: Your API → Definition tab
3. **Click**: "Upload Definition"
4. **Select**: `openapi-spec-rapidapi.json`
5. **Wait**: 2-3 minutes for parsing
6. **Check**: Any POST endpoint's code examples

**Expected cURL example**:
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

## ✅ Success Checklist

- [ ] Build successful (`npm run build`)
- [ ] Local test shows examples in schemas
- [ ] Deployed to production
- [ ] Production verification shows all 9 schemas with examples
- [ ] Downloaded updated OpenAPI spec
- [ ] Uploaded to RapidAPI
- [ ] RapidAPI shows complete `--data` in cURL examples

---

## 🐛 Troubleshooting

### Issue: Build fails

**Error**: TypeScript compilation errors

**Fix**:
```bash
npm install
npm run build
```

### Issue: Examples not showing locally

**Error**: Local spec doesn't have schema examples

**Cause**: Code not loaded properly

**Fix**:
```bash
rm -rf dist/
npm run build
npm run start:dev
```

### Issue: Examples not in production

**Error**: Production verification shows ❌

**Cause**: Deployment didn't complete

**Fix**:
```bash
pm2 logs pynpoint  # Check for errors
pm2 restart pynpoint
# Wait 30 seconds
curl https://pynpoint.codesense.in/api/docs-json | grep -c "example"
# Should show multiple matches
```

---

## 📚 What Changed Technically

**Before**:
```typescript
export class LocatePincodeDto {
  @ApiProperty({ example: 28.6139 })
  latitude: number;
  // No schema-level example
}
```

**After**:
```typescript
export class LocatePincodeDto {
  @ApiProperty({ example: 28.6139 })
  latitude: number;

  static schema = {
    example: { latitude: 28.6139, longitude: 77.209 }
  };
}
```

**In main.ts**: Code now reads `schema.example` and injects into OpenAPI document.

---

## 🎯 Impact

**OpenAPI Spec Change**:
```json
{
  "components": {
    "schemas": {
      "LocatePincodeDto": {
        "type": "object",
        "properties": { ... },
        "example": {              // ← Added by deployment
          "latitude": 28.6139,
          "longitude": 77.209
        }
      }
    }
  }
}
```

**RapidAPI Result**:
```bash
--data '{"latitude":28.6139,"longitude":77.209}'  # ← Complete!
```

---

**Ready to deploy!** 🚀
