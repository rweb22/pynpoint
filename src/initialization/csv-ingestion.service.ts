import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';

/**
 * CSVIngestionService
 *
 * Handles ingestion of BharatPin 2026 CSV data into:
 * 1. postoffices table - All 165,627 post office records
 * 2. pincodes table - Updates state/district/city for existing pincodes, adds new ones without boundaries
 *
 * Data Processing:
 * - Normalizes text: lowercase, trimmed, no extra whitespace
 * - Handles missing GPS coordinates gracefully
 * - Groups by pincode to determine canonical state/district/city (prioritizes HO > SO > BO)
 * - Bulk inserts for performance
 *
 * Idempotent: Safe to run multiple times, checks for existing data
 */
@Injectable()
export class CSVIngestionService {
  private readonly logger = new Logger(CSVIngestionService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    @InjectRepository(PostOffice)
    private readonly postOfficeRepository: Repository<PostOffice>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Check if CSV data has already been ingested
   */
  async checkCSVDataExists(): Promise<boolean> {
    try {
      const count = await this.postOfficeRepository.count();
      this.logger.debug(`Found ${count} post offices in database`);
      return count > 0;
    } catch (error) {
      this.logger.error('Error checking CSV data existence:', error);
      throw error;
    }
  }

  /**
   * Ingest BharatPin CSV data
   *
   * @param csvPath - Path to bharatpin_pincodes_2026.csv
   * @param force - If true, re-ingest even if data exists
   */
  async ingestCSVData(csvPath: string, force = false): Promise<void> {
    const forceReingest = force || process.env.FORCE_REINGEST_CSV === 'true';

    if (!forceReingest && (await this.checkCSVDataExists())) {
      this.logger.log('CSV data already exists, skipping ingestion');
      return;
    }

    if (forceReingest) {
      this.logger.log('Force re-ingestion: clearing existing CSV data...');
      await this.postOfficeRepository.delete({});
    }

    this.logger.log(`📊 Reading CSV from ${csvPath}...`);

    const records: any[] = [];
    const pincodeMap = new Map<string, any[]>(); // pincode -> array of offices

    // Step 1: Parse CSV
    await new Promise<void>((resolve, reject) => {
      createReadStream(csvPath)
        .pipe(parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }))
        .on('data', (row) => {
          const normalized = this.normalizeRow(row);
          records.push(normalized);

          // Group by pincode for aggregation
          if (!pincodeMap.has(normalized.pincode)) {
            pincodeMap.set(normalized.pincode, []);
          }
          pincodeMap.get(normalized.pincode)!.push(normalized);
        })
        .on('end', () => {
          this.logger.log(`✅ Parsed ${records.length.toLocaleString()} post office records`);
          this.logger.log(`📍 Found ${pincodeMap.size.toLocaleString()} unique pincodes`);
          resolve();
        })
        .on('error', reject);
    });

    // Step 2: Bulk insert post offices
    this.logger.log('💾 Inserting post offices...');
    await this.bulkInsertPostOffices(records);

    // Step 3: Update/insert pincodes table
    this.logger.log('🔄 Updating pincodes table...');
    await this.updatePincodesFromCSV(pincodeMap);

    this.logger.log('✅ CSV ingestion complete');
  }

  /**
   * Normalize a CSV row: trim, lowercase where appropriate, handle nulls
   */
  private normalizeRow(row: any): any {
    const normalize = (str: string | null | undefined): string | null => {
      if (!str || str.trim() === '') return null;
      return str.trim().toLowerCase();
    };

    const parseCoordinate = (coord: string | null | undefined): number | null => {
      if (!coord || coord.trim() === '') return null;
      const parsed = parseFloat(coord);
      return isNaN(parsed) ? null : parsed;
    };

    return {
      pincode: row.pincode?.trim() || null,
      officename: row.officename?.trim() || null,
      area: normalize(row.area),
      officetype: row.officetype?.trim().toUpperCase() || null, // Keep uppercase for HO/SO/BO
      delivery: normalize(row.delivery),
      district: normalize(row.district),
      state: normalize(row.state),
      division: row.division?.trim() || null,
      region: row.region?.trim() || null,
      circle: row.circle?.trim() || null,
      latitude: parseCoordinate(row.latitude),
      longitude: parseCoordinate(row.longitude),
    };
  }

  /**
   * Bulk insert post offices in batches
   */
  private async bulkInsertPostOffices(records: any[]): Promise<void> {
    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);

      await this.postOfficeRepository
        .createQueryBuilder()
        .insert()
        .into(PostOffice)
        .values(batch)
        .execute();

      inserted += batch.length;

      if (inserted % 10000 === 0 || inserted === records.length) {
        this.logger.log(`  Progress: ${inserted.toLocaleString()} / ${records.length.toLocaleString()} post offices`);
      }
    }

    this.logger.log(`✅ Inserted ${inserted.toLocaleString()} post offices`);
  }

  /**
   * Update pincodes table with canonical data from CSV
   * - Updates existing pincodes (with boundaries) with correct state/district/city
   * - Inserts new pincodes (without boundaries) that exist in CSV but not in GeoJSON
   */
  private async updatePincodesFromCSV(pincodeMap: Map<string, any[]>): Promise<void> {
    const existingPincodes = await this.pincodeRepository.find({
      select: ['pincode'],
    });
    const existingSet = new Set(existingPincodes.map((p) => p.pincode));

    let updated = 0;
    let inserted = 0;
    const newPincodes: Partial<Pincode>[] = [];

    for (const [pincode, offices] of pincodeMap.entries()) {
      const canonical = this.getCanonicalOffice(offices);

      if (existingSet.has(pincode)) {
        // Update existing pincode with correct metadata
        await this.pincodeRepository.update(
          { pincode },
          {
            state: canonical.state,
            district: canonical.district,
            city: canonical.area,
            office_name: canonical.officename,
          },
        );
        updated++;
      } else {
        // New pincode (exists in CSV but not in GeoJSON)
        newPincodes.push({
          pincode,
          state: canonical.state,
          district: canonical.district,
          city: canonical.area,
          office_name: canonical.officename,
          boundary: undefined, // No boundary data available
          centroid: undefined,
          is_active: true,
        });
        inserted++;
      }

      if ((updated + inserted) % 1000 === 0) {
        this.logger.log(`  Progress: ${updated} updated, ${inserted} new`);
      }
    }

    // Bulk insert new pincodes
    if (newPincodes.length > 0) {
      const BATCH_SIZE = 1000;
      for (let i = 0; i < newPincodes.length; i += BATCH_SIZE) {
        const batch = newPincodes.slice(i, i + BATCH_SIZE);
        await this.pincodeRepository
          .createQueryBuilder()
          .insert()
          .into(Pincode)
          .values(batch)
          .execute();
      }
    }

    this.logger.log(`✅ Updated ${updated.toLocaleString()} pincodes, inserted ${inserted.toLocaleString()} new pincodes`);
  }

  /**
   * Get canonical office for a pincode (prioritizes HO > SO > BO, then delivery status)
   */
  private getCanonicalOffice(offices: any[]): any {
    const priority = { HO: 1, SO: 2, BO: 3 };

    return offices.sort((a, b) => {
      // First priority: office type (HO > SO > BO)
      const typeA = priority[a.officetype] || 999;
      const typeB = priority[b.officetype] || 999;
      if (typeA !== typeB) return typeA - typeB;

      // Second priority: delivery status (delivery > non delivery)
      if (a.delivery === 'delivery' && b.delivery !== 'delivery') return -1;
      if (a.delivery !== 'delivery' && b.delivery === 'delivery') return 1;

      return 0;
    })[0];
  }
}