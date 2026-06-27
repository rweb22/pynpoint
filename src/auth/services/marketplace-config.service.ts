import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketplaceConfig } from '../../database/entities/marketplace-config.entity';

/**
 * MarketplaceConfigService
 * 
 * Manages marketplace authentication configurations.
 * Loads marketplace secrets from database into memory on startup.
 * Provides fast in-memory lookup for authentication.
 * 
 * Usage:
 *   const config = await marketplaceConfigService.validateSecret('x-rapidapi-proxy-secret', 'secret-value');
 *   if (config) {
 *     // Valid marketplace request
 *     const userId = request.headers[config.user_header_name];
 *   }
 */

export interface MarketplaceAuthConfig {
  marketplace_id: string;
  marketplace_name: string;
  secret_key: string;
  header_name: string;
  user_header_name: string;
  metadata: any;
}

@Injectable()
export class MarketplaceConfigService implements OnModuleInit {
  private readonly logger = new Logger(MarketplaceConfigService.name);

  // In-memory cache: Map<secret_key, config>
  // Direct O(1) lookup by secret value, regardless of header name
  // Example: { 'secret123': { marketplace_id: 'rapidapi', header_name: 'x-rapidapi-proxy-secret', ... } }
  private secretCache: Map<string, MarketplaceAuthConfig> = new Map();

  // Set of known header names for quick check
  // Example: Set(['x-rapidapi-proxy-secret', 'x-aws-marketplace-token'])
  private knownHeaders: Set<string> = new Set();

  constructor(
    @InjectRepository(MarketplaceConfig)
    private readonly marketplaceConfigRepo: Repository<MarketplaceConfig>,
  ) {}

  /**
   * Load marketplace configurations from database on application startup
   */
  async onModuleInit() {
    await this.loadMarketplaceConfigs();
  }

  /**
   * Load all active marketplace configurations from database into memory
   */
  async loadMarketplaceConfigs(): Promise<void> {
    this.logger.log('Loading marketplace configurations from database...');

    try {
      const configs = await this.marketplaceConfigRepo.find({
        where: { is_active: true },
        order: { created_at: 'ASC' },
      });

      // Clear existing cache
      this.secretCache.clear();
      this.knownHeaders.clear();

      // Build in-memory cache - direct secret lookup
      for (const config of configs) {
        const headerName = config.header_name.toLowerCase();

        // Add to secret cache (O(1) lookup)
        this.secretCache.set(config.secret_key, {
          marketplace_id: config.marketplace_id,
          marketplace_name: config.marketplace_name,
          secret_key: config.secret_key,
          header_name: config.header_name,
          user_header_name: config.user_header_name,
          metadata: config.metadata,
        });

        // Track known header names
        this.knownHeaders.add(headerName);

        this.logger.log(
          `Loaded marketplace config: ${config.marketplace_name} (${config.marketplace_id}) via ${config.header_name}`
        );
      }

      this.logger.log(
        `✅ Loaded ${configs.length} active marketplace configuration(s) into memory`
      );
    } catch (error) {
      this.logger.error('Failed to load marketplace configurations:', error);
      // Don't throw - allow app to start without marketplace auth
    }
  }

  /**
   * Validate a marketplace secret - O(1) lookup
   *
   * @param secretValue - Secret value from any marketplace header
   * @returns Marketplace config if valid, null otherwise
   */
  validateSecret(secretValue: string): MarketplaceAuthConfig | null {
    return this.secretCache.get(secretValue) || null;
  }

  /**
   * Check if a header name is a known marketplace header
   *
   * @param headerName - HTTP header name to check
   * @returns true if this is a known marketplace header
   */
  isKnownMarketplaceHeader(headerName: string): boolean {
    return this.knownHeaders.has(headerName.toLowerCase());
  }

  /**
   * Get all known marketplace header names
   *
   * @returns Array of header names
   */
  getKnownHeaders(): string[] {
    return Array.from(this.knownHeaders);
  }

  /**
   * Get all active marketplace configurations (for admin UI)
   */
  async getAllConfigs(): Promise<MarketplaceConfig[]> {
    return this.marketplaceConfigRepo.find({
      where: { is_active: true },
      order: { marketplace_name: 'ASC' },
    });
  }

  /**
   * Add or update a marketplace configuration
   */
  async upsertConfig(config: Partial<MarketplaceConfig>): Promise<MarketplaceConfig> {
    const saved = await this.marketplaceConfigRepo.save(config);
    
    // Reload cache to pick up changes
    await this.loadMarketplaceConfigs();
    
    this.logger.log(`Marketplace config updated: ${saved.marketplace_name}`);
    return saved;
  }

  /**
   * Rotate a marketplace secret (deactivate old, create new)
   */
  async rotateSecret(
    marketplaceId: string,
    newSecretKey: string,
  ): Promise<MarketplaceConfig> {
    // Deactivate old secrets
    await this.marketplaceConfigRepo.update(
      { marketplace_id: marketplaceId, is_active: true },
      { is_active: false, rotated_at: new Date() },
    );

    // Get the old config to copy settings
    const oldConfig = await this.marketplaceConfigRepo.findOne({
      where: { marketplace_id: marketplaceId },
      order: { created_at: 'DESC' },
    });

    if (!oldConfig) {
      throw new Error(`Marketplace ${marketplaceId} not found`);
    }

    // Create new config with rotated secret
    const newConfig = this.marketplaceConfigRepo.create({
      marketplace_id: oldConfig.marketplace_id,
      marketplace_name: oldConfig.marketplace_name,
      secret_key: newSecretKey,
      header_name: oldConfig.header_name,
      user_header_name: oldConfig.user_header_name,
      metadata: oldConfig.metadata,
      is_active: true,
    });

    const saved = await this.marketplaceConfigRepo.save(newConfig);
    
    // Reload cache
    await this.loadMarketplaceConfigs();
    
    this.logger.log(`Secret rotated for marketplace: ${marketplaceId}`);
    return saved;
  }
}
