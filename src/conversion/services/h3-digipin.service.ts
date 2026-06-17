import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { RedisCacheService } from '../../redis/redis-cache.service';
import {
  H3ToDigipinResponse,
  DigipinToH3Response,
  BulkH3ToDigipinResponse,
  BulkDigipinToH3Response,
} from '../dto/h3-digipin.dto';

/**
 * H3DigipinService
 * 
 * Stack 3: H3 ↔ DIGIPIN Conversion Operations
 * 
 * Handles direct bidirectional conversion between H3 hexagons and DIGIPIN grid cells.
 * 
 * Key Operations:
 * - H3 → DIGIPIN cells (ALL overlapping cells, not just center-point)
 * - DIGIPIN → H3 cells (ALL overlapping cells, not just center-point)
 * - Bulk operations for efficiency
 * 
 * CRITICAL FIX:
 * - Old implementation used center-point conversion (returned only 1 cell)
 * - New implementation uses h3-digipin library (returns ALL overlapping cells)
 * - This fixes spatial accuracy for H3↔DIGIPIN conversions
 * 
 * Data Sources:
 * - h3-digipin library: SpatialConverter for complete spatial relationships
 * - Redis Cache: Expensive conversions (1 hour TTL)
 * - NO database (pure algorithmic)
 */
@Injectable()
export class H3DigipinService {
  private readonly logger = new Logger(H3DigipinService.name);
  private readonly DEFAULT_H3_RESOLUTION = 9;
  private readonly DEFAULT_DIGIPIN_LEVEL = 6;

  // TODO: Install h3-digipin library: npm install https://github.com/rweb22/h3-digipin.git
  // private readonly spatialConverter: SpatialConverter;

  constructor(
    private readonly redisCache: RedisCacheService,
  ) {
    // TODO: Uncomment after installing h3-digipin
    // import { SpatialConverter } from 'h3-digipin';
    // this.spatialConverter = new SpatialConverter();
  }

  /**
   * Convert H3 cell to DIGIPIN cells
   * 
   * CRITICAL FIX: Returns ALL overlapping DIGIPIN cells (not just 1)
   * 
   * Old (WRONG):
   *   const { lat, lng } = h3Algorithm.decode(h3Index);
   *   const digipinCode = digipinAlgorithm.encode(lat, lng, level);
   *   return { digipinCode }; // Only 1 cell!
   * 
   * New (CORRECT):
   *   const digipinCodes = spatialConverter.convertH3ToDigipin(h3Index, level);
   *   return { digipinCodes }; // ALL overlapping cells!
   */
  async h3ToDigipin(h3Index: string, level?: number): Promise<H3ToDigipinResponse> {
    this.logger.log(`Converting H3 ${h3Index} to DIGIPIN at level ${level || this.DEFAULT_DIGIPIN_LEVEL}`);
    
    // TODO: Implement using h3-digipin library
    // const digipinCodes = this.spatialConverter.convertH3ToDigipin(h3Index, level);
    
    throw new Error('Not implemented - requires h3-digipin library installation');
  }

  /**
   * Convert DIGIPIN cell to H3 cells
   * 
   * CRITICAL FIX: Returns ALL overlapping H3 cells (not just 1)
   */
  async digipinToH3(digipinCode: string, resolution?: number): Promise<DigipinToH3Response> {
    this.logger.log(`Converting DIGIPIN ${digipinCode} to H3 at resolution ${resolution || this.DEFAULT_H3_RESOLUTION}`);
    
    // TODO: Implement using h3-digipin library
    // const h3Indexes = this.spatialConverter.convertDigipinToH3(digipinCode, resolution);
    
    throw new Error('Not implemented - requires h3-digipin library installation');
  }

  /**
   * Bulk convert H3 cells to DIGIPIN cells
   * NEW ENDPOINT - not yet implemented anywhere
   */
  async bulkH3ToDigipin(h3Indexes: string[], level?: number): Promise<BulkH3ToDigipinResponse> {
    this.logger.log(`Bulk converting ${h3Indexes.length} H3 cells to DIGIPIN`);
    
    // TODO: Implement NEW bulk conversion using h3-digipin library
    throw new Error('Not implemented - NEW endpoint');
  }

  /**
   * Bulk convert DIGIPIN cells to H3 cells
   * NEW ENDPOINT - not yet implemented anywhere
   */
  async bulkDigipinToH3(digipinCodes: string[], resolution?: number): Promise<BulkDigipinToH3Response> {
    this.logger.log(`Bulk converting ${digipinCodes.length} DIGIPIN cells to H3`);
    
    // TODO: Implement NEW bulk conversion using h3-digipin library
    throw new Error('Not implemented - NEW endpoint');
  }
}
