# API Distribution Architecture - Research Summary

**Date**: 2026-06-14  
**Status**: ✅ Research Complete - Ready for Implementation

---

## Executive Summary

This research defines a comprehensive API distribution architecture for PinPoint India supporting three consumption channels:

1. **Third-Party Marketplaces** (RapidAPI) - Proxy validation with revenue sharing
2. **Direct API Keys** - Custom authentication with tier-based quotas  
3. **Web Playground** - Temporary JWT tokens for interactive documentation

The architecture integrates cleanly with our existing NestJS/PostgreSQL/Redis stack and maintains the performance benefits of our H3 spatial indexing (sub-100ms reverse geocoding).

---

## Key Research Findings

### 1. RapidAPI Integration

**How It Works:**
- RapidAPI acts as reverse proxy between consumers and your API
- Validates `X-RapidAPI-Proxy-Secret` header (static secret per API)
- Handles billing, subscriptions, and quota enforcement server-side
- Takes 20% revenue share but provides 4M+ developer marketplace

**Implementation:**
- Simple guard validates proxy secret
- RapidAPI headers identify consumer: `X-RapidAPI-User`, `X-RapidAPI-Key`
- No custom payment processing needed
- Instant marketplace exposure

**Recommendation:** ✅ Implement as secondary distribution channel alongside direct API keys

---

### 2. Direct API Key System

**Format:** `ppk_{env}_{type}_{random}_{checksum}`

Example: `ppk_live_sk_a8f2e9c1b4d7f3e2_c4f9`

**Components:**
- `ppk_` - Prefix for leak detection (GitHub scanning)
- `live`/`test` - Environment separation
- `sk`/`pk` - Secret/Public key type
- Random: 20 chars (160-bit cryptographic entropy)
- Checksum: Luhn algorithm for fast validation

**Security:**
- Store SHA-256 hash only (never plaintext)
- Cache in Redis for 1 hour (avoid DB on every request)
- Support multiple active keys per customer (rotation)
- Optional IP whitelisting in metadata JSONB

**Performance:**
- Validation: <1ms (Redis cache hit)
- DB fallback: ~5ms (PostgreSQL with indexed prefix)
- Total auth overhead: ~2-5ms per request

---

### 3. Web Playground (Try-it-out)

**Pattern:** Short-lived JWT tokens similar to Google Maps Platform playground

**Characteristics:**
- 15-minute expiration (security)
- Limited scope: read-only access
- Redis allowlist (revocation capability)
- No persistent API key required
- Perfect for documentation demos

**Use Cases:**
- Interactive API docs
- Sales demos
- Developer onboarding
- Quick testing without signup

---

### 4. Subscription Tiers

| Tier | Monthly | Requests/Month | Per-Minute | Per-Second | Keys |
|------|---------|----------------|-----------|-----------|------|
| **Free** | $0 | 10,000 | 10 | 2 | 1 |
| **Pro** | $29 | 100,000 | 100 | 10 | 3 |
| **Business** | $99 | 1,000,000 | 500 | 50 | 10 |
| **Enterprise** | Custom | Unlimited | Custom | Custom | ∞ |

**Rate Limiting:**
- Redis token bucket (per-minute windows)
- Daily quota enforcement
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- 429 status code on exceeded

**Revenue Model:**
- Free: Lead generation & SEO
- Pro: Break-even tier (~50 customers = $1,450/mo)
- Business: Primary revenue driver
- Enterprise: High-margin custom contracts

**Target:** 500 Pro + 100 Business = **$24,500/month recurring revenue**

---

### 5. Competitive Analysis

**Google Maps Platform:**
- API Key authentication
- Per-second rate limiting (QPS)
- Interactive playground with temporary keys
- No third-party marketplace
- **Takeaway:** Simple keys > OAuth for location APIs

**Mapbox:**
- Access Token (similar to API keys)
- Per-minute rate limiting
- JWT-based playground
- Excellent developer docs
- **Takeaway:** Developer experience is critical differentiator

