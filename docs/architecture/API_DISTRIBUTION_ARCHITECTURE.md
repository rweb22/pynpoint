# API Distribution Architecture for PinPoint India

**Author**: Architecture Team  
**Date**: 2026-06-14  
**Status**: Design Complete - Ready for Implementation

---

## Executive Summary

This document outlines the comprehensive API consumption and distribution architecture for PinPoint India, supporting three primary access patterns:

1. **Third-Party Marketplaces** (RapidAPI) - Proxy validation with billing integration
2. **Direct Subscription Model** - Custom API keys with tier-based quotas
3. **Web Playground** - Temporary tokens for interactive documentation

The architecture integrates seamlessly with our existing NestJS/PostgreSQL/Redis/H3 stack while maintaining sub-100ms response times for reverse geocoding queries.

---

## Architecture Overview

### Multi-Channel Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Incoming API Requests                    │
└──────────────┬──────────────┬───────────────┬───────────────┘
               │              │               │
               ▼              ▼               ▼
      ┌────────────┐  ┌──────────┐   ┌──────────────┐
      │  RapidAPI  │  │  Direct  │   │  Playground  │
      │   Proxy    │  │ API Key  │   │     JWT      │
      └──────┬─────┘  └─────┬────┘   └──────┬───────┘
             │              │               │
             ▼              ▼               ▼
      ┌─────────────────────────────────────────────┐
      │        Authentication Guard Layer           │
      │  1. RapidAPI Guard (X-RapidAPI-Proxy-Secret)│
      │  2. API Key Guard (X-API-Key)               │
      │  3. Playground Guard (Bearer JWT)           │
      └──────────────────┬──────────────────────────┘
                         │
                         ▼
      ┌─────────────────────────────────────────────┐
      │         Rate Limit Interceptor              │
      │  - Redis token bucket per customer/tier     │
      │  - Free: 10/min | Pro: 100/min | Ent: 1000  │
      └──────────────────┬──────────────────────────┘
                         │
                         ▼
      ┌─────────────────────────────────────────────┐
      │           API Endpoints                      │
      │  - Reverse Geocoding (lat/lng → pincode)    │
      │  - Pincode Lookup (pincode → details)       │
      │  - Nearby Search (radius-based)             │
      └─────────────────────────────────────────────┘
```

---

## 1. Third-Party Marketplace Integration (RapidAPI)

### How RapidAPI Works

RapidAPI acts as a reverse proxy between consumers and your API:

1. Consumer makes request to RapidAPI: `https://pinpoint-india.p.rapidapi.com/pincode/110001`
2. RapidAPI runtime validates consumer's key, checks quotas, and adds headers:
   - `X-RapidAPI-Proxy-Secret`: Static secret (validates request is from RapidAPI)
   - `X-RapidAPI-User`: Consumer's user ID (for analytics)
   - `X-RapidAPI-Key`: Consumer's API key
3. RapidAPI forwards to your API: `https://api.pinpointindia.com/pincode/110001`
4. Your API validates `X-RapidAPI-Proxy-Secret` and processes request
5. RapidAPI handles billing, quota enforcement, and rate limiting

### Implementation Pattern

**Configuration:**
```typescript
// .env
RAPIDAPI_PROXY_SECRET=<unique-secret-from-rapidapi-dashboard>
RAPIDAPI_ENABLED=true
```

**Guard Implementation:**
```typescript
// src/auth/guards/rapidapi.guard.ts
@Injectable()
export class RapidAPIGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const enabled = this.configService.get('RAPIDAPI_ENABLED');
    
    // Skip if RapidAPI not enabled
    if (!enabled) return true;
    
    const proxySecret = request.headers['x-rapidapi-proxy-secret'];
    const expectedSecret = this.configService.get('RAPIDAPI_PROXY_SECRET');
    
    // If RapidAPI headers present, validate
    if (proxySecret) {
      if (proxySecret !== expectedSecret) {
        throw new UnauthorizedException('Invalid RapidAPI proxy secret');
      }
      
      // Mark as authenticated via RapidAPI
      request.authSource = 'rapidapi';
      request.user = {
        customerId: request.headers['x-rapidapi-user'],
        tier: 'rapidapi',  // RapidAPI handles their own tiers
        authType: 'rapidapi-proxy',
      };
      
      return true;
    }
    
    // Not a RapidAPI request, continue to next guard
    return true;
  }
}
```

