# Redis Dual-Instance Architecture

**Date**: 2026-06-14  
**Status**: Design Complete  
**Priority**: High (Required before implementing auth/rate-limiting)

---

## Problem Statement

The PinPoint API service has **two different Redis use cases** with **conflicting requirements**:

### Use Case 1: H3 Spatial Index (Persistent)
- **Size**: 32.5M hexagons (~4-6 GB)
- **Persistence**: Must survive restarts (RDB snapshots)
- **Eviction**: NEVER evict (critical data)
- **Backup**: Daily backups required
- **Lifetime**: Permanent (until new CSV ingestion)

### Use Case 2: Cache & Rate Limiting (Ephemeral)
- **Size**: ~100-500 MB (API key cache, rate limit counters)
- **Persistence**: NOT needed (rebuilt on-demand)
- **Eviction**: LRU eviction (cache misses are OK)
- **Backup**: NOT needed (temporary data)
- **Lifetime**: Minutes to hours (TTL-based)

**These requirements are incompatible in a single Redis instance!**

---

## Solution: Two Redis Instances

```
┌────────────────────────────────────────────────────────────────┐
│              PinPoint API Service (NestJS)                     │
│                                                                │
│  ┌─────────────────────┐         ┌─────────────────────┐     │
│  │  H3Service          │         │  ApiKeyService      │     │
│  │  GeocodingService   │         │  RateLimitService   │     │
│  └──────────┬──────────┘         └──────────┬──────────┘     │
│             │                               │                 │
│             │                               │                 │
└─────────────┼───────────────────────────────┼─────────────────┘
              │                               │
              ▼                               ▼
   ┌──────────────────────┐       ┌──────────────────────┐
   │   Redis Instance 1   │       │   Redis Instance 2   │
   │   (PERSISTENT)       │       │   (CACHE)            │
   │                      │       │                      │
   │  Purpose:            │       │  Purpose:            │
   │  - H3 spatial index  │       │  - API key cache     │
   │                      │       │  - Rate limit        │
   │  Size: 4-6 GB        │       │    counters          │
   │                      │       │                      │
   │  Config:             │       │  Size: 100-500 MB    │
   │  - noeviction        │       │                      │
   │  - RDB snapshots     │       │  Config:             │
   │  - save 60 1         │       │  - allkeys-lru       │
   │  - Backup enabled    │       │  - NO persistence    │
   │                      │       │  - No backups        │
   │  Railway:            │       │                      │
   │  - Persistent volume │       │  Railway:            │
   │  - /data/dump.rdb    │       │  - Ephemeral         │
   └──────────────────────┘       └──────────────────────┘
```

---

## Configuration Comparison

| Setting | Redis 1 (Persistent) | Redis 2 (Cache) |
|---------|---------------------|-----------------|
| **Purpose** | H3 spatial index | API key cache, rate limits |
| **Eviction Policy** | `noeviction` | `allkeys-lru` |
| **Persistence** | RDB snapshots | None |
| **Save Schedule** | `save 60 1` | Disabled |
| **Backup** | Daily | None |
| **Volume** | Persistent disk | Ephemeral |
| **Size** | 4-6 GB | 100-500 MB |
| **Railway Plan** | Larger instance | Smaller instance |
| **Max Memory** | 8 GB | 512 MB |

---

## Railway Setup

### Instance 1: Persistent Redis (H3 Index)

```bash
# Railway Redis Service: "redis-persistent"
# Plan: Pro plan with persistent storage

# Config (set via Railway dashboard or railway.json)
REDIS_PERSISTENT_URL=redis://:password@redis-persistent.railway.internal:6379

# Redis config
maxmemory-policy: noeviction
save: 60 1
appendonly: no
```

### Instance 2: Cache Redis (API Auth & Rate Limiting)

```bash
# Railway Redis Service: "redis-cache"
# Plan: Starter plan (no persistence needed)

# Config
REDIS_CACHE_URL=redis://:password@redis-cache.railway.internal:6379

# Redis config
maxmemory-policy: allkeys-lru
maxmemory: 512mb
save: ""  # Disable RDB snapshots
appendonly: no
```

