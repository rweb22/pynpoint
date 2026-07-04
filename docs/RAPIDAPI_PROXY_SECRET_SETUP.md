# 🔐 RapidAPI Proxy Secret Setup Guide

## Overview

The `X-RapidAPI-Proxy-Secret` must be stored in the **`marketplace_configs`** table to validate requests coming from RapidAPI's proxy servers.

---

## 📊 **Table: `marketplace_configs`**

### Schema

```sql
CREATE TABLE marketplace_configs (
  id UUID PRIMARY KEY,
  marketplace_id VARCHAR(50),              -- 'rapidapi'
  marketplace_name VARCHAR(100),           -- 'RapidAPI'
  secret_key VARCHAR(500),                 -- The X-RapidAPI-Proxy-Secret value
  is_active BOOLEAN DEFAULT true,          -- Must be true to validate
  header_name VARCHAR(100),                -- 'x-rapidapi-proxy-secret'
  user_header_name VARCHAR(100),           -- 'x-rapidapi-user'
  metadata JSONB,                          -- Optional additional config
  notes TEXT,                              -- Human-readable notes
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  rotated_at TIMESTAMP,                    -- When secret was last rotated
  expires_at TIMESTAMP                     -- Optional expiration
);
```

### Indexes
- `IDX_marketplace_configs_marketplace_id`
- `IDX_marketplace_configs_marketplace_id_is_active`

---

## 🚀 **How to Add RapidAPI Proxy Secret**

### Step 1: Get Your Proxy Secret from RapidAPI

1. Log in to RapidAPI Hub
2. Go to your API project
3. Navigate to **Settings** → **Proxy Configuration**
4. Copy the **`X-RapidAPI-Proxy-Secret`** value

**Example**: `aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789`

---

### Step 2: Update the Database

The migration has already created a placeholder record. You need to **update it** with the real secret.

#### **Option A: Direct SQL (Recommended)**

```sql
-- Update the existing RapidAPI config with your real secret
UPDATE marketplace_configs 
SET 
  secret_key = 'YOUR_ACTUAL_SECRET_FROM_RAPIDAPI',
  is_active = true,
  notes = 'RapidAPI proxy secret configured on 2026-07-04',
  updated_at = CURRENT_TIMESTAMP
WHERE marketplace_id = 'rapidapi';

-- Verify it was updated
SELECT 
  marketplace_id,
  marketplace_name,
  LEFT(secret_key, 10) || '...' as secret_preview,
  is_active,
  header_name,
  user_header_name,
  notes
FROM marketplace_configs
WHERE marketplace_id = 'rapidapi';
```

#### **Option B: Using the Service (Programmatic)**

```typescript
// In a script or admin endpoint
import { MarketplaceConfigService } from './src/auth/services/marketplace-config.service';

// Update existing config
await marketplaceConfigService.upsertConfig({
  marketplace_id: 'rapidapi',
  marketplace_name: 'RapidAPI',
  secret_key: 'YOUR_ACTUAL_SECRET_FROM_RAPIDAPI',
  is_active: true,
  header_name: 'x-rapidapi-proxy-secret',
  user_header_name: 'x-rapidapi-user',
  notes: 'RapidAPI proxy secret configured',
});
```

---

### Step 3: Verify Configuration

```sql
-- Check active marketplace configs
SELECT * FROM marketplace_configs WHERE is_active = true;

-- Should show:
-- marketplace_id: 'rapidapi'
-- marketplace_name: 'RapidAPI'
-- secret_key: 'YOUR_ACTUAL_SECRET'
-- is_active: true
-- header_name: 'x-rapidapi-proxy-secret'
-- user_header_name: 'x-rapidapi-user'
```

---

### Step 4: Restart Application

The marketplace configs are loaded into memory on application startup:

```bash
# Restart the application
pm2 restart pynpoint
# OR
docker-compose restart api
# OR
railway restart
```

**You should see in logs**:
```
[MarketplaceConfigService] Loading marketplace configurations from database...
[MarketplaceConfigService] Loaded marketplace config: RapidAPI (rapidapi) via x-rapidapi-proxy-secret
[MarketplaceConfigService] ✅ Loaded 1 active marketplace configuration(s) into memory
```

---

## 🔒 **How It Works**

### Request Flow

1. **User makes request via RapidAPI**:
   ```
   GET https://rapidapi.com/your-api/endpoint
   ```

2. **RapidAPI proxy adds headers**:
   ```
   GET https://pynpoint.codesense.in/api/v1/pincodes/110001
   X-RapidAPI-Proxy-Secret: aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789
   X-RapidAPI-User: user_12345
   ```

3. **Your API validates** (`MarketplaceProxyGuard`):
   ```typescript
   const secret = request.headers['x-rapidapi-proxy-secret'];
   const config = marketplaceConfigService.validateSecret(secret);
   
   if (!config) {
     throw new UnauthorizedException('Invalid marketplace proxy secret');
   }
   
   // Extract user ID
   const userId = request.headers[config.user_header_name]; // 'user_12345'
   ```

4. **Request is processed** as a valid marketplace request

---

## 🔄 **Secret Rotation (Future)**

When RapidAPI changes the proxy secret:

```typescript
// Rotate to new secret
await marketplaceConfigService.rotateSecret(
  'rapidapi',
  'NEW_SECRET_FROM_RAPIDAPI'
);
```

This will:
- Mark the old secret as `is_active = false`
- Create a new record with the new secret
- Reload the in-memory cache
- Keep old secret in database for audit

---

## ⚠️ **Security Best Practices**

### DO:
✅ Store secret in database (encrypted at rest)
✅ Load into memory on startup for fast validation
✅ Use environment variables for local development
✅ Rotate secrets periodically
✅ Keep audit trail (don't delete old records)

### DON'T:
❌ Hard-code secrets in source code
❌ Commit secrets to git
❌ Share secrets in plain text
❌ Expose secrets in logs or error messages

---

## 📝 **Quick Reference**

| Field | Value | Purpose |
|-------|-------|---------|
| `marketplace_id` | `rapidapi` | Unique identifier |
| `marketplace_name` | `RapidAPI` | Display name |
| `secret_key` | `YOUR_SECRET` | The actual secret from RapidAPI dashboard |
| `is_active` | `true` | Must be true to validate requests |
| `header_name` | `x-rapidapi-proxy-secret` | Header containing the secret |
| `user_header_name` | `x-rapidapi-user` | Header containing the end-user ID |

---

**Next Step**: Once the secret is configured, test it by making a request through RapidAPI's test console.