**Benefits:**
- ✅ RapidAPI handles billing, subscription management, and chargebacks
- ✅ Automatic marketplace exposure to 4M+ developers
- ✅ Built-in analytics and API dashboard
- ✅ No custom payment processing needed

**Limitations:**
- ⚠️ RapidAPI takes 20% revenue share
- ⚠️ Less control over pricing tiers
- ⚠️ Cannot customize rate limits per consumer

---

## 2. Direct Subscription Model

### 2A. Web Playground (Try-it-out)

**Use Case:** Interactive docs at `https://docs.pinpointindia.com/playground`

**Pattern:** Short-lived JWT tokens with narrow scope, similar to Google Maps Platform playground.

**Implementation:**

```typescript
// src/auth/services/playground.service.ts
@Injectable()
export class PlaygroundService {
  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
  ) {}

  async generatePlaygroundToken(email?: string): Promise<string> {
    const customerId = email || 'anonymous';
    
    const token = this.jwtService.sign(
      {
        customerId,
        type: 'playground',
        scope: ['read:pincode', 'read:geocode'],  // Limited scope
        iat: Math.floor(Date.now() / 1000),
      },
      { expiresIn: '15m' }  // 15 minutes max
    );

    // Store in Redis for revocation capability
    await this.redisService.set(
      `playground:${token}`,
      customerId,
      'EX',
      900  // 15 minutes
    );

    return token;
  }

  async validateToken(token: string): Promise<{ customerId: string } | null> {
    try {
      const payload = this.jwtService.verify(token);
      
      // Check not revoked
      const customerId = await this.redisService.get(`playground:${token}`);
      if (!customerId) return null;
      
      return { customerId: payload.customerId };
    } catch {
      return null;
    }
  }
}
```

**Playground Guard:**
```typescript
@Injectable()
export class PlaygroundTokenGuard implements CanActivate {
  constructor(private playgroundService: PlaygroundService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Skip if already authenticated
    if (request.user) return true;
    
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) return true;
    
    const token = authHeader.substring(7);
    const user = await this.playgroundService.validateToken(token);
    
    if (user) {
      request.user = {
        customerId: user.customerId,
        tier: 'playground',
        authType: 'playground-token',
      };
      return true;
    }
    
    return true;  // Let other guards handle
  }
}
```

**Playground Endpoint:**
```typescript
@Controller('auth')
export class AuthController {
  @Post('playground-token')
  @Public()  // No auth required
  async createPlaygroundToken(): Promise<{ token: string; expiresIn: number }> {
    const token = await this.playgroundService.generatePlaygroundToken();
    return {
      token,
      expiresIn: 900,  // 15 minutes
    };
  }
}
```

**Rate Limits for Playground:**
- 5 requests per minute
- 50 requests per token lifetime
- No persistent storage across sessions

---

### 2B. Programmatic Access (API Keys)

**Use Case:** Production applications requiring reliable, high-volume access

**API Key Format:** `ppk_{env}_{type}_{random}_{checksum}`

Example: `ppk_live_sk_a8f2e9c1b4d7f3e2_c4f9`

**Components:**
- `ppk_` - Prefix (PinPoint Key)
- `live`/`test` - Environment
- `sk`/`pk` - Secret Key / Public Key
- Random: 20 chars (160-bit entropy)
- Checksum: Luhn algorithm (fast validation)

**Database Schema:**
```typescript
// src/database/entities/api-key.entity.ts
@Entity('api_keys')
@Index(['prefix'])
@Index(['customer_id'])
@Index(['is_active', 'expires_at'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer)
  customer: Customer;

  @Column()
  customer_id: string;

  @Column({ length: 15 })
  prefix: string;  // "ppk_live_sk_a8f" for display

  @Column()
  key_hash: string;  // SHA-256(full_key)

  @Column({ type: 'enum', enum: ['live', 'test'] })
  environment: 'live' | 'test';

  @Column({ type: 'enum', enum: ['free', 'pro', 'business', 'enterprise'] })
  tier: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: {
    name?: string;
    description?: string;
    allowed_ips?: string[];
    scopes?: string[];
  };
}
```

