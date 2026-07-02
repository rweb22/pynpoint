import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ApiKey } from '../../database/entities/api-key.entity';
import { RedisCacheService } from '../../redis/redis-cache.service';
import { MemoryCacheService } from '../../common/services/memory-cache.service';
import { generateApiKey, hashSHA256, validateApiKeyFormat } from '../utils/crypto.util';

/**
 * ApiKeyService
 *
 * Manages API key lifecycle:
 * - Generation (with Luhn checksums)
 * - Validation (SHA-256 hash lookup + two-tier caching)
 * - Revocation (soft delete)
 * - Tier updates (when customer upgrades/downgrades)
 *
 * Performance optimizations:
 * - L1 cache (in-memory): 60s TTL, handles 95%+ of requests
 * - L2 cache (Redis): 1 hour TTL, for cache misses or L1 expiry
 * - SHA-256 hash lookup (no plaintext keys in DB)
 * - Fast Luhn checksum validation (before any cache/DB query)
 *
 * Two-tier caching benefits:
 * - L1 (memory): ~1μs latency (vs 200-500μs for Redis)
 * - Reduces Redis calls by 95%+, eliminating network bottleneck
 * - L2 (Redis) still provides distributed cache across instances
 */
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly L1_CACHE_TTL = 60; // 60 seconds (in-memory)
  private readonly L2_CACHE_TTL = 3600; // 1 hour (Redis)

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private readonly redisCache: RedisCacheService,
    private readonly memoryCache: MemoryCacheService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate a new API key
   *
   * @param externalCustomerId - Customer ID from main website (e.g., Stripe customer ID)
   * @param tier - Subscription tier
   * @param environment - 'live' or 'test'
   * @param options - Optional metadata and rate limit overrides
   * @returns Object with full key (show once) and saved entity
   */
  async generateKey(
    externalCustomerId: string,
    tier: 'free' | 'pro' | 'business' | 'enterprise',
    environment: 'live' | 'test' = 'live',
    options?: {
      rateLimitOverrides?: {
        requests_per_minute?: number;
        requests_per_day?: number;
        requests_per_second?: number;
      };
      metadata?: {
        name?: string;
        description?: string;
        allowed_ips?: string[];
        scopes?: string[];
        provisioned_by?: string;
      };
      expiresAt?: Date;
    },
  ): Promise<{ key: string; prefix: string; entity: ApiKey }> {
    // Generate API key with Luhn checksum
    const { key, prefix } = generateApiKey(environment, 'sk');

    // Hash the key (never store plaintext)
    const keyHash = hashSHA256(key);

    // Create entity
    const apiKey = this.apiKeyRepository.create({
      external_customer_id: externalCustomerId,
      prefix,
      key_hash: keyHash,
      environment,
      tier,
      is_active: true,
      expires_at: options?.expiresAt || null,
      rate_limit_overrides: options?.rateLimitOverrides || null,
      metadata: options?.metadata || {},
    });

    // Save to database
    const savedKey = await this.apiKeyRepository.save(apiKey);

    this.logger.log(`Generated API key for customer ${externalCustomerId} (tier: ${tier}, env: ${environment})`);

    return {
      key, // Full key - return ONCE only
      prefix, // Masked version for display
      entity: savedKey,
    };
  }

  /**
   * Validate an API key and return associated data
   *
   * Performance flow (two-tier caching):
   * 1. Check format and Luhn checksum (fast, no I/O)
   * 2. Check L1 cache (in-memory, ~1μs)
   * 3. Check L2 cache (Redis, ~200-500μs)
   * 4. Query database by hash (if both caches miss)
   * 5. Cache result in L1 (60s) and L2 (1 hour)
   *
   * @param key - Full API key from Authorization header
   * @returns Key data if valid, null if invalid
   */
  async validateKey(key: string): Promise<{
    keyId: string;
    externalCustomerId: string;
    tier: string;
    environment: string;
    rateLimitOverrides: any;
    metadata: any;
  } | null> {
    // Step 1: Validate format and checksum (fast, no I/O)
    if (!validateApiKeyFormat(key)) {
      this.logger.warn(`Invalid API key format: ${key.substring(0, 15)}***`);
      return null;
    }

    // Step 2: Hash the key
    const keyHash = hashSHA256(key);

    // Step 3: Check L1 cache (in-memory)
    const l1Cached = this.memoryCache.get<any>(`apikey:${keyHash}`);
    if (l1Cached) {
      this.logger.debug(`L1 cache HIT for key ${key.substring(0, 15)}***`);
      return l1Cached;
    }

    // Step 4: Check L2 cache (Redis)
    const l2Cached = await this.redisCache.getCachedApiKey(keyHash);
    if (l2Cached) {
      this.logger.debug(`L2 cache HIT for key ${key.substring(0, 15)}***, promoting to L1`);
      // Promote to L1 cache
      this.memoryCache.set(`apikey:${keyHash}`, l2Cached, this.L1_CACHE_TTL);
      return l2Cached;
    }

    // Step 5: Query database
    this.logger.debug(`Cache MISS for key ${key.substring(0, 15)}***, querying DB`);
    const apiKey = await this.apiKeyRepository.findOne({
      where: { key_hash: keyHash },
    });

    if (!apiKey) {
      this.logger.warn(`API key not found in database: ${key.substring(0, 15)}***`);
      return null;
    }

    // Check if key is active
    if (!apiKey.is_active) {
      this.logger.warn(`API key revoked: ${key.substring(0, 15)}***`);
      return null;
    }

    // Check if key is expired
    if (apiKey.expires_at && new Date() > apiKey.expires_at) {
      this.logger.warn(`API key expired: ${key.substring(0, 15)}***`);
      return null;
    }

    // Build result
    const result = {
      keyId: apiKey.id,
      externalCustomerId: apiKey.external_customer_id,
      tier: apiKey.tier,
      environment: apiKey.environment,
      rateLimitOverrides: apiKey.rate_limit_overrides,
      metadata: apiKey.metadata,
    };

    // Step 6: Cache for future requests (both L1 and L2)
    this.memoryCache.set(`apikey:${keyHash}`, result, this.L1_CACHE_TTL);
    await this.redisCache.cacheApiKey(keyHash, result, this.L2_CACHE_TTL);

    this.logger.log(`Validated API key for customer ${apiKey.external_customer_id} (cached L1+L2)`);

    return result;
  }

  /**
   * Revoke an API key (soft delete)
   *
   * @param keyId - UUID of the API key
   * @returns true if revoked, false if not found
   */
  async revokeKey(keyId: string): Promise<boolean> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId },
    });

    if (!apiKey) {
      this.logger.warn(`Attempted to revoke non-existent key: ${keyId}`);
      return false;
    }

    // Soft delete (set is_active = false)
    apiKey.is_active = false;
    await this.apiKeyRepository.save(apiKey);

    // Invalidate cache
    await this.redisCache.invalidateApiKey(apiKey.key_hash);

    this.logger.log(`Revoked API key ${keyId} for customer ${apiKey.external_customer_id}`);
    return true;
  }

  /**
   * Update API key tier (when customer upgrades/downgrades)
   *
   * @param keyId - UUID of the API key
   * @param tier - New tier
   * @param rateLimitOverrides - Optional custom rate limits
   * @returns Updated entity
   */
  async updateKeyTier(
    keyId: string,
    tier: 'free' | 'pro' | 'business' | 'enterprise',
    rateLimitOverrides?: {
      requests_per_minute?: number;
      requests_per_day?: number;
      requests_per_second?: number;
    },
  ): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new UnauthorizedException(`API key not found: ${keyId}`);
    }

    // Update tier and rate limits
    apiKey.tier = tier;
    if (rateLimitOverrides) {
      apiKey.rate_limit_overrides = rateLimitOverrides;
    }

    const updated = await this.apiKeyRepository.save(apiKey);

    // Invalidate cache (force re-fetch with new tier)
    await this.redisCache.invalidateApiKey(apiKey.key_hash);

    this.logger.log(`Updated API key ${keyId} to tier ${tier}`);
    return updated;
  }

  /**
   * List all API keys for a customer
   *
   * @param externalCustomerId - Customer ID from main website
   * @returns Array of API keys (without key_hash)
   */
  async listKeysByCustomer(externalCustomerId: string): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({
      where: { external_customer_id: externalCustomerId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Update last_used_at timestamp (async, fire-and-forget)
   * Called after successful validation to track usage
   *
   * @param keyId - UUID of the API key
   */
  async recordUsage(keyId: string): Promise<void> {
    // Fire-and-forget (don't await to avoid slowing down requests)
    this.apiKeyRepository
      .update(keyId, { last_used_at: new Date() })
      .catch((error) => {
        this.logger.error(`Failed to update last_used_at for key ${keyId}:`, error);
      });
  }
}
