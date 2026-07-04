# RapidAPI Test: Remove Examples from One Endpoint

**Date**: 2026-07-04  
**Purpose**: Isolate if examples format is causing UUID error  
**Status**: ⏳ Awaiting test results

---

## 🧪 Test Configuration

### Modified Endpoint (TEST)

**Endpoint**: `POST /api/v1/pincodes/reverse-geocode`

**Change**: Removed all request body examples

**Before**:
```json
{
  "requestBody": {
    "content": {
      "application/json": {
        "schema": { "$ref": "#/components/schemas/ReverseGeocodeDto" },
        "examples": {
          "delhi-center": {
            "summary": "Find pincodes near Delhi center",
            "value": { "latitude": 28.6139, "longitude": 77.209, "maxDistance": 5, "limit": 3 }
          },
          "mumbai-gateway": {
            "summary": "Find pincodes near Gateway of India",
            "value": { "latitude": 18.922, "longitude": 72.8347, "maxDistance": 10, "limit": 1 }
          }
        }
      }
    }
  }
}
```

**After**:
```json
{
  "requestBody": {
    "content": {
      "application/json": {
        "schema": { "$ref": "#/components/schemas/ReverseGeocodeDto" }
        // No examples field
      }
    }
  }
}
```

---

### Control Endpoints (UNCHANGED)

These **still have examples** for comparison:

1. `POST /api/v1/pincodes/locate` - 2 examples
2. `POST /api/v1/pincodes/bulk/lookup` - 2 examples
3. `POST /api/v1/digipin/encode` - 3 examples
4. `POST /api/v1/digipin/decode` - 2 examples
5. `POST /api/v1/digipin/validate` - 1 example
6. `POST /api/v1/digipin/to-pincode` - 1 example
7. `POST /api/v1/distance/calculate` - 3 examples
8. `POST /api/v1/distance/batch` - 1 example

**Total**: 8 control endpoints, 15 examples remaining

---

## 📋 Test Procedure

### 1. Upload Modified Spec

```bash
# Upload pynpoint/openapi-spec-public.json to RapidAPI
# Dashboard → Your API → Definition tab → Upload File
```

### 2. Wait for Processing

- Wait **2-3 minutes** for RapidAPI to parse and cache
- Check "Last Updated" timestamp to confirm upload

### 3. Check Code Examples

Navigate to each endpoint and check "Code Examples" tab:

**Test Endpoint**: `POST /pincodes/reverse-geocode`
- ❓ Does it show the UUID error?
- ❓ Does it show any code example?
- ❓ Is the example different from before?

**Control Endpoints**: All other POST endpoints
- ❓ Do they still show the UUID error?
- ❓ Do examples appear in dropdown?
- ❓ Are they different from test endpoint?

---

## 🎯 Expected Results

### Scenario 1: UUID Error Gone for Test Endpoint Only

**Observation**:
- ✅ Test endpoint (reverse-geocode): Clean cURL, no UUID error
- ❌ Control endpoints (others): Still show UUID error

**Conclusion**: Examples format is causing the issue

**Next Steps**:
1. Check what's different about examples format
2. Try different example structure
3. Maybe use singular `example` instead of plural `examples`

---

### Scenario 2: UUID Error Persists for Test Endpoint

**Observation**:
- ❌ Test endpoint (reverse-geocode): Still shows UUID error
- ❌ Control endpoints (others): Still show UUID error

**Conclusion**: Examples are NOT the issue - it's a systemic RapidAPI bug

**Next Steps**:
1. Restore examples (they're not the problem)
2. Contact RapidAPI support
3. Try delete/recreate API

---

### Scenario 3: UUID Error Gone for ALL Endpoints

**Observation**:
- ✅ Test endpoint (reverse-geocode): No UUID error
- ✅ Control endpoints (others): No UUID error, examples work!

**Conclusion**: Re-uploading cleared the cache

**Next Steps**:
1. Restore examples to test endpoint
2. Re-upload final spec
3. Verify all examples work

---

### Scenario 4: Different Error or Behavior

**Document**:
- What error/message appears?
- Is it different from UUID error?
- Does it affect all endpoints or just some?

---

## 📊 Results Template

Fill this out after testing:

```
Date: [FILL IN]
Time: [FILL IN]

Test Endpoint (POST /pincodes/reverse-geocode):
- UUID Error? [YES/NO]
- Code Example Shown? [YES/NO]
- If yes, is it: [CLEAN/HAS ERROR]
- Screenshot: [ATTACH]

Control Endpoint 1 (POST /pincodes/locate):
- UUID Error? [YES/NO]
- Examples in dropdown? [YES/NO]
- Screenshot: [ATTACH]

Control Endpoint 2 (POST /digipin/encode):
- UUID Error? [YES/NO]
- Examples in dropdown? [YES/NO]
- Screenshot: [ATTACH]

Conclusion:
[SCENARIO 1/2/3/4]

Next Action:
[BASED ON SCENARIO ABOVE]
```

---

## 🔄 Restore Examples (If Needed)

If Scenario 2 (examples not the issue), restore with:

```python
import json

with open('pynpoint/openapi-spec-public.json', 'r') as f:
    spec = json.load(f)

# Restore examples
path = '/api/v1/pincodes/reverse-geocode'
rb = spec['paths'][path]['post']['requestBody']['content']['application/json']

rb['examples'] = {
    "delhi-center": {
        "summary": "Find pincodes near Delhi center",
        "description": "Search for up to 3 nearest pincodes within 5km of Connaught Place, Delhi",
        "value": {
            "latitude": 28.6139,
            "longitude": 77.209,
            "maxDistance": 5,
            "limit": 3
        }
    },
    "mumbai-gateway": {
        "summary": "Find pincodes near Gateway of India",
        "description": "Search for nearest pincode within 10km of Gateway of India, Mumbai",
        "value": {
            "latitude": 18.922,
            "longitude": 72.8347,
            "maxDistance": 10,
            "limit": 1
        }
    }
}

with open('pynpoint/openapi-spec-public.json', 'w') as f:
    json.dump(spec, f, indent=2)

print("✅ Examples restored")
```

---

## 📝 Notes

- This is a **scientific test** with control group
- Only ONE variable changed (examples on one endpoint)
- Other endpoints remain unchanged for comparison
- Results will definitively show if examples are the issue

---

**Status**: Ready for testing. Upload and report results! 🚀
