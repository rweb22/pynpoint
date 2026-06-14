# API Authentication Implementation Guide

**Status**: Ready for Development  
**Priority**: High (Required for API monetization)  
**Estimated Effort**: 6-8 weeks

---

## Quick Start

This guide provides step-by-step instructions for implementing the API distribution architecture outlined in `API_DISTRIBUTION_ARCHITECTURE.md`.

---

## Prerequisites

- ✅ NestJS application running (current: production-ready)
- ✅ PostgreSQL with PostGIS (current: 19,596 pincodes + 165,603 post offices)
- ✅ Redis (current: 32.5M H3 hexagons persisted)
- ✅ TypeORM configured (current: migrations working)

---

## Phase 1: Database Schema (Week 1)

### Step 1.1: Create Customer Entity

```bash
# Generate entity and migration
npm run typeorm entity:create -- -n Customer
npm run typeorm migration:create -- -n CreateCustomers
```

```typescript
// src/database/entities/customer.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { ApiKey } from './api-key.entity';

@Entity('customers')
@Index(['email'], { unique: true })
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  company: string;

  @Column({ type: 'enum', enum: ['free', 'pro', 'business', 'enterprise'], default: 'free' })
  tier: 'free' | 'pro' | 'business' | 'enterprise';

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: {
    stripeCustomerId?: string;
    subscriptionId?: string;
    billingEmail?: string;
  };

  @OneToMany(() => ApiKey, (apiKey) => apiKey.customer)
  apiKeys: ApiKey[];
}
```

### Step 1.2: Create API Key Entity

