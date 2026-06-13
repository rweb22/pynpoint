import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Not, IsNull } from 'typeorm';
import { createReadStream, createWriteStream } from 'fs';
import { access, unlink } from 'fs/promises';
import { parse } from 'csv-parse';
import * as https from 'https';
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
   *
   * Criteria:
   * - At least 160,000 post offices (threshold: 165,627 expected, allow for ~3% tolerance)
   * - At least 19,000 pincodes updated with metadata
   *
   * This prevents partial ingestions and ensures data integrity.
   */
  async checkCSVDataExists(): Promise<boolean> {
    try {
      const postOfficeCount = await this.postOfficeRepository.count();
      const pincodeWithStateCount = await this.pincodeRepository.count({
        where: {
          state: Not(IsNull()),
        },
      });

      // Removed debug logging to reduce log spam (500/s limit on Railway)

      // Require minimum thresholds to consider CSV data as "ingested"
      const MIN_POST_OFFICES = 160000; // ~97% of 165,627
      const MIN_PINCODES_WITH_METADATA = 19000; // ~97% of 19,586

      const hasEnoughPostOffices = postOfficeCount >= MIN_POST_OFFICES;
      const hasEnoughMetadata = pincodeWithStateCount >= MIN_PINCODES_WITH_METADATA;

      return hasEnoughPostOffices && hasEnoughMetadata;
    } catch (error) {
      this.logger.error('Error checking CSV data existence:', error);
      throw error;
    }
  }

  /**
   * Download CSV file from URL with retry logic
   */
  private async downloadCSV(
    url: string,
    destPath: string,
    maxRetries = 3,
  ): Promise<void> {
    this.logger.log(`Downloading CSV from ${url}...`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const file = createWriteStream(destPath);
          const timeout = setTimeout(() => {
            file.close();
            reject(new Error('Download timeout (60s)'));
          }, 60000); // 60s timeout

          https
            .get(url, (response) => {
              if (response.statusCode !== 200) {
                clearTimeout(timeout);
                file.close();
                reject(
                  new Error(
                    `Failed to download CSV: HTTP ${response.statusCode}`,
                  ),
                );
                return;
              }

              response.pipe(file);

              file.on('finish', () => {
                clearTimeout(timeout);
                file.close();
                resolve();
              });
            })
            .on('error', (err) => {
              clearTimeout(timeout);
              file.close();
              unlink(destPath).catch(() => {});
              reject(err);
            });

          file.on('error', (err) => {
            clearTimeout(timeout);
            file.close();
            unlink(destPath).catch(() => {});
            reject(err);
          });
        });

        this.logger.log('✅ CSV download complete');
        return; // Success
      } catch (error) {
        this.logger.warn(
          `Download attempt ${attempt}/${maxRetries} failed: ${error.message}`,
        );

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to download CSV after ${maxRetries} attempts: ${error.message}`,
          );
        }

        // Wait before retry (exponential backoff)
        const waitMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        this.logger.log(`Retrying in ${waitMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  /**
   * Ingest BharatPin CSV data
   *
   * Downloads CSV if not present locally, then processes it.
   *
   * @param force - If true, re-ingest even if data exists
   */
  async ingestCSVData(force = false): Promise<void> {
    const forceReingest = force || process.env.FORCE_REINGEST_CSV === 'true';

    if (!forceReingest && (await this.checkCSVDataExists())) {
      this.logger.log('CSV data already exists, skipping ingestion');
      return;
    }

    if (forceReingest) {
      this.logger.log('Force re-ingestion: clearing existing CSV data...');
      await this.postOfficeRepository.delete({});
    }

    // Download CSV if needed
    const csvUrl =
      process.env.CSV_DATA_URL ||
      'https://raw.githubusercontent.com/jeet308/bharatpin/main/src/bharatpin/data/pincodes.csv';
    const csvPath = '/tmp/bharatpin_pincodes_2026.csv';

    let fileExists = false;
    try {
      await access(csvPath);
      fileExists = true;
      this.logger.log(`Using existing CSV file at ${csvPath}`);
    } catch {
      // File doesn't exist, need to download
    }

    if (!fileExists) {
      try {
        await this.downloadCSV(csvUrl, csvPath);
      } catch (error) {
        this.logger.error(`Failed to download CSV: ${error.message}`);
        // Check if a cached file exists from a previous run
        try {
          await access(csvPath);
          this.logger.warn(
            'Using cached CSV file from failed download (file may be incomplete)',
          );
        } catch {
          throw new Error(
            `CSV download failed and no cached file available: ${error.message}`,
          );
        }
      }
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

    // Step 2: Update/insert pincodes table FIRST (so foreign key constraint is satisfied)
    this.logger.log('🔄 Updating pincodes table...');
    const { updated, inserted } = await this.updatePincodesFromCSV(pincodeMap);

    // Step 3: Bulk insert post offices AFTER pincodes exist
    this.logger.log('💾 Inserting post offices...');
    await this.bulkInsertPostOffices(records);

    // Summary
    this.logger.log('');
    this.logger.log('✅ CSV ingestion complete');
    this.logger.log('📊 Summary:');
    this.logger.log(`  • Post offices inserted: ${records.length.toLocaleString()}`);
    this.logger.log(`  • Unique pincodes in CSV: ${pincodeMap.size.toLocaleString()}`);
    this.logger.log(`  • Pincodes updated (with boundaries): ${updated.toLocaleString()}`);
    this.logger.log(`  • Pincodes inserted (without boundaries): ${inserted.toLocaleString()}`);
    this.logger.log(`  • Total pincodes in database: ${(updated + inserted).toLocaleString()}`);
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
      if (isNaN(parsed)) return null;

      // Round to 7 decimal places to fit DECIMAL(10,7)
      // This gives ~11mm precision, more than enough for postal addresses
      return Math.round(parsed * 10000000) / 10000000;
    };

    // Validate pincode length (must be exactly 6 digits)
    let pincode = row.pincode?.trim() || null;
    if (pincode && pincode.length > 6) {
      pincode = pincode.substring(0, 6); // Truncate to 6 characters
    }

    return {
      pincode,
      officename: row.officename?.trim().substring(0, 200) || null, // Truncate to column length
      area: normalize(row.area)?.substring(0, 200) || null,
      officetype: row.officetype?.trim().toUpperCase() || null, // Keep uppercase for HO/SO/BO
      delivery: normalize(row.delivery)?.substring(0, 20) || null,
      district: normalize(row.district)?.substring(0, 100) || null,
      state: normalize(row.state)?.substring(0, 100) || null,
      division: row.division?.trim().substring(0, 100) || null,
      region: row.region?.trim().substring(0, 100) || null,
      circle: row.circle?.trim().substring(0, 100) || null,
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

      try {
        await this.postOfficeRepository
          .createQueryBuilder()
          .insert()
          .into(PostOffice)
          .values(batch)
          .execute();

        inserted += batch.length;

        // Less aggressive logging - only every 20k records
        if (inserted % 20000 === 0 || inserted === records.length) {
          this.logger.log(`  Progress: ${inserted.toLocaleString()} / ${records.length.toLocaleString()} post offices`);
        }
      } catch (error) {
        this.logger.error(`Failed to insert batch ${i / BATCH_SIZE + 1} (records ${i}-${i + batch.length - 1})`);
        this.logger.error(`Error: ${error.message}`);

        // Log first 3 records from failed batch for debugging
        this.logger.error('Sample records from failed batch:');
        batch.slice(0, 3).forEach((record, idx) => {
          this.logger.error(`  Record ${i + idx}: pincode=${record.pincode}, lat=${record.latitude}, lng=${record.longitude}, office=${record.officename}`);
        });

        throw error;
      }
    }

    this.logger.log(`✅ Inserted ${inserted.toLocaleString()} post offices`);
  }

  /**
   * Update pincodes table with canonical data from CSV
   * - Updates existing pincodes (with boundaries) with correct state/district/city
   * - Inserts new pincodes (without boundaries) that exist in CSV but not in GeoJSON
   *
   * @returns Object with counts of updated and inserted pincodes
   */
  private async updatePincodesFromCSV(
    pincodeMap: Map<string, any[]>,
  ): Promise<{ updated: number; inserted: number }> {
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
            state: canonical.state?.substring(0, 100) || null,
            district: canonical.district?.substring(0, 100) || null,
            city: canonical.area?.substring(0, 100) || null,
            office_name: canonical.officename?.substring(0, 200) || null,
          },
        );
        updated++;
      } else {
        // New pincode (exists in CSV but not in GeoJSON)
        newPincodes.push({
          pincode: pincode?.substring(0, 6),
          state: canonical.state?.substring(0, 100) || null,
          district: canonical.district?.substring(0, 100) || null,
          city: canonical.area?.substring(0, 100) || null,
          office_name: canonical.officename?.substring(0, 200) || null,
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

        try {
          await this.pincodeRepository
            .createQueryBuilder()
            .insert()
            .into(Pincode)
            .values(batch)
            .execute();
        } catch (error) {
          this.logger.error(`Failed to insert pincode batch ${i / BATCH_SIZE + 1}`);
          this.logger.error(`Error: ${error.message}`);
          this.logger.error('Sample pincodes from failed batch:');
          batch.slice(0, 3).forEach((pc, idx) => {
            this.logger.error(`  Pincode ${i + idx}: pincode=${pc.pincode}, state=${pc.state}, district=${pc.district}, city=${pc.city}, office=${pc.office_name}`);
          });
          throw error;
        }
      }
    }

    this.logger.log(
      `✅ Updated ${updated.toLocaleString()} pincodes, inserted ${inserted.toLocaleString()} new pincodes`,
    );

    return { updated, inserted };
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