**OpenCage:**
- API Key authentication
- Daily quota (not per-minute)
- RapidAPI distribution
- Simple pricing tiers
- **Takeaway:** RapidAPI + direct keys is viable dual-channel strategy

**Stripe:**
- Secret Key format: `sk_live_...` (inspired our design)
- Test mode keys for development
- Comprehensive API reference
- **Takeaway:** Key rotation and test/live separation are must-haves

---

### 6. NestJS Implementation Patterns

**Guard Execution Order:**

```typescript
@Global()
@Module({
  providers: [
    { provide: APP_GUARD, useClass: RapidAPIGuard },        // 1st
    { provide: APP_GUARD, useClass: PlaygroundTokenGuard }, // 2nd
    { provide: APP_GUARD, useClass: ApiKeyGuard },          // 3rd
    { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor }, // 4th
  ],
})
export class AppModule {}
```

**Why This Order:**
1. RapidAPI guard checks if request from marketplace (skip other auth)
2. Playground guard validates JWT tokens (temporary access)
3. API Key guard validates production keys (primary auth)
4. Rate limit interceptor enforces quotas (after authentication)

**Benefits:**
- Single request flows through authentication chain
- Early exit on first successful auth
- Clean separation of concerns
- Easy to add new auth methods

---

### 7. Database Schema

**Three New Entities:**

1. **Customer** - User/organization account
   - id (UUID)
   - email (unique)
   - tier (enum: free/pro/business/enterprise)
   - Stripe metadata (subscriptionId, customerId)

2. **ApiKey** - API key records
   - id (UUID)
   - customer_id (FK to Customer)
   - prefix (indexed, e.g., "ppk_live_sk_a8f")
   - key_hash (SHA-256, never plaintext)
   - tier, environment, is_active
   - metadata (JSONB: name, allowed_ips, scopes)

3. **ApiUsage** - Usage analytics
   - customer_id, date, endpoint
   - request_count, success_count, error_count
   - avg_response_time_ms
   - status_codes (JSONB)

**Indexes:**
- ApiKey: prefix (partial match), customer_id, is_active
- ApiUsage: (customer_id, date), endpoint

---

### 8. Performance Optimization

**Caching Strategy:**

| Layer | Technology | TTL | Purpose |
|-------|-----------|-----|---------|
| API Key Validation | Redis | 1 hour | Avoid DB on every request |
| Rate Limit Counters | Redis | 1 min - 1 day | Token bucket |
| Pincode Lookups | Redis | 24 hours | Cache static data |
| H3 Spatial Index | Redis | Permanent | 32.5M hexagons |

**Expected Latency:**
- Auth overhead: 2-5ms
- Reverse geocoding: <10ms (H3 + PostgreSQL)
- Pincode lookup: <5ms (Redis cache)
- **Total**: <20ms end-to-end

**Scalability:**
- Stateless guards (horizontal scaling)
- Redis persistence (survive restarts)
- PostgreSQL connection pooling (10 max)
- Railway auto-scaling

---

### 9. Security Best Practices

| Aspect | Implementation |
|--------|----------------|
| **Key Storage** | SHA-256 hash only; never store plaintext |
| **Transmission** | HTTPS only (TLS 1.3 minimum) |
| **Leak Detection** | GitHub scanning for `ppk_` prefix |
| **Key Rotation** | Multiple active keys per customer |
| **IP Whitelisting** | Optional per-key in metadata |
| **Audit Logging** | Log operations, not key values |
| **Secret Management** | Railway variables or Vault |
| **CORS** | Strict origin validation |

---

### 10. Developer Portal Requirements

**Core Features:**
1. **Key Management** - Generate, revoke, rotate keys
2. **Usage Analytics** - Charts, endpoint stats, error rates
3. **Billing Dashboard** - Current tier, usage vs quota, invoices
4. **Interactive Docs** - OpenAPI/Swagger with playground
5. **Code Samples** - curl, Python, JavaScript, Go