**API Key Service:**
```typescript
// src/auth/services/api-key.service.ts
@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey) private keyRepo: Repository<ApiKey>,
    private redisService: RedisService,
  ) {}

  async generateKey(
    customerId: string,
    tier: 'free' | 'pro' | 'business' | 'enterprise',
    environment: 'live' | 'test' = 'live'
  ): Promise<{ key: string; prefix: string }> {
    // Generate cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(20);
    const randomPart = randomBytes.toString('base64url').substring(0, 20);

    // Calculate Luhn checksum
    const checksum = this.calculateLuhnChecksum(randomPart);

    const fullKey = `ppk_${environment}_sk_${randomPart}_${checksum}`;
    const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const prefix = fullKey.substring(0, 15);  // "ppk_live_sk_a8f"

    const apiKey = this.keyRepo.create({
      customer_id: customerId,
      prefix,
      key_hash: keyHash,
      environment,
      tier,
      is_active: true,
    });

    await this.keyRepo.save(apiKey);

    // IMPORTANT: Return full key ONLY at creation time
    // Customer must store it securely - we can't recover it
    return { key: fullKey, prefix };
  }

  async validateKey(key: string): Promise<{
    customerId: string;
    tier: string;
    keyId: string;
  } | null> {
    // Quick format validation
    if (!key.startsWith('ppk_')) return null;

    const prefix = key.substring(0, 15);
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    // Check Redis cache first (hot path optimization)
    const cacheKey = `apikey:${prefix}`;
    const cached = await this.redisService.get(cacheKey);

    if (cached) {
      const data = JSON.parse(cached);
      if (data.key_hash === keyHash && data.is_active) {
        return {
          customerId: data.customer_id,
          tier: data.tier,
          keyId: data.id,
        };
      }
    }

    // Fall back to database
    const apiKey = await this.keyRepo.findOne({
      where: { prefix, is_active: true },
      relations: ['customer'],
    });

    if (!apiKey || apiKey.key_hash !== keyHash) return null;

    // Check expiration
    if (apiKey.expires_at && apiKey.expires_at < new Date()) {
      return null;
    }

    // Update last used timestamp (async, don't block)
    this.keyRepo.update(apiKey.id, { last_used_at: new Date() }).catch(() => {});

    // Cache for 1 hour
    await this.redisService.set(
      cacheKey,
      JSON.stringify({
        id: apiKey.id,
        customer_id: apiKey.customer_id,
        tier: apiKey.tier,
        key_hash: apiKey.key_hash,
        is_active: true,
      }),
      'EX',
      3600
    );

    return {
      customerId: apiKey.customer_id,
      tier: apiKey.tier,
      keyId: apiKey.id,
    };
  }

  async revokeKey(keyId: string): Promise<void> {
    const apiKey = await this.keyRepo.findOne({ where: { id: keyId } });
    if (!apiKey) throw new NotFoundException('API key not found');

    await this.keyRepo.update(keyId, { is_active: false });

    // Remove from cache
    await this.redisService.del(`apikey:${apiKey.prefix}`);
  }

  private calculateLuhnChecksum(data: string): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const digits = data.split('').map(c => chars.indexOf(c.toLowerCase()));

    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let digit = digits[i];
      if (i % 2 === 0) {
        digit *= 2;
        if (digit > 35) digit -= 35;
      }
      sum += digit;
    }

    const checkDigit = (36 - (sum % 36)) % 36;
    return chars[checkDigit];
  }
}
```

