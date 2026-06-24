import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createWriteStream } from 'fs';
import { unlink, readFile } from 'fs/promises';
import * as https from 'https';
import { Pincode } from '../database/entities/pincode.entity';
import { PostOffice } from '../database/entities/postoffice.entity';

/**
 * OfficialJSONIngestionService
 *
 * Phase 2 of data ingestion: Official data.gov.in JSON from Google Drive
 *
 * Downloads and ingests:
 * 1. 19,586 pincodes → pincodes table (with correct state/district, NO boundaries yet)
 * 2. 165,627 postoffices → postoffices table
 *
 * Source: https://drive.google.com/uc?export=download&id=1n2gZPURDVlnBfQk3rm8h7V6vNQiqyGi-
 * Data: Official data.gov.in May 2025 dataset
 *
 * This runs BEFORE GeoJSON boundary enrichment.
 */
@Injectable()
export class OfficialJSONIngestionService {
  private readonly logger = new Logger(OfficialJSONIngestionService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    @InjectRepository(PostOffice)
    private readonly postOfficeRepository: Repository<PostOffice>,
  ) {}

  /**
   * Check if official JSON data has been ingested
   */
  async checkDataExists(): Promise<boolean> {
    try {
      const pincodeCount = await this.pincodeRepository.count();
      const postOfficeCount = await this.postOfficeRepository.count();

      // Require minimum thresholds
      const MIN_PINCODES = 19000; // ~97% of 19,586
      const MIN_POST_OFFICES = 160000; // ~97% of 165,627

      return pincodeCount >= MIN_PINCODES && postOfficeCount >= MIN_POST_OFFICES;
    } catch (error) {
      this.logger.error('Error checking data existence:', error);
      throw error;
    }
  }

  /**
   * Download and ingest official JSON data
   */
  async ingestData(force = false): Promise<void> {
    const forceReingest = force || process.env.FORCE_REINGEST_JSON === 'true';

    if (!forceReingest && (await this.checkDataExists())) {
      this.logger.log('Official JSON data already exists, skipping ingestion');
      return;
    }

    if (forceReingest) {
      this.logger.log('Force re-ingestion: clearing existing data...');
      await this.postOfficeRepository.delete({});
      await this.pincodeRepository.delete({});
    }

    const jsonUrl =
      process.env.OFFICIAL_JSON_URL ||
      'https://drive.google.com/uc?export=download&id=1n2gZPURDVlnBfQk3rm8h7V6vNQiqyGi-';

    this.logger.log(`Downloading official JSON from Google Drive...`);

    try {
      // Step 1: Download JSON file
      const tempFile = '/tmp/official-pincode-data.json';
      await this.downloadFile(jsonUrl, tempFile);
      this.logger.log('✅ Download complete');

      // Step 2: Parse and process
      this.logger.log('📊 Reading and parsing JSON...');
      const data = await this.parseJSON(tempFile);
      this.logger.log(`✅ Parsed ${data.length.toLocaleString()} records`);

      // Step 3: Extract unique pincodes and aggregate
      this.logger.log('🔄 Processing pincodes...');
      const pincodeData = this.aggregatePincodes(data);
      this.logger.log(`✅ Found ${pincodeData.size.toLocaleString()} unique pincodes`);

      // Step 4: Insert pincodes FIRST (foreign key parent)
      this.logger.log('💾 Inserting pincodes...');
      await this.insertPincodes(pincodeData);

      // Step 5: Insert postoffices AFTER pincodes exist
      this.logger.log('💾 Inserting postoffices...');
      await this.insertPostOffices(data);

      // Step 6: Cleanup
      await unlink(tempFile).catch(() => {});
      this.logger.log('✅ Temporary file cleaned up');

      // Summary
      this.logger.log('');
      this.logger.log('✅ Official JSON ingestion complete');
      this.logger.log('📊 Summary:');
      this.logger.log(`  • Pincodes inserted: ${pincodeData.size.toLocaleString()}`);
      this.logger.log(`  • Postoffices inserted: ${data.length.toLocaleString()}`);
    } catch (error) {
      this.logger.error('Official JSON ingestion failed:', error.stack);
      throw error;
    }
  }

