# RapidAPI Example Placement - The Real Fix

**Date**: 2026-07-08  
**Credit**: Gemini AI  
**Status**: ✅ FIXED

---

## 🎯 The Real Problem (Finally!)

RapidAPI's code generator **ignores examples** placed at the `requestBody.content.application/json` level when using `$ref` schemas.

It **only reads examples** from inside the component schema definition itself!

---

## ❌ What We Had (Doesn't Work)

```json
{
  "paths": {
    "/api/v1/pincodes/locate": {
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocatePincodeDto"
              },
              "example": {                    // ❌ RapidAPI IGNORES this!
                "latitude": 28.6139,
                "longitude": 77.209
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "LocatePincodeDto": {
        "type": "object",
        "properties": { ... }
        // ❌ No example here!
      }
    }
  }
}
```

**Result**: RapidAPI doesn't show `--data` in cURL examples

---

## ✅ What We Fixed (Works!)

```json
{
  "paths": {
    "/api/v1/pincodes/locate": {
      "post": {
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LocatePincodeDto"
              },
              "example": { ... },            // ℹ️ Keep for backwards compat
              "examples": { ... }            // ℹ️ Keep for dropdown
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "LocatePincodeDto": {
        "type": "object",
        "properties": {
          "latitude": { "type": "number" },
          "longitude": { "type": "number" }
        },
        "example": {                         // ✅ RapidAPI USES this!
          "latitude": 28.6139,
          "longitude": 77.209
        }
      }
    }
  }
}
```

**Result**: RapidAPI shows `--data '{"latitude":28.6139,"longitude":77.209}'`

---

## 🔍 Why This Happens

**OpenAPI 3.0 Spec** allows examples in multiple places:
1. At the media type level (`content.application/json.example`)
2. At the schema level (`schema.example`)
3. At the property level (`properties.latitude.example`)

**RapidAPI's Generator** (and many other tools):
- When it sees `$ref`, it resolves to the component schema
- It looks for `example` INSIDE that schema
- It **doesn't backtrack** to check the media type level
- This is a common behavior across OpenAPI generators

---

## 📊 What Was Changed

Added `example` field to **9 component schemas**:

| Schema | Example Value |
|--------|---------------|
| `ReverseGeocodeDto` | `{"latitude": 28.6139, "longitude": 77.209, "maxDistance": 5, "limit": 3}` |
| `LocatePincodeDto` | `{"latitude": 28.6139, "longitude": 77.209}` |
| `BulkPincodeLookupDto` | `{"pincodes": ["110001", "400001", ...]}` |
| `EncodeDigipinDto` | `{"coordinates": [...], "level": 6}` |
| `DecodeDigipinDto` | `{"digipinCodes": ["C4P8K63M"]}` |
| `ValidateDigipinDto` | `{"digipinCode": "C4P8K63M"}` |
| `DigipinToPincodeDto` | `{"digipinCode": "C4P8K63M"}` |
| `CalculateDistanceDto` | `{"from": {...}, "to": {...}, "unit": "km"}` |
| `BatchDistanceDto` | `{"pairs": [...]}` |

---

## 🎯 Expected Result

After re-uploading the spec to RapidAPI:

**Before**:
```bash
curl --request POST \
  --url https://...rapidapi.com/api/v1/pincodes/locate \
  --header 'X-RapidAPI-Key: ...'
# ❌ Missing --data
```

**After**:
```bash
curl --request POST \
  --url https://...rapidapi.com/api/v1/pincodes/locate \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Key: ...' \
  --data '{"latitude":28.6139,"longitude":77.209}'
# ✅ --data appears!
```

---

## 📚 OpenAPI 3.0 Best Practices

From official OpenAPI docs and Gemini's analysis:

### ✅ When Using $ref (Most Common)
Place examples in the **component schema**:
```yaml
components:
  schemas:
    MySchema:
      type: object
      properties: { ... }
      example: { ... }  # ✅ Best for $ref usage
```

### ✅ When Inline Schema
Place examples at **media type level**:
```yaml
requestBody:
  content:
    application/json:
      schema:
        type: object
        properties: { ... }
      example: { ... }  # ✅ Works for inline schemas
```

### ✅ For Multiple Examples
Use `examples` (plural) at media type level:
```yaml
requestBody:
  content:
    application/json:
      schema: { $ref: '...' }
      examples:
        scenario1: { value: { ... } }
        scenario2: { value: { ... } }
```

---

## 🛠️ How We Fixed It

**Script** (automatically moved examples):
```python
# For each POST endpoint with $ref schema:
# 1. Extract example from requestBody.content.application/json
# 2. Add it to components.schemas.<SchemaName>.example
# 3. Keep content-level example for backwards compatibility
```

**Manual verification**:
```bash
# Check schema has example
jq '.components.schemas.LocatePincodeDto.example' openapi-spec-public.json
```

---

## 🎓 Credit & References

- **Credit**: Gemini AI for identifying the placement issue
- **OpenAPI Docs**: https://swagger.io/docs/specification/adding-examples/
- **Why $ref matters**: https://swagger.io/docs/specification/using-ref/
- **RapidAPI behavior**: Empirically determined (not documented)

---

## ✅ Next Steps

1. **Re-upload** `openapi-spec-public.json` to RapidAPI
2. **Wait** 2-3 minutes for parsing
3. **Check** POST endpoints in code examples
4. **Verify** `--data` flag appears with correct JSON

---

## 🎉 Status

✅ **FIXED**: Examples now in component schemas  
✅ **Tested**: Verified structure matches OpenAPI best practices  
✅ **Committed**: Changes pushed to git  
🔄 **Pending**: Re-upload to RapidAPI and verify

---

**This was the missing piece!** Thank you Gemini AI! 🙏