**API Key Guard:**
```typescript
// src/auth/guards/api-key.guard.ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    private apiKeyService: ApiKeyService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Skip for @Public() routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      'isPublic',
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    // Skip if already authenticated (RapidAPI or Playground)
    if (request.user) return true;

    // Extract API key from header
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      throw new UnauthorizedException({
        code: 'API_KEY_MISSING',
        message: 'API key required. Include X-API-Key header.',
      });
    }

    // Validate key
    const keyData = await this.apiKeyService.validateKey(apiKey);
    if (!keyData) {
      this.logger.warn(`Invalid API key: ${apiKey.substring(0, 15)}***`);
      throw new UnauthorizedException({
        code: 'API_KEY_INVALID',
        message: 'Invalid or expired API key',
      });
    }

    // Attach to request
    request.user = {
      customerId: keyData.customerId,
      tier: keyData.tier,
      keyId: keyData.keyId,
      authType: 'api-key',
    };

    return true;
  }
}
```

---

## 3. Rate Limiting & Quota Management

### Subscription Tiers

| Tier | Monthly Cost | Requests/Month | Per-Minute | Per-Second | Max Keys |
|------|--------------|----------------|-----------|-----------|----------|
| **Free** | $0 | 10,000 | 10 | 2 | 1 |
| **Pro** | $29 | 100,000 | 100 | 10 | 3 |
| **Business** | $99 | 1,000,000 | 500 | 50 | 10 |
| **Enterprise** | Custom | Unlimited | Custom | Custom | Unlimited |

### Rate Limit Interceptor

```typescript
// src/interceptors/rate-limit.interceptor.ts
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RateLimitInterceptor.name);

  private readonly tierLimits = {
    free: { perMinute: 10, perDay: 1000 },
    pro: { perMinute: 100, perDay: 100000 },
    business: { perMinute: 500, perDay: 1000000 },
    enterprise: { perMinute: 10000, perDay: null },
    playground: { perMinute: 5, perDay: 50 },
    rapidapi: { perMinute: null, perDay: null },  // RapidAPI handles limits
  };

  constructor(private redisService: RedisService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const user = request.user;
    if (!user) return next.handle();

    const tier = user.tier as keyof typeof this.tierLimits;
    const limits = this.tierLimits[tier] || this.tierLimits.free;

    // Skip rate limiting for RapidAPI (they handle it)
    if (tier === 'rapidapi') return next.handle();

    const now = Date.now();
    const minuteBucket = Math.floor(now / 60000);
    const dayBucket = Math.floor(now / 86400000);

    const minuteKey = `ratelimit:${user.customerId}:min:${minuteBucket}`;
    const dayKey = `ratelimit:${user.customerId}:day:${dayBucket}`;

    // Check per-minute limit
    if (limits.perMinute) {
      const minuteCount = await this.redisService.incr(minuteKey);
      if (minuteCount === 1) {
        await this.redisService.expire(minuteKey, 60);
      }

      if (minuteCount > limits.perMinute) {
        response.setHeader('X-RateLimit-Limit', String(limits.perMinute));
        response.setHeader('X-RateLimit-Remaining', '0');
        response.setHeader('X-RateLimit-Reset', String((minuteBucket + 1) * 60));

        throw new HttpException(
          {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded (per-minute)',
            limit: limits.perMinute,
            reset: (minuteBucket + 1) * 60,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Add rate limit headers
      response.setHeader('X-RateLimit-Limit', String(limits.perMinute));
      response.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, limits.perMinute - minuteCount))
      );
      response.setHeader('X-RateLimit-Reset', String((minuteBucket + 1) * 60));
    }

    // Check daily limit
    if (limits.perDay) {
      const dayCount = await this.redisService.incr(dayKey);
      if (dayCount === 1) {
        await this.redisService.expire(dayKey, 86400);
      }

      if (dayCount > limits.perDay) {
        throw new HttpException(
          {
            code: 'QUOTA_EXCEEDED',
            message: 'Daily quota exceeded',
            limit: limits.perDay,
            reset: (dayBucket + 1) * 86400,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return next.handle();
  }
}
```

---

## 4. Integration with Existing Stack

### Module Registration

