# RapidAPI Setup Guide

Complete guide to configure and test your API on RapidAPI marketplace.

---

## 🎯 Current Status

✅ OpenAPI spec uploaded to RapidAPI  
✅ 36 endpoints discovered  
⏳ **NEXT**: Configure proxy secret and test endpoints  

---

## Step 1: Get RapidAPI Proxy Secret

### Where to Find It:
1. Go to your RapidAPI Provider Dashboard
2. Navigate to your API: **"Pinpoint India - Pincode Digipin"**
3. Look for one of these tabs:
   - **Settings** → Security
   - **Security** → Proxy Secret
   - **Configuration** → Authentication
4. Find field labeled: **"X-RapidAPI-Proxy-Secret"** or **"Proxy Secret"**
5. Copy the secret value (long alphanumeric string)

**Example format:** `abc123def456...` (typically 32-64 characters)

---

## Step 2: Store Secret in Database

### Connect to PostgreSQL:
```bash
psql -h your-database-host -U your-database-user -d pynpoint_db
```

### Insert the Secret:
```sql
INSERT INTO marketplace_configs (
  marketplace_id,
  marketplace_name,
  secret_key,
  is_active,
  header_name,
  user_header_name,
  notes,
  created_at,
  updated_at
) VALUES (
  'rapidapi',
  'RapidAPI',
  'YOUR_RAPIDAPI_PROXY_SECRET_HERE',  -- Replace with actual secret
  true,
  'x-rapidapi-proxy-secret',
  'x-rapidapi-user',
  'Production RapidAPI proxy secret - configured 2026-07-04',
  NOW(),
  NOW()
);
```

### Verify:
```sql
SELECT marketplace_id, marketplace_name, is_active, header_name
FROM marketplace_configs
WHERE marketplace_id = 'rapidapi';
```

**Expected output:**
```
 marketplace_id | marketplace_name | is_active |       header_name
----------------+------------------+-----------+--------------------------
 rapidapi       | RapidAPI         | t         | x-rapidapi-proxy-secret
```

---

## Step 3: Restart Application

The secret is cached on startup, so you must restart:

```bash
# If using PM2
pm2 restart pynpoint

# If using systemd
sudo systemctl restart pynpoint

# If using Docker
docker restart pynpoint-container
```

---

## Step 4: Test Endpoints in RapidAPI

### Understanding the RapidAPI Interface:

**Column 1**: Navigation tabs (Requests, Tests, Hub Listing)  
**Column 2**: Endpoint list (click to select)  
**Column 3**: Request configuration (edit examples)  
**Column 4**: Response preview (test results)  

### Test These Endpoints:

#### ✅ **Test 1: Simple GET**
- **Endpoint**: `GET /api/v1/pincodes/110001`
- **Expected**: 200 OK with pincode details
- **No body needed**

#### ✅ **Test 2: Reverse Geocode**
- **Endpoint**: `POST /api/v1/pincodes/reverse-geocode`
- **Body**:
  ```json
  {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "limit": 3
  }
  ```
- **Expected**: 200 OK with nearest pincodes

#### ✅ **Test 3: Encode DIGIPIN**
- **Endpoint**: `POST /api/v1/digipin/encode`
- **Body**:
  ```json
  {
    "coordinates": [
      {"latitude": 28.6139, "longitude": 77.2090}
    ],
    "level": 6
  }
  ```
- **Expected**: 200 OK with DIGIPIN code

#### ✅ **Test 4: Calculate Distance**
- **Endpoint**: `POST /api/v1/distance/calculate`
- **Body**:
  ```json
  {
    "from": {"pincode": "110001"},
    "to": {"pincode": "400001"},
    "unit": "km"
  }
  ```
- **Expected**: 200 OK with distance calculation

---

## Step 5: Fix Example Scripts

### Common Issues in RapidAPI's Generated Examples:

#### ❌ **Problem**: Empty query params on POST
```bash
# WRONG
--url 'https://...com/api/v1/pincodes/reverse-geocode?=&='
```

#### ✅ **Fix**: Remove empty params
```bash
# CORRECT
--url 'https://...com/api/v1/pincodes/reverse-geocode'
```

### How to Fix:
1. Click endpoint in Column 2
2. In Column 3, look for the cURL/code example
3. Edit the URL to remove `?=&=`
4. Add proper request body for POST endpoints
5. Click **"Test Endpoint"** to verify

---

## Troubleshooting

### ❌ **401 Unauthorized**
**Cause**: Proxy secret not configured or incorrect  
**Fix**: Double-check secret in database matches RapidAPI dashboard

### ❌ **403 Forbidden**
**Cause**: `MarketplaceProxyGuard` rejecting request  
**Fix**: Verify header name is `x-rapidapi-proxy-secret` (lowercase)

### ❌ **404 Not Found**
**Cause**: Endpoint path incorrect  
**Fix**: Ensure path starts with `/api/v1/`

### ❌ **500 Internal Server Error**
**Cause**: Application not restarted after secret added  
**Fix**: Restart the application

---

## Security Notes

🔒 **Never expose the proxy secret publicly**  
🔒 **Rotate secret periodically** (add new row with `is_active=true`, set old to `false`)  
🔒 **Monitor logs** for unauthorized access attempts  

---

## Next Steps

After successful testing:

1. ✅ **Configure Pricing Plans** in RapidAPI dashboard
2. ✅ **Update Hub Listing** with marketing content from `docs/marketing/RAPIDAPI_LONG_DESCRIPTION.md`
3. ✅ **Set up monitoring** to track API usage
4. ✅ **Submit for review** (if required by RapidAPI)
5. ✅ **Publish** to marketplace!

---

**Ready to test?** Start with Test 1 (GET pincode) - it's the simplest! 🚀
