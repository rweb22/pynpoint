import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SpatialConverter } from 'h3-digipin';

/**
 * DigipinIndexService
 * 
 * Builds and populates the DIGIPIN level-6 index for all pincodes
 * Similar to H3IndexService but for DIGIPIN grid system
 * 
 * Strategy:
 * 1. Read H3 cells from pincodes.h3_cells (already computed)
 * 2. For each H3 cell, get ALL overlapping DIGIPIN-6 cells
 * 3. Deduplicate and store in pincodes.digipin_cells
 * 
 * Performance:
 * - Uses existing H3 cache (30.5M cells)
 * - H3→DIGIPIN conversion via h3-digipin library
 * - Expected: ~5-10 minutes for all 19,287 pincodes
 * 
 * Output:
 * - ~120-180M DIGIPIN cells total (~6,328 per pincode avg)
 * - Storage: ~1.2GB in PostgreSQL
 * - GIN index for fast DIGIPIN→Pincode lookups
 */
@Injectable()
export class DigipinIndexService {
  private readonly logger = new Logger(DigipinIndexService.name);
  private readonly DIGIPIN_LEVEL = 6; // Equivalent to H3 resolution 9
  private readonly BATCH_SIZE = 100;
  private readonly spatialConverter: SpatialConverter;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    this.spatialConverter = new SpatialConverter();
  }

  /**
   * Build DIGIPIN index for all pincodes
   */
  async buildDigipinIndex(): Promise<void> {
    const startTime = Date.now();
    
    this.logger.log('🚀 Starting DIGIPIN index build...');
    this.logger.log(`📊 Target: DIGIPIN level ${this.DIGIPIN_LEVEL}`);
    
    // Get total count
    const countResult = await this.dataSource.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE h3_cells IS NOT NULL AND array_length(h3_cells, 1) > 0) as with_h3
       FROM pincodes`,
    );
    
    const totalPincodes = parseInt(countResult[0].total);
    const pincodesWithH3 = parseInt(countResult[0].with_h3);
    const pincodesWithoutH3 = totalPincodes - pincodesWithH3;
    
    this.logger.log(`📋 Total pincodes: ${totalPincodes}`);
    this.logger.log(`✅ With H3 cells: ${pincodesWithH3}`);
    this.logger.log(`⏭️  Without H3 cells (will skip): ${pincodesWithoutH3}`);
    
    // Process in batches
    let processed = 0;
    let skipped = 0;
    let totalDigipinCells = 0;
    
    const pincodes = await this.dataSource.query(
      `SELECT pincode, h3_cells 
       FROM pincodes 
       WHERE h3_cells IS NOT NULL 
         AND array_length(h3_cells, 1) > 0
       ORDER BY pincode`,
    );
    
    this.logger.log(`🔄 Processing ${pincodes.length} pincodes in batches of ${this.BATCH_SIZE}...`);
    
    for (let i = 0; i < pincodes.length; i += this.BATCH_SIZE) {
      const batch = pincodes.slice(i, i + this.BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(p => this.processPincode(p)),
      );
      
      // Update statistics
      for (const result of batchResults) {
        if (result.success) {
          processed++;
          totalDigipinCells += result.cellCount;
        } else {
          skipped++;
        }
      }
      
      // Log progress every 1000 pincodes
      if ((i + this.BATCH_SIZE) % 1000 === 0 || i + this.BATCH_SIZE >= pincodes.length) {
        const progress = Math.min(100, ((i + this.BATCH_SIZE) / pincodes.length) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const avgPerPincode = totalDigipinCells / Math.max(1, processed);
        
        this.logger.log(
          `📈 Progress: ${progress}% | ` +
          `Processed: ${processed} | ` +
          `Skipped: ${skipped} | ` +
          `Avg DIGIPIN/pincode: ${avgPerPincode.toFixed(0)} | ` +
          `Elapsed: ${elapsed}s`,
        );
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgDigipinPerPincode = (totalDigipinCells / processed).toFixed(0);
    
    this.logger.log('');
    this.logger.log('✅ DIGIPIN index build complete!');
    this.logger.log(`📊 Summary:`);
    this.logger.log(`   - Total pincodes processed: ${processed}`);
    this.logger.log(`   - Pincodes skipped: ${skipped}`);
    this.logger.log(`   - Total DIGIPIN cells: ${totalDigipinCells.toLocaleString()}`);
    this.logger.log(`   - Average cells per pincode: ${avgDigipinPerPincode}`);
    this.logger.log(`   - Total time: ${totalTime}s`);
    this.logger.log('');
  }

  /**
   * Process a single pincode: H3 cells → DIGIPIN cells
   */
  private async processPincode(
    pincodeData: any,
  ): Promise<{ success: boolean; cellCount: number }> {
    try {
      const { pincode, h3_cells } = pincodeData;
      
      // Convert each H3 cell to DIGIPIN cells
      const digipinSet = new Set<string>();
      
      for (const h3Cell of h3_cells) {
        try {
          // Get ALL overlapping DIGIPIN cells for this H3 cell
          const digipinCells = this.spatialConverter.h3ToDigipin(
            h3Cell,
            this.DIGIPIN_LEVEL,
          );
          
          digipinCells.forEach(dp => digipinSet.add(dp));
        } catch (error) {
          this.logger.warn(
            `⚠️  Failed to convert H3 ${h3Cell} to DIGIPIN for pincode ${pincode}: ${error.message}`,
          );
          // Continue with other cells
        }
      }
      
      const digipinCells = Array.from(digipinSet).sort();
      
      if (digipinCells.length === 0) {
        this.logger.warn(`⚠️  No DIGIPIN cells generated for pincode ${pincode}`);
        return { success: false, cellCount: 0 };
      }
      
      // Update database
      await this.dataSource.query(
        `UPDATE pincodes 
         SET digipin_cells = $1 
         WHERE pincode = $2`,
        [digipinCells, pincode],
      );
      
      return { success: true, cellCount: digipinCells.length };
    } catch (error) {
      this.logger.error(
        `❌ Failed to process pincode ${pincodeData.pincode}: ${error.message}`,
      );
      return { success: false, cellCount: 0 };
    }
  }
}