```typescript
// src/app.module.ts
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    AuthModule,  // NEW: Authentication module
    // ... existing modules
  ],
  providers: [
    // Global guards (run in order)
    { provide: APP_GUARD, useClass: RapidAPIGuard },
    { provide: APP_GUARD, useClass: PlaygroundTokenGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },

    // Global interceptors
    { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
```

### Auth Module Structure

```typescript
// src/auth/auth.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, Customer]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [
    ApiKeyService,
    PlaygroundService,
    RapidAPIGuard,
    ApiKeyGuard,
    PlaygroundTokenGuard,
  ],
  controllers: [AuthController],
  exports: [ApiKeyService, PlaygroundService],
})
export class AuthModule {}
```

---

## 5. API Endpoints Example

```typescript
// src/pincode/pincode.controller.ts
@Controller('v1/pincode')
@UseGuards(ApiKeyGuard)  // Require authentication
export class PincodeController {
  constructor(private pincodeService: PincodeService) {}

  @Get(':pincode')
  async getPincode(
    @Param('pincode') pincode: string,
    @Request() req,
  ) {
    const result = await this.pincodeService.findByPincode(pincode);

    return {
      pincode: result.pincode,
      state: result.state,
      district: result.district,
      city: result.city,
      postOffices: result.postOffices,
      _meta: {
        requestId: req.id,
        tier: req.user.tier,
      },
    };
  }

  @Get('reverse')
  async reverseGeocode(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ) {
    // Use H3 spatial index for fast lookup
    const pincode = await this.pincodeService.reverseGeocode(lat, lng);
    return { pincode, location: { lat, lng } };
  }
}
```

---

## 6. Developer Portal Requirements

### API Dashboard Features

1. **Key Management**
   - Generate/revoke API keys
   - View key usage statistics
   - Rotate keys with grace period

2. **Usage Analytics**
   - Requests per day/week/month
   - Endpoint popularity
   - Error rate tracking
   - Response time percentiles

3. **Billing & Quotas**
   - Current tier and limits
   - Usage vs quota progress bars
   - Upgrade/downgrade options
   - Invoice history

4. **Interactive Docs**
   - Auto-generated OpenAPI/Swagger
   - Try-it-out with temporary tokens
   - Code samples (curl, Python, JavaScript, Go)
   - Response examples

### Technology Stack for Portal

- **Frontend**: Next.js 14 with React Server Components
- **Backend**: PinPoint API + dedicated admin API
- **Auth**: NextAuth.js with Google/GitHub OAuth
- **Payments**: Stripe for subscription management
- **Docs**: OpenAPI 3.1 + Swagger UI / Scalar

---

## 7. Security Considerations

### Best Practices

| Aspect | Implementation |
|--------|----------------|
| **Key Storage** | SHA-256 hash only; never store plaintext |
| **Transmission** | HTTPS only (TLS 1.3 minimum) |
| **Key Format** | Prefix for leak detection (GitHub scanning) |
| **Rotation** | Support multiple active keys per customer |
| **IP Whitelisting** | Optional per-key in metadata JSONB |
| **Audit Logging** | Log key operations (not key values) |
| **Secret Management** | Railway variables or HashiCorp Vault |
| **CORS** | Strict origin validation for playground |

### API Key Leak Detection

Monitor GitHub/GitLab for leaked keys using prefix:

```bash
# GitHub search API
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/code?q=ppk_live_sk"
```

Auto-revoke any keys found in public repos.

---

## 8. Performance Optimization

### Caching Strategy

| Layer | Technology | TTL | Purpose |
|-------|-----------|-----|---------|
| **API Key Validation** | Redis | 1 hour | Avoid DB lookup on every request |
| **Rate Limit Counters** | Redis | 1 min - 1 day | Token bucket implementation |
| **Pincode Lookups** | Redis | 24 hours | Cache static postal data |
| **H3 Index** | Redis | Permanent | 32.5M hexagons for reverse geocoding |

### Expected Performance

- **API Key Validation**: <1ms (Redis cache hit)
- **Rate Limit Check**: <1ms (Redis INCR)
- **Reverse Geocoding**: <10ms (H3 index + PostgreSQL)
- **Pincode Lookup**: <5ms (Redis cache or PostgreSQL)