---

## NestJS Implementation

### Update RedisModule

```typescript
// src/redis/redis.module.ts
import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisPersistentService } from './redis-persistent.service';
import { RedisCacheService } from './redis-cache.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [RedisPersistentService, RedisCacheService],
  exports: [RedisPersistentService, RedisCacheService],
})
export class RedisModule {}
```

### Create Separate Services

```typescript
// src/redis/redis-persistent.service.ts
@Injectable()
export class RedisPersistentService {
  private readonly logger = new Logger(RedisPersistentService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis(this.configService.get('REDIS_PERSISTENT_URL'), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    
    this.logger.log('Connected to PERSISTENT Redis (H3 index)');
  }

  // H3 operations only
  async setH3(hexId: string, pincode: string): Promise<void> {
    await this.client.set(`h3:${hexId}`, pincode);
  }

  async getH3(hexId: string): Promise<string | null> {
    return await this.client.get(`h3:${hexId}`);
  }

  async mgetH3(hexIds: string[]): Promise<(string | null)[]> {
    const keys = hexIds.map(id => `h3:${id}`);
    return await this.client.mget(...keys);
  }

  getClient(): Redis {
    return this.client;
  }
}
```

```typescript
// src/redis/redis-cache.service.ts
@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis(this.configService.get('REDIS_CACHE_URL'), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });
    
    this.logger.log('Connected to CACHE Redis (auth, rate limits)');
  }

  // API Key caching
  async cacheApiKey(keyHash: string, keyData: any, ttl: number = 3600): Promise<void> {
    await this.client.setex(`apikey:${keyHash}`, ttl, JSON.stringify(keyData));
  }

  async getCachedApiKey(keyHash: string): Promise<any | null> {
    const data = await this.client.get(`apikey:${keyHash}`);
    return data ? JSON.parse(data) : null;
  }

  async invalidateApiKey(keyHash: string): Promise<void> {
    await this.client.del(`apikey:${keyHash}`);
  }

  // Rate limiting (token bucket)
  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  getClient(): Redis {
    return this.client;
  }
}
```

---

## Environment Variables

```bash
# .env
REDIS_PERSISTENT_URL=redis://:password@redis-persistent.railway.internal:6379
REDIS_CACHE_URL=redis://:password@redis-cache.railway.internal:6379
```

---

## Cost Comparison (Railway)

| Plan | Use Case | Memory | Storage | Cost/Month |
|------|----------|--------|---------|------------|
| **Pro Redis** | H3 Index (persistent) | 8 GB | Persistent volume | ~$20 |
| **Starter Redis** | Cache (ephemeral) | 512 MB | No volume | ~$5 |
| **Total** | Both | - | - | **~$25** |

---

## Benefits

✅ **Correct Eviction Policies** - H3 index never evicts, cache uses LRU  
✅ **No Persistence Overhead** - Cache doesn't waste I/O writing to disk  
✅ **Independent Scaling** - Scale H3 index (8 GB) separately from cache (512 MB)  
✅ **Faster Cache** - No RDB writes blocking cache operations  
✅ **Better Monitoring** - Separate metrics for spatial vs auth/rate-limit Redis  
✅ **Cost Optimization** - Pay for persistence only where needed  

---

## Migration Path

1. ✅ Keep existing Redis instance as "redis-persistent"
2. ✅ Add new Redis instance "redis-cache" on Railway
3. ✅ Update NestJS code to use two services
4. ✅ Migrate rate limiting logic to use `RedisCacheService`
5. ✅ Migrate API key caching to use `RedisCacheService`
6. ✅ H3 operations continue using `RedisPersistentService`

---

## Summary

Using **two Redis instances** solves the eviction policy conflict and optimizes for both use cases:

- **Redis 1 (Persistent)**: H3 spatial index, noeviction, RDB snapshots, backups
- **Redis 2 (Cache)**: API keys, rate limits, LRU eviction, no persistence

This results in better performance, lower costs, and correct data lifecycle management! 🚀
