# Decoupled API Architecture - Summary

**Date**: 2026-06-14  
**Architecture**: Lean API Service + External Identity/Billing  
**Status**: Design Complete

---

## Key Changes from Original Design

### ❌ **Removed from PinPoint API Service**

1. **Customer Entity** - No customer management in API service
2. **Billing Logic** - No Stripe integration in API service
3. **Subscription Management** - No tier changes in API service
4. **User Authentication** - No user login/signup in API service
5. **Foreign Key Relationships** - API keys reference external customer IDs

### ✅ **Retained in PinPoint API Service**

1. **API Key Storage** - Store keys with `external_customer_id`
2. **API Key Validation** - Local validation using PostgreSQL + Redis cache
3. **Rate Limiting** - Tier-based limits enforced via Redis
4. **Usage Tracking** - ApiUsage table for analytics
5. **Admin API** - Endpoints for main website to provision/revoke keys

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              Main Website / Developer Portal                  │
│                                                               │
│  Responsibilities:                                            │
│  - User registration & authentication (NextAuth.js)          │
│  - Billing & subscriptions (Stripe)                          │
│  - API key management UI                                     │
│  - Developer playground                                      │
│  - Usage analytics dashboard                                 │
│                                                               │
│  Database:                                                    │
│  - User profiles (email, name, company)                      │
│  - Subscriptions (Stripe customer/subscription IDs)          │
│  - API key prefixes (for display, not full keys)             │
│                                                               │
│  When user subscribes to Pro:                                │
│  1. Create Stripe subscription                               │
│  2. Call PinPoint Admin API to provision key                 │
│  3. Store key prefix in user profile                         │
│  4. Display full key to user ONCE                            │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Admin API
                     │ POST /admin/api-keys
                     │ Auth: X-Admin-Secret
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│             PinPoint API Service (NestJS)                     │
│                                                               │
│  Responsibilities:                                            │
│  - Validate API keys (PostgreSQL + Redis cache)              │
│  - Enforce rate limits (Redis token bucket)                  │
│  - Track usage (ApiUsage table)                              │
│  - Provide admin API for key provisioning                    │
│                                                               │
│  Database (PostgreSQL):                                       │
│  - api_keys table                                            │
│    - id, external_customer_id, prefix, key_hash             │
│    - tier, environment, is_active                            │
│    - rate_limit_overrides (optional custom limits)           │
│    - metadata (name, allowed_ips, scopes)                    │
│                                                               │
│  - api_usage table                                           │
│    - external_customer_id, date, endpoint                    │
│    - request_count, success_count, error_count               │
│                                                               │
│  NO Customer table!                                           │
│  NO foreign key relationship!                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema Comparison

### Before (Coupled)

```typescript
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  tier: string;

  @Column({ type: 'jsonb' })
  stripeMetadata: { customerId, subscriptionId };
  
  @OneToMany(() => ApiKey)
  apiKeys: ApiKey[];
}

@Entity('api_keys')
export class ApiKey {
  @ManyToOne(() => Customer)
  customer: Customer;
  
  @Column()
  customer_id: string;  // FK to customers table
}
```

### After (Decoupled)

```typescript
// NO Customer entity in PinPoint API service

@Entity('api_keys')
export class ApiKey {
  // NO relationship - just a string reference
  @Column()
  external_customer_id: string;  // ID from main website
  
  // Tier stored locally for fast lookup
  @Column()
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  
  // Optional per-key rate limit overrides
  @Column({ type: 'jsonb', nullable: true })
  rate_limit_overrides: {
    requests_per_minute?: number;
    requests_per_day?: number;
  };
}
```

---

## Key Provisioning Flow