**Technology Stack:**
- Frontend: Next.js 14 + React Server Components
- Backend: PinPoint API + admin endpoints
- Auth: NextAuth.js (Google/GitHub OAuth)
- Payments: Stripe
- Docs: OpenAPI 3.1 + Swagger UI

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Database schema (Customer, ApiKey, ApiUsage)
- [ ] ApiKeyService (generate, validate, revoke)
- [ ] Unit tests

### Phase 2: Authentication (Weeks 3-4)
- [ ] Guards (RapidAPI, ApiKey, Playground)
- [ ] RateLimitInterceptor
- [ ] Integration tests

### Phase 3: API Endpoints (Week 5)
- [ ] AuthController (key CRUD)
- [ ] Update existing endpoints (require auth)
- [ ] Add @Public() to health checks

### Phase 4: Developer Portal (Weeks 6-8)
- [ ] Next.js frontend
- [ ] Stripe integration
- [ ] Usage analytics
- [ ] Interactive docs

### Phase 5: Production (Weeks 9-10)
- [ ] Load testing (1000+ req/s)
- [ ] Security audit
- [ ] Monitoring & alerting
- [ ] Documentation

**Total Effort:** 6-8 weeks (1-2 developers)

---

## Cost-Benefit Analysis

### Infrastructure Costs

| Component | Tier | Monthly |
|-----------|------|---------|
| API Service | Pro (8GB RAM) | $20 |
| PostgreSQL | Pro (10GB) | $15 |
| Redis | Pro (2GB) | $10 |
| **Total** | | **$45/month** |

### Revenue Projections

**Conservative (6 months):**
- 200 Free users (lead gen)
- 50 Pro ($29/mo) = $1,450
- 10 Business ($99/mo) = $990
- **Total:** $2,440/month

**Aggressive (12 months):**
- 1,000 Free users
- 500 Pro = $14,500
- 100 Business = $9,900
- 5 Enterprise (avg $500) = $2,500
- **Total:** $26,900/month

**Break-even:** ~50 Pro customers or 25 Business customers

---

## Documentation Deliverables

1. ✅ **Architecture Overview** - `docs/architecture/API_DISTRIBUTION_ARCHITECTURE.md` (23 pages)
2. ✅ **Implementation Guide** - `docs/implementation/API_AUTH_IMPLEMENTATION_GUIDE.md` (11 pages)
3. ✅ **Research Summary** - `API_DISTRIBUTION_RESEARCH_SUMMARY.md` (this document)

**Total:** 35+ pages of comprehensive documentation covering:
- Multi-channel authentication patterns
- RapidAPI integration
- API key design and security
- Web playground implementation
- Rate limiting and quota management
- Database schema and migrations
- NestJS guards and interceptors
- Developer portal requirements
- Comparative analysis (Google Maps, Mapbox, OpenCage, Stripe)
- Cost projections and revenue modeling

---

## Next Steps

1. **Review Documentation** - Team review of architecture decisions
2. **Prioritize Features** - Decide on Phase 1 scope
3. **Create Tickets** - Break down implementation guide into Jira tasks
4. **Assign Resources** - Allocate 1-2 developers for 6-8 weeks
5. **Begin Development** - Start with database schema and API key service

---

## Conclusion

The research provides a complete, production-ready blueprint for PinPoint India's API distribution strategy. The architecture:

✅ Supports three consumption channels (RapidAPI, Direct, Playground)  
✅ Integrates seamlessly with existing NestJS/PostgreSQL/Redis stack  
✅ Maintains sub-100ms performance for H3 spatial queries  
✅ Follows industry best practices (Google Maps, Stripe, Mapbox)  
✅ Provides clear monetization path ($24K+/month at scale)  
✅ Includes complete implementation guide with code examples  

**Ready for development!** 🚀