```typescript
// src/database/entities/api-key.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('api_keys')
@Index(['prefix'])
@Index(['customer_id'])
@Index(['is_active', 'expires_at'])
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, (customer) => customer.apiKeys)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column()
  customer_id: string;

  @Column({ length: 15 })
  prefix: string;  // "ppk_live_sk_a8f"

  @Column()
  key_hash: string;  // SHA-256(full_key)

  @Column({ type: 'enum', enum: ['live', 'test'], default: 'live' })
  environment: 'live' | 'test';

  @Column({ type: 'enum', enum: ['free', 'pro', 'business', 'enterprise'] })
  tier: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
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

### Step 1.3: Create API Usage Entity

```typescript
// src/database/entities/api-usage.entity.ts
@Entity('api_usage')
@Index(['customer_id', 'date'])
@Index(['endpoint'])
export class ApiUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  customer_id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  endpoint: string;

  @Column({ default: 0 })
  request_count: number;

  @Column({ default: 0 })
  success_count: number;

  @Column({ default: 0 })
  error_count: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avg_response_time_ms: number;

  @Column({ type: 'jsonb', default: {} })
  status_codes: Record<string, number>;
}
```

### Step 1.4: Register Entities

```typescript
// src/database/database.module.ts
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      // ... existing config
    }),
    TypeOrmModule.forFeature([
      Pincode,
      PostOffice,
      Customer,      // NEW
      ApiKey,        // NEW
      ApiUsage,      // NEW
    ]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
```

### Step 1.5: Run Migration

```bash
# Generate migration
npm run typeorm migration:generate -- -n AddAuthTables

# Run migration
npm run typeorm migration:run
```

---

## Phase 2: API Key Service (Week 2)

### Step 2.1: Create Auth Module

```bash
mkdir -p src/auth/services src/auth/guards src/auth/controllers
```

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiKey } from '../database/entities/api-key.entity';
import { Customer } from '../database/entities/customer.entity';
import { ApiKeyService } from './services/api-key.service';
import { PlaygroundService } from './services/playground.service';
import { AuthController } from './controllers/auth.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, Customer]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [ApiKeyService, PlaygroundService],
  controllers: [AuthController],
  exports: [ApiKeyService, PlaygroundService],
})
export class AuthModule {}
```

### Step 2.2: Implement API Key Service

Create `src/auth/services/api-key.service.ts` with:

1. `generateKey(customerId, tier, environment)` - Creates new API key
2. `validateKey(key)` - Validates and returns customer info
3. `revokeKey(keyId)` - Deactivates a key
4. `listKeys(customerId)` - Returns all keys for customer
5. Private helper: `calculateLuhnChecksum(data)` - Checksum algorithm

**Key Implementation Details:**
- Use `crypto.randomBytes(20)` for 160-bit entropy
- Store SHA-256 hash only, never plaintext
- Cache in Redis for 1 hour (hot path optimization)
- Update `last_used_at` asynchronously

### Step 2.3: Implement Playground Service

Create `src/auth/services/playground.service.ts` with:

1. `generatePlaygroundToken(customerId?)` - Issues 15-minute JWT
2. `validateToken(token)` - Verifies JWT and checks Redis
3. `revokeToken(token)` - Removes from Redis allowlist

---

## Phase 3: Guards & Interceptors (Week 3)

### Step 3.1: Create Guards

```typescript
// src/auth/guards/rapidapi.guard.ts
@Injectable()
export class RapidAPIGuard implements CanActivate {
  // Validates X-RapidAPI-Proxy-Secret header
  // Skips if header not present
  // Attaches user to request if valid
}

// src/auth/guards/api-key.guard.ts
@Injectable()
export class ApiKeyGuard implements CanActivate {
  // Validates X-API-Key header
  // Skips if already authenticated
  // Throws 401 if invalid
}

// src/auth/guards/playground-token.guard.ts
@Injectable()
export class PlaygroundTokenGuard implements CanActivate {
  // Validates Bearer JWT token
  // Checks Redis for revocation
  // Attaches user to request
}
```

### Step 3.2: Create Rate Limit Interceptor

```typescript
// src/interceptors/rate-limit.interceptor.ts
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  // Checks tier limits in Redis
  // Increments counters
  // Throws 429 if exceeded
  // Adds X-RateLimit-* headers
}
```

### Step 3.3: Register Global Guards

```typescript
// src/app.module.ts
@Module({
  providers: [
    { provide: APP_GUARD, useClass: RapidAPIGuard },
    { provide: APP_GUARD, useClass: PlaygroundTokenGuard },
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor },
  ],
})
export class AppModule {}
```

---

## Phase 4: API Endpoints (Week 4)

### Step 4.1: Auth Controller

```typescript
// src/auth/controllers/auth.controller.ts
@Controller('auth')
export class AuthController {
  @Post('playground-token')
  @Public()
  async createPlaygroundToken() {
    // Issue temporary JWT for docs
  }

  @Post('keys')
  @UseGuards(CustomerAuthGuard)  // Requires user login
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    // Generate new API key
    // Return full key ONCE
  }

  @Get('keys')
  @UseGuards(CustomerAuthGuard)
  async listApiKeys(@Req() req) {
    // Return keys with prefix (masked)
  }

  @Delete('keys/:id')
  @UseGuards(CustomerAuthGuard)
  async revokeApiKey(@Param('id') id: string) {
    // Deactivate key
  }
}
```

### Step 4.2: Public Decorator

```typescript
// src/auth/decorators/public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## Phase 5: Testing (Week 5)

### Step 5.1: Unit Tests

```typescript
// src/auth/services/api-key.service.spec.ts
describe('ApiKeyService', () => {
  it('should generate valid API key', async () => {
    const { key, prefix } = await service.generateKey('cust-1', 'pro');
    expect(key).toMatch(/^ppk_live_sk_[a-z0-9]{20}_[a-z0-9]$/);
    expect(prefix).toBe(key.substring(0, 15));
  });

  it('should validate correct API key', async () => {
    const { key } = await service.generateKey('cust-1', 'pro');
    const result = await service.validateKey(key);
    expect(result.customerId).toBe('cust-1');
  });

  it('should reject invalid API key', async () => {
    const result = await service.validateKey('ppk_live_sk_invalid_x');
    expect(result).toBeNull();
  });
});
```

### Step 5.2: Integration Tests

```typescript
// test/auth.e2e-spec.ts
describe('Authentication (e2e)', () => {
  it('/pincode/:id (GET) should require API key', () => {
    return request(app.getHttpServer())
      .get('/v1/pincode/110001')
      .expect(401)
      .expect({ error: { code: 'API_KEY_MISSING' } });
  });

  it('/pincode/:id (GET) should work with valid key', async () => {
    const { key } = await createTestApiKey();
    return request(app.getHttpServer())
      .get('/v1/pincode/110001')
      .set('X-API-Key', key)
      .expect(200);
  });

  it('should enforce rate limits', async () => {
    const { key } = await createTestApiKey('free');  // 10 req/min
    
    // Make 10 requests (should succeed)
    for (let i = 0; i < 10; i++) {
      await request(app.getHttpServer())
        .get('/v1/pincode/110001')
        .set('X-API-Key', key)
        .expect(200);
    }
    
    // 11th request should fail
    return request(app.getHttpServer())
      .get('/v1/pincode/110001')
      .set('X-API-Key', key)
      .expect(429);
  });
});
```

---

## Configuration

### Environment Variables

```bash
# .env
# JWT for playground tokens
JWT_SECRET=<random-256-bit-secret>

# RapidAPI (if enabled)
RAPIDAPI_ENABLED=true
RAPIDAPI_PROXY_SECRET=<from-rapidapi-dashboard>

# Rate limiting
RATE_LIMIT_FREE_PER_MIN=10
RATE_LIMIT_PRO_PER_MIN=100
RATE_LIMIT_BUSINESS_PER_MIN=500
RATE_LIMIT_ENTERPRISE_PER_MIN=10000
```

---

## Deployment Checklist

- [ ] Run migrations on production database
- [ ] Set JWT_SECRET in Railway variables
- [ ] Configure RAPIDAPI_PROXY_SECRET (if using)
- [ ] Test API key generation in staging
- [ ] Verify rate limiting with load tests
- [ ] Monitor Redis memory usage (key caching)
- [ ] Set up alerts for rate limit violations
- [ ] Document API in OpenAPI/Swagger

---

## Next Steps

After implementing authentication:

1. **Developer Portal** - Next.js frontend for key management
2. **Stripe Integration** - Subscription billing
3. **Usage Analytics** - Dashboard with charts
4. **Webhook System** - Event notifications
5. **IP Whitelisting** - Enhanced security
6. **API Versioning** - v2 endpoints

---

## Support & References

- **Architecture Doc**: `docs/architecture/API_DISTRIBUTION_ARCHITECTURE.md`
- **NestJS Guards**: https://docs.nestjs.com/guards
- **TypeORM Relations**: https://typeorm.io/relations
- **Redis Rate Limiting**: https://redis.io/docs/manual/patterns/rate-limiter/
- **API Key Best Practices**: https://cloud.google.com/endpoints/docs/openapi/when-why-api-key