**Total Request Overhead**: ~2-5ms for auth + rate limiting

---

## 9. Monitoring & Observability

### Metrics to Track

```typescript
// src/metrics/metrics.service.ts
@Injectable()
export class MetricsService {
  async recordRequest(data: {
    customerId: string;
    endpoint: string;
    statusCode: number;
    responseTime: number;
    tier: string;
  }) {
    // Store in TimescaleDB or Prometheus
    await this.metricsRepo.save({
      timestamp: new Date(),
      ...data,
    });

    // Increment Redis counters
    await this.redisService.incr(`metrics:${data.customerId}:requests:${today()}`);
  }
}
```

### Key Metrics

- Requests per second (per tier)
- P50/P95/P99 response times
- Error rate (4xx, 5xx)
- Cache hit rate (API keys, pincodes)
- Rate limit rejections
- Top consumers by volume

---

## 10. Migration Path

### Phase 1: Foundation (Weeks 1-2)
- [ ] Create database schema (ApiKey, Customer entities)
- [ ] Implement ApiKeyService with generation/validation
- [ ] Build ApiKeyGuard and RateLimitInterceptor
- [ ] Add unit tests for authentication flow

### Phase 2: Multi-Channel Auth (Weeks 3-4)
- [ ] Implement PlaygroundService with JWT
- [ ] Create RapidAPIGuard
- [ ] Build AuthController for key management
- [ ] Add integration tests

### Phase 3: Developer Portal (Weeks 5-8)
- [ ] Next.js frontend with dashboard
- [ ] Stripe integration for subscriptions
- [ ] Usage analytics API endpoints
- [ ] Interactive API documentation

### Phase 4: Production Hardening (Weeks 9-10)
- [ ] Load testing (1000+ req/s)
- [ ] Security audit
- [ ] IP whitelisting feature
- [ ] Key rotation workflow
- [ ] Monitoring and alerting

---

## 11. Cost Analysis

### Infrastructure Costs (Railway)

| Component | Tier | Monthly Cost |
|-----------|------|--------------|
| **API Service** | Pro (8GB RAM) | $20 |
| **PostgreSQL** | Pro (10GB storage) | $15 |
| **Redis** | Pro (2GB RAM) | $10 |
| **Total** | | **$45/month** |

### Revenue Model

- **Free Tier**: Marketing (lead generation)
- **Pro ($29/mo)**: Break-even at ~50 customers
- **Business ($99/mo)**: Primary revenue driver
- **Enterprise (Custom)**: High-margin contracts

**Target**: 500 Pro + 100 Business = $24,500/mo revenue

---

## 12. Comparative Analysis

### How Leading APIs Handle Distribution

| Provider | Auth Method | Rate Limiting | Playground | Marketplace |
|----------|-------------|---------------|------------|-------------|
| **Google Maps** | API Key | Per-second (QPS) | Yes (temporary keys) | No |
| **Mapbox** | Access Token | Per-minute | Yes (JWT) | No |
| **OpenCage** | API Key | Daily quota | Yes (interactive) | RapidAPI |
| **Stripe** | Secret Key | Per-second | Yes (test mode) | No |
| **PinPoint** | API Key + RapidAPI | Per-minute + daily | JWT playground | RapidAPI |

**Key Insights:**
1. Most use simple API keys (not OAuth)
2. Rate limiting is per-minute or per-second
3. All offer interactive playgrounds
4. Few use third-party marketplaces (RapidAPI is unique opportunity)

---

## Summary

This architecture provides:

✅ **Three Access Channels**: RapidAPI, Direct API Key, Web Playground
✅ **Tier-Based Quotas**: Free/Pro/Business/Enterprise with Redis rate limiting
✅ **Security**: SHA-256 hashed keys, HTTPS, audit logging
✅ **Performance**: <5ms auth overhead using Redis caching
✅ **Scalability**: Horizontal scaling with stateless guards
✅ **Developer Experience**: Interactive playground, comprehensive docs

**Ready for Implementation**: All components integrate cleanly with existing NestJS/PostgreSQL/Redis stack.

