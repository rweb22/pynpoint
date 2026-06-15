# Module Integration Pattern for PinPoint India

## 🔐 Required Pattern for API Modules

**IMPORTANT**: Every module that exposes API endpoints protected by authentication MUST follow this pattern.

---

## ✅ Required Imports

Any module using **UsageTrackingInterceptor** or **RateLimitInterceptor** MUST import:

1. **ApiUsage entity** (for UsageTrackingInterceptor)
2. **AuthModule** (provides guards and interceptors)
3. **RedisModule** (if using caching services)

### Example Module Structure

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from '../database/entities/api-usage.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';

// Your module's entities
import { YourEntity } from '../database/entities/your-entity.entity';

// Your module's components
import { YourService } from './services/your.service';
import { YourController } from './controllers/your.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      YourEntity,
      ApiUsage, // ⚠️ REQUIRED for UsageTrackingInterceptor
    ]),
    AuthModule,   // Provides ApiKeyGuard, RateLimitInterceptor, UsageTrackingInterceptor
    RedisModule,  // Provides RedisCacheService, RedisPersistentService (global, but explicit is better)
  ],
  controllers: [YourController],
  providers: [YourService],
  exports: [YourService],
})
export class YourModule {}
```

---

## 🎯 Controller Pattern

All controllers must use the authentication stack:

```typescript
import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiKeyGuard } from '../../auth/guards/api-key.guard';
import { RateLimitInterceptor } from '../../auth/interceptors/rate-limit.interceptor';
import { UsageTrackingInterceptor } from '../../auth/interceptors/usage-tracking.interceptor';
import { YourService } from '../services/your.service';

@Controller('api/v1/your-endpoint')
@UseGuards(ApiKeyGuard) // ⚠️ REQUIRED: API key authentication
@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor) // ⚠️ REQUIRED: Rate limiting + usage tracking
export class YourController {
  constructor(private readonly yourService: YourService) {}

  @Get()
  async getYourData() {
    return this.yourService.findAll();
  }
}
```

---

## ⚠️ Common Errors

### Error: "Nest can't resolve dependencies of the UsageTrackingInterceptor"

**Cause**: Missing `ApiUsage` entity import in module

**Solution**:
```typescript
TypeOrmModule.forFeature([
  YourEntity,
  ApiUsage, // ← Add this!
])
```

### Error: "Nest can't resolve dependencies of the RateLimitInterceptor"

**Cause**: Missing `AuthModule` import or `RedisCacheService` not available

**Solution**:
```typescript
imports: [
  AuthModule,   // ← Must be imported
  RedisModule,  // ← Must be imported (or global)
]
```

---

## 📋 Checklist for New Modules

When creating a new API module:

- [ ] Import `TypeOrmModule.forFeature([..., ApiUsage])`
- [ ] Import `AuthModule`
- [ ] Import `RedisModule` (if using caching)
- [ ] Add `@UseGuards(ApiKeyGuard)` to controllers
- [ ] Add `@UseInterceptors(RateLimitInterceptor, UsageTrackingInterceptor)` to controllers
- [ ] Test with valid API key
- [ ] Verify rate limiting works
- [ ] Verify usage tracking in database

---

## 🏗️ Existing Modules

### ✅ PincodeModule (Track 1)
```typescript
imports: [
  TypeOrmModule.forFeature([Pincode, PostOffice, ApiUsage]),
  RedisModule,
  AuthModule,
]
```

### 🔜 H3Module (Track 3)
```typescript
imports: [
  TypeOrmModule.forFeature([ApiUsage]),
  RedisModule, // For RedisPersistentService (H3 index)
  AuthModule,
]
```

### 🔜 DigipinModule (Track 2)
```typescript
imports: [
  TypeOrmModule.forFeature([ApiUsage]),
  RedisModule, // For RedisCacheService (metadata cache)
  AuthModule,
]
```

### 🔜 DistanceModule (Track 5)
```typescript
imports: [
  TypeOrmModule.forFeature([Pincode, ApiUsage]),
  RedisModule, // For RedisCacheService (distance cache)
  AuthModule,
]
```

---

## 🎯 Why This Pattern?

1. **UsageTrackingInterceptor** needs `ApiUsage` repository to track requests
2. **RateLimitInterceptor** needs `RedisCacheService` to track rate limits
3. **ApiKeyGuard** needs `ApiKeyService` to validate keys
4. All of these are provided by `AuthModule`, but repositories must be explicitly imported

---

## 🚀 Next Steps

When implementing new tracks:
1. Copy this pattern exactly
2. Add your domain entities to `TypeOrmModule.forFeature()`
3. Always include `ApiUsage`
4. Import `AuthModule` and `RedisModule`
5. Test authentication before deploying

---

**Pattern established**: Phase 6 (Track 1)  
**Applied to**: PincodeModule  
**Next**: All future modules must follow this pattern