  /**
   * Download file from URL (with Google Drive redirect handling)
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);
      let redirectCount = 0;
      const MAX_REDIRECTS = 5;

      const download = (currentUrl: string) => {
        https
          .get(currentUrl, (response) => {
            // Handle redirects (Google Drive confirmation page)
            if (response.statusCode === 302 || response.statusCode === 301) {
              redirectCount++;
              if (redirectCount > MAX_REDIRECTS) {
                reject(new Error('Too many redirects'));
                return;
              }
              const redirectUrl = response.headers.location;
              this.logger.debug(`Following redirect to: ${redirectUrl}`);
              download(redirectUrl!);
              return;
            }

            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode}: ${currentUrl}`));
              return;
            }

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;

            response.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              if (totalBytes > 0) {
                const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
                if (downloadedBytes % Math.floor(totalBytes / 10) < chunk.length) {
                  this.logger.log(`  Download progress: ${progress}%`);
                }
              }
            });

            response.pipe(file);

            file.on('finish', () => {
              file.close();
              resolve();
            });
          })
          .on('error', (err) => {
            unlink(destPath).catch(() => {});
            reject(err);
          });

        file.on('error', (err) => {
          unlink(destPath).catch(() => {});
          reject(err);
        });
      };

      download(url);
    });
  }

  /**
   * Parse JSON file
   */
  private async parseJSON(filePath: string): Promise<any[]> {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data)) {
      throw new Error('Invalid JSON: expected array of records');
    }

    return data;
  }

  /**
   * Aggregate pincode data from all postoffices
   * Selects canonical data: prioritize HO > SO > BO
   */
  private aggregatePincodes(records: any[]): Map<string, any> {
    const pincodeMap = new Map<string, any>();

    for (const record of records) {
      const pincode = record.pincode?.trim();
      if (!pincode || pincode.length !== 6) continue;

      if (!pincodeMap.has(pincode)) {
        pincodeMap.set(pincode, {
          pincode,
          state: this.normalize(record.statename),
          district: this.normalize(record.district),
          city: null, // No city/area in official JSON
          office_name: record.officename?.trim().substring(0, 200),
          officetype: record.officetype?.trim().toUpperCase(),
        });
      } else {
        // Update if we found a higher priority office
        const existing = pincodeMap.get(pincode)!;
        const newPriority = this.getOfficePriority(record.officetype);
        const existingPriority = this.getOfficePriority(existing.officetype);

        if (newPriority < existingPriority) {
          pincodeMap.set(pincode, {
            pincode,
            state: this.normalize(record.statename),
            district: this.normalize(record.district),
            city: null,
            office_name: record.officename?.trim().substring(0, 200),
            officetype: record.officetype?.trim().toUpperCase(),
          });
        }
      }
    }

    return pincodeMap;
  }

  /**
   * Get office type priority (HO=1, SO=2, BO=3)
   */
  private getOfficePriority(officetype: string | null): number {
    const priority: { [key: string]: number } = { HO: 1, SO: 2, PO: 2, BO: 3 };
    const key = officetype?.toUpperCase();
    return key ? (priority[key] || 999) : 999;
  }

  /**
   * Normalize text: lowercase, trim
   */
  private normalize(value: string | null | undefined): string | null {
    if (!value || value.trim() === '') return null;
    return value.trim().toLowerCase();
  }

  /**
   * Bulk insert pincodes
   */
  private async insertPincodes(pincodeData: Map<string, any>): Promise<void> {
    const pincodes = Array.from(pincodeData.values()).map((data) => ({
      pincode: data.pincode.substring(0, 6),
      state: data.state?.substring(0, 100) || null,
      district: data.district?.substring(0, 100) || null,
      city: null as string | null,
      office_name: data.office_name?.substring(0, 200) || null,
      boundary: undefined, // Will be filled in Phase 3
      centroid: undefined, // Will be filled in Phase 3
      is_active: true,
    }));

    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < pincodes.length; i += BATCH_SIZE) {
      const batch = pincodes.slice(i, i + BATCH_SIZE);

      await this.pincodeRepository
        .createQueryBuilder()
        .insert()
        .into(Pincode)
        .values(batch as any)
        .orIgnore()
        .execute();

      inserted += batch.length;

      if (inserted % 5000 === 0 || inserted === pincodes.length) {
        this.logger.log(`  Progress: ${inserted.toLocaleString()} / ${pincodes.length.toLocaleString()} pincodes`);
      }
    }

    this.logger.log(`✅ Inserted ${inserted.toLocaleString()} pincodes`);
  }

  /**
   * Bulk insert postoffices
   */
  private async insertPostOffices(records: any[]): Promise<void> {
    const postoffices = records.map((record) => ({
      pincode: record.pincode?.trim().substring(0, 6),
      officename: record.officename?.trim().substring(0, 200),

      // Map PO → SO
      officetype:
        record.officetype?.trim().toUpperCase() === 'PO'
          ? 'SO'
          : record.officetype?.trim().toUpperCase(),

      delivery: this.normalize(record.delivery)?.substring(0, 20),
      area: undefined, // Not in official JSON
      district: this.normalize(record.district)?.substring(0, 100),
      state: this.normalize(record.statename)?.substring(0, 100),

      // Postal hierarchy
      division: record.divisionname?.trim().substring(0, 100) || null,
      region: record.regionname?.trim().substring(0, 100) || null,
      circle: record.circlename?.trim().substring(0, 100) || null,

      // GPS coordinates
      latitude: this.parseCoordinate(record.latitude),
      longitude: this.parseCoordinate(record.longitude),
    }));

    const BATCH_SIZE = 1000;
    let inserted = 0;

    for (let i = 0; i < postoffices.length; i += BATCH_SIZE) {
      const batch = postoffices.slice(i, i + BATCH_SIZE);

      try {
        await this.postOfficeRepository
          .createQueryBuilder()
          .insert()
          .into(PostOffice)
          .values(batch as any)
          .orIgnore()
          .execute();

        inserted += batch.length;

        if (inserted % 20000 === 0 || inserted === postoffices.length) {
          this.logger.log(`  Progress: ${inserted.toLocaleString()} / ${postoffices.length.toLocaleString()} postoffices`);
        }
      } catch (error) {
        this.logger.error(`Failed to insert batch at index ${i}:`, error.message);
        this.logger.error('Sample record:', batch[0]);
        throw error;
      }
    }

    this.logger.log(`✅ Inserted ${inserted.toLocaleString()} postoffices`);
  }

  /**
   * Parse coordinate value
   */
  private parseCoordinate(coord: string | null | undefined): number | null {
    if (!coord || coord.trim() === '' || coord === 'NA') return null;

    const parsed = parseFloat(coord);
    if (isNaN(parsed)) return null;

    // Round to 7 decimal places (DECIMAL(10,7))
    const rounded = Math.round(parsed * 10000000) / 10000000;

    // Validate range
    if (Math.abs(rounded) > 999) return null;

    return rounded;
  }
}