```
Main Website                    PinPoint API Service
     │                                  │
     │  User clicks "Generate API Key"  │
     │                                  │
     ├─────────────────────────────────►│
     │  POST /admin/api-keys             │
     │  Headers:                         │
     │    X-Admin-Secret: <secret>       │
     │  Body:                            │
     │  {                                │
     │    external_customer_id: "cus_xyz123",
     │    tier: "pro",                   │
     │    environment: "live",           │
     │    rate_limit_overrides: {        │
     │      requests_per_minute: 200     │
     │    }                              │
     │  }                                │
     │                                  │
     │                               1. Generate
     │                                  random key
     │                               2. Calculate
     │                                  checksum
     │                               3. Hash with
     │                                  SHA-256
     │                               4. Store in
     │                                  DB
     │◄─────────────────────────────────┤
     │  {                                │
     │    key: "ppk_live_sk_a8f2...c4f9",│
     │    prefix: "ppk_live_sk_a8f",    │
     │    id: "uuid"                    │
     │  }                                │
     │                                  │
     │  Store in website DB:             │
     │  - prefix (for display)           │
     │  - key_id (for revocation)        │
     │                                  │
     │  Show full key to user ONCE       │
```

---

## Performance Benefits

| Operation | Coupled | Decoupled | Improvement |
|-----------|---------|-----------|-------------|
| **API Key Validation** | 2 DB queries (keys + customers) | 1 DB query (keys only) | 50% faster |
| **Cache Payload** | ~500 bytes (customer data) | ~200 bytes (key data only) | 60% smaller |
| **Rate Limit Lookup** | Query customer tier | Read from api_keys.tier | Cached in key |
| **Deployment** | Full migration for schema changes | API service independent | Isolated deploys |

---

## Responsibilities by Component

### Main Website (Developer Portal)

| Feature | Tech Stack | Database |
|---------|-----------|----------|
| User auth | NextAuth.js | User profiles |
| Billing | Stripe | Subscriptions |
| Key UI | React | API key prefixes |
| Playground | Swagger UI | Temp tokens |
| Analytics | Charts.js | Read from ApiUsage |

### PinPoint API Service

| Feature | Tech Stack | Database |
|---------|-----------|----------|
| Key validation | NestJS Guards | api_keys + Redis (cache) |
| Rate limiting | Redis (cache) | Token buckets |
| Usage tracking | PostgreSQL | api_usage |
| Admin API | NestJS Controllers | api_keys |
| H3 Spatial Index | Redis (persistent) | 32.5M hexagons |

---

## Security Model

**Admin API Protection:**

```typescript
// PinPoint API Service
@UseGuards(AdminAuthGuard)
export class AdminApiKeyController {
  // Only main website can call this
}

@Injectable()
export class AdminAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const adminSecret = request.headers['x-admin-secret'];
    return adminSecret === process.env.ADMIN_API_SECRET;
  }
}
```

**Environment Variables:**
```bash
# PinPoint API Service
ADMIN_API_SECRET=<long-random-string-shared-with-main-website>

# Main Website
PINPOINT_ADMIN_SECRET=<same-long-random-string>
PINPOINT_API_URL=https://api.pinpointindia.com
```

---

## Migration Path

### Phase 1: Implement Lean API Service (This Service)
- [x] Create ApiKey entity (no Customer entity)
- [x] Create ApiUsage entity
- [ ] Implement ApiKeyService (generate, validate, revoke)
- [ ] Implement Admin API (provision, update tier, revoke)
- [ ] Implement Guards and rate limiting
- [ ] Deploy to Railway

### Phase 2: Build Main Website (Separate Project)
- [ ] Set up Next.js + NextAuth.js
- [ ] Integrate Stripe for subscriptions
- [ ] Build developer portal UI
- [ ] Implement admin API client
- [ ] Build usage analytics dashboard
- [ ] Deploy to Vercel/Netlify

---

## Benefits of Decoupling

✅ **Simplicity** - API service has 1 job: validate keys and serve data  
✅ **Performance** - No joins, faster validation, smaller cache  
✅ **Scalability** - API service can scale independently  
✅ **Security** - Customer data isolated from API service  
✅ **Flexibility** - Main website can change auth providers without touching API  
✅ **Deployment** - Independent deployments for API and website  

---

## Summary

The refactored architecture removes all customer management logic from the PinPoint API service, making it a lean, high-performance gateway focused solely on:

1. Validating API keys (local cache, <1ms)
2. Enforcing rate limits (Redis, <1ms)
3. Tracking usage (PostgreSQL)
4. Providing admin API for key provisioning

The main website handles all customer-facing features (identity, billing, UI) and calls the admin API to provision keys. This results in faster API validation, simpler codebase, and independent scalability.

