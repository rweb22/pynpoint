# RapidAPI Manual Examples - Copy/Paste Ready

**Quick fix**: Manually add these `--data` payloads to each POST endpoint in RapidAPI

---

## 📋 **9 POST Endpoints - Request Bodies**

### 1. POST `/api/v1/pincodes/reverse-geocode`
**Description**: Find nearest pincode(s) by distance

```json
{
  "latitude": 28.6139,
  "longitude": 77.209,
  "maxDistance": 5,
  "limit": 3
}
```

**Full cURL**:
```bash
--data '{"latitude":28.6139,"longitude":77.209,"maxDistance":5,"limit":3}'
```

---

### 2. POST `/api/v1/pincodes/locate`
**Description**: Find pincode from GPS coordinates

```json
{
  "latitude": 28.6139,
  "longitude": 77.209
}
```

**Full cURL**:
```bash
--data '{"latitude":28.6139,"longitude":77.209}'
```

---

### 3. POST `/api/v1/pincodes/bulk/lookup`
**Description**: Bulk pincode lookup

```json
{
  "pincodes": ["110001", "400001", "560001", "700001"],
  "includePostOffices": false
}
```

**Full cURL**:
```bash
--data '{"pincodes":["110001","400001","560001","700001"],"includePostOffices":false}'
```

---

### 4. POST `/api/v1/digipin/encode`
**Description**: Encode coordinates to DIGIPIN

```json
{
  "coordinates": [
    {"latitude": 28.6139, "longitude": 77.209}
  ],
  "level": 6
}
```

**Full cURL**:
```bash
--data '{"coordinates":[{"latitude":28.6139,"longitude":77.209}],"level":6}'
```

---

### 5. POST `/api/v1/digipin/decode`
**Description**: Decode DIGIPIN to coordinates

```json
{
  "digipinCodes": ["C4P8K63M"]
}
```

**Full cURL**:
```bash
--data '{"digipinCodes":["C4P8K63M"]}'
```

---

### 6. POST `/api/v1/digipin/validate`
**Description**: Validate DIGIPIN code

```json
{
  "digipinCode": "C4P8K63M"
}
```

**Full cURL**:
```bash
--data '{"digipinCode":"C4P8K63M"}'
```

---

### 7. POST `/api/v1/digipin/to-pincode`
**Description**: Convert DIGIPIN to pincode

```json
{
  "digipinCode": "C4P8K63M"
}
```

**Full cURL**:
```bash
--data '{"digipinCode":"C4P8K63M"}'
```

---

### 8. POST `/api/v1/distance/calculate`
**Description**: Calculate distance between two locations

```json
{
  "from": {"pincode": "110001"},
  "to": {"pincode": "400001"},
  "unit": "km"
}
```

**Full cURL**:
```bash
--data '{"from":{"pincode":"110001"},"to":{"pincode":"400001"},"unit":"km"}'
```

---

### 9. POST `/api/v1/distance/batch`
**Description**: Batch distance calculation

```json
{
  "pairs": [
    {"from": {"pincode": "110001"}, "to": {"pincode": "400001"}},
    {"from": {"pincode": "110001"}, "to": {"pincode": "560001"}},
    {"from": {"pincode": "110001"}, "to": {"pincode": "700001"}}
  ],
  "unit": "km"
}
```

**Full cURL**:
```bash
--data '{"pairs":[{"from":{"pincode":"110001"},"to":{"pincode":"400001"}},{"from":{"pincode":"110001"},"to":{"pincode":"560001"}},{"from":{"pincode":"110001"},"to":{"pincode":"700001"}}],"unit":"km"}'
```

---

## 🔧 **How to Manually Add in RapidAPI**

### Option A: Edit Code Snippets (if allowed)
1. Go to each POST endpoint in RapidAPI
2. Find **Code Snippets** section
3. Edit the **Shell - cURL** example
4. Add the `--data` line from above

### Option B: Add to Endpoint Description
1. Go to each POST endpoint
2. Edit the **Description**
3. Add example cURL at the bottom:

```markdown
**Example Request**:
```bash
curl --request POST \
  --url https://your-api.p.rapidapi.com/api/v1/pincodes/locate \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Host: your-api.p.rapidapi.com' \
  --header 'X-RapidAPI-Key: YOUR_KEY' \
  --data '{"latitude":28.6139,"longitude":77.209}'
```
```

### Option C: Add to "Try It" Default Values
1. Go to each POST endpoint
2. Find **Request Body** section in "Try It"
3. Set the **Default Example** to the JSON above

---

## ⚡ **Quick Copy List (JSON Only)**

Just the JSON bodies for quick copy/paste:

```
1. {"latitude":28.6139,"longitude":77.209,"maxDistance":5,"limit":3}
2. {"latitude":28.6139,"longitude":77.209}
3. {"pincodes":["110001","400001","560001","700001"],"includePostOffices":false}
4. {"coordinates":[{"latitude":28.6139,"longitude":77.209}],"level":6}
5. {"digipinCodes":["C4P8K63M"]}
6. {"digipinCode":"C4P8K63M"}
7. {"digipinCode":"C4P8K63M"}
8. {"from":{"pincode":"110001"},"to":{"pincode":"400001"},"unit":"km"}
9. {"pairs":[{"from":{"pincode":"110001"},"to":{"pincode":"400001"}},{"from":{"pincode":"110001"},"to":{"pincode":"560001"}},{"from":{"pincode":"110001"},"to":{"pincode":"700001"}}],"unit":"km"}
```

---

## ✅ **Complete cURL Template**

For any endpoint, use this template:

```bash
curl --request POST \
  --url https://pinpoint-india-pincode-digipin-geocoding-api.p.rapidapi.com/api/v1/[ENDPOINT] \
  --header 'Content-Type: application/json' \
  --header 'X-RapidAPI-Host: pinpoint-india-pincode-digipin-geocoding-api.p.rapidapi.com' \
  --header 'X-RapidAPI-Key: YOUR_KEY_HERE' \
  --data '[JSON_FROM_ABOVE]'
```

---

**Ready to copy/paste!** Just go through each POST endpoint in RapidAPI and add the corresponding `--data` payload. 🚀
