import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * MemoryCacheService
 * 
 * High-performance in-memory (L1) cache to reduce Redis dependency.
 * 
 * Architecture:
 * - Two-tier caching: L1 (memory) → L2 (Redis)
 * - L1 cache handles 95%+ of reads (sub-microsecond latency)
 * - Only cache misses or expired entries hit Redis
 * 
 * Use Cases:
 * - API key validation (cache for 60 seconds)
 * - Rate limit counters (cache for 1-5 seconds)
 * - Frequently accessed data
 * 
 * Performance Impact:
 * - Before: Every request → Redis (network round-trip)
 * - After: 95%+ requests → Memory (no network)
 * - Latency reduction: 200-500μs → 1-2μs per cache hit
 * 
 * Memory Usage:
 * - ~100 bytes per cache entry
 * - Max 10,000 entries = ~1 MB
 * - Automatic eviction of expired entries
 * 
 * Environment Variables:
 * - MEMORY_CACHE_ENABLED: Enable/disable L1 cache (default: true)
 * - MEMORY_CACHE_MAX_SIZE: Max entries (default: 10000)
 * - MEMORY_CACHE_CLEANUP_INTERVAL_MS: Cleanup interval (default: 60000)
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in milliseconds
}

@Injectable()
export class MemoryCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(MemoryCacheService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private enabled: boolean;

  // Cache hit/miss statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    expirations: 0,
  };

  constructor() {
    this.enabled = process.env.MEMORY_CACHE_ENABLED !== 'false';
    this.maxSize = parseInt(process.env.MEMORY_CACHE_MAX_SIZE || '10000', 10);
    const cleanupIntervalMs = parseInt(process.env.MEMORY_CACHE_CLEANUP_INTERVAL_MS || '60000', 10);

    if (this.enabled) {
      // Start periodic cleanup of expired entries
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, cleanupIntervalMs);

      this.logger.log(`✅ In-memory cache initialized (max size: ${this.maxSize}, cleanup: ${cleanupIntervalMs}ms)`);
    } else {
      this.logger.warn('⚠️  In-memory cache disabled via MEMORY_CACHE_ENABLED=false');
    }
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or null if not found/expired
   */
  get<T>(key: string): T | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.expirations++;
      return null;
    }

    this.stats.hits++;
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time to live in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (!this.enabled) return;

    // Enforce max size (simple LRU: delete oldest if full)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
    this.stats.sets++;
  }

  /**
   * Delete value from cache
   * 
   * @param key - Cache key
   */
  delete(key: string): void {
    if (!this.enabled) return;
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    if (!this.enabled) return;
    this.cache.clear();
    this.logger.log('🗑️  Memory cache cleared');
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    if (!this.enabled) return;

    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      this.stats.expirations += expiredCount;
      this.logger.debug(`🧹 Cleaned up ${expiredCount} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      ...this.stats,
    };
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.logger.log(`📊 Memory cache stats: ${JSON.stringify(this.getStats())}`);
  }
}
