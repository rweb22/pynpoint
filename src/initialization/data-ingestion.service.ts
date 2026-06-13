import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createWriteStream, createReadStream } from 'fs';
import { unlink, access, readFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import * as https from 'https';
import * as crypto from 'crypto';
import { Pincode } from '../database/entities/pincode.entity';

/**
 * DataIngestionService
 *
 * Handles downloading and ingesting pincode boundary data from data.gov.in
 * into the PostgreSQL pincodes table.
 *
 * Data Source: 29.71 MB GeoJSON (gzipped) from Indian government open data portal
 *
 * Process:
 * 1. Check if data already exists in PostgreSQL
 * 2. If missing, download GeoJSON from data.gov.in
 * 3. Verify checksum (prevent corruption/tampering)
 * 4. Decompress .gz file
 * 5. Parse GeoJSON and bulk insert into PostgreSQL
 * 6. Cleanup temporary files
 *
 * Idempotent: Safe to run multiple times, skips if data exists.
 */
@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
  ) {}

  /**
   * Check if pincode data already exists in PostgreSQL
   */
  async checkDataExists(): Promise<boolean> {
    try {
      const count = await this.pincodeRepository.count();
      this.logger.debug(`Found ${count} pincodes in database`);
      return count > 0;
    } catch (error) {
      this.logger.error('Error checking data existence:', error);
      throw error;
    }
  }

  /**
   * Download and ingest pincode boundary data
   *
   * @param force - If true, re-ingest even if data exists
   */
  async ingestData(force = false): Promise<void> {
    const forceReingest = force || process.env.FORCE_REINGEST_DATA === 'true';

    if (!forceReingest && (await this.checkDataExists())) {
      this.logger.log('Pincode data already exists, skipping ingestion');
      return;
    }

    const dataUrl =
      process.env.PINCODE_DATA_URL ||
      'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/postal/boundaries/Datagov_Pincode_Boundaries.geojson';
    const expectedChecksum = process.env.PINCODE_DATA_CHECKSUM;
    const isGzipped = dataUrl.endsWith('.gz');

    this.logger.log(`Downloading pincode data from ${dataUrl}...`);

    try {
      // Step 1: Download file
      const tempFile = isGzipped
        ? '/tmp/pincode-boundaries.geojson.gz'
        : '/tmp/pincode-boundaries.geojson';

      await this.downloadFile(dataUrl, tempFile);
      this.logger.log('✅ Download complete');

      // Step 2: Verify checksum (if configured)
      if (expectedChecksum) {
        this.logger.log('Verifying file integrity...');
        await this.verifyChecksum(tempFile, expectedChecksum);
        this.logger.log('✅ Checksum verified');
      }

      // Step 3: Decompress (if needed)
      let geojsonFile = tempFile;
      if (isGzipped) {
        const decompressedFile = '/tmp/pincode-boundaries.geojson';
        await this.decompressFile(tempFile, decompressedFile);
        this.logger.log('✅ File decompressed');
        geojsonFile = decompressedFile;
      } else {
        this.logger.log('✅ File is already uncompressed');
      }

      // Step 4: Parse and insert into PostgreSQL
      this.logger.log('Parsing GeoJSON and inserting into database...');
      await this.parseAndInsert(geojsonFile);
      this.logger.log('✅ Data inserted into PostgreSQL');

      // Step 5: Cleanup
      const filesToClean = isGzipped ? [tempFile, geojsonFile] : [tempFile];
      await this.cleanup(filesToClean);
      this.logger.log('✅ Temporary files cleaned up');
    } catch (error) {
      this.logger.error('Data ingestion failed:', error.stack);
      throw error;
    }
  }

  /**
   * Download file from URL to local path
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);

      https
        .get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${url}`));
            return;
          }

          const totalBytes = parseInt(
            response.headers['content-length'] || '0',
            10,
          );
          let downloadedBytes = 0;

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            const progress = ((downloadedBytes / totalBytes) * 100).toFixed(1);
            // Log progress every 10%
            if (downloadedBytes % Math.floor(totalBytes / 10) < chunk.length) {
              this.logger.debug(`Download progress: ${progress}%`);
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
    });
  }


  /**
   * Verify file checksum
   */
  private async verifyChecksum(
    filePath: string,
    expectedChecksum: string,
  ): Promise<void> {
    // Expected format: "sha256:abc123..."
    const [algorithm, expected] = expectedChecksum.split(':');

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => {
        const actual = hash.digest('hex');
        if (actual === expected) {
          resolve();
        } else {
          reject(
            new Error(
              `Checksum mismatch. Expected: ${expected}, Got: ${actual}`,
            ),
          );
        }
      });
      stream.on('error', reject);
    });
  }

  /**
   * Decompress .gz file
   */
  private async decompressFile(
    gzPath: string,
    destPath: string,
  ): Promise<void> {
    const source = createReadStream(gzPath);
    const destination = createWriteStream(destPath);
    const gunzip = createGunzip();

    await pipeline(source, gunzip, destination);
  }

  /**
   * Parse GeoJSON and bulk insert into PostgreSQL
   */
  private async parseAndInsert(geojsonPath: string): Promise<void> {
    this.logger.log('Parsing GeoJSON file...');

    try {
      // Read and parse GeoJSON
      const geojsonContent = await readFile(geojsonPath, 'utf-8');
      const geojson = JSON.parse(geojsonContent);

      if (!geojson.features || !Array.isArray(geojson.features)) {
        throw new Error('Invalid GeoJSON: missing features array');
      }

      this.logger.log(`Found ${geojson.features.length} features to insert`);

      // Process in batches for better performance
      const batchSize = 500;
      let processedCount = 0;
      const startTime = Date.now();

      this.logger.log(`Starting batch insertion (batch size: ${batchSize})...`);

      for (let i = 0; i < geojson.features.length; i += batchSize) {
        const batchStartTime = Date.now();
        const batch = geojson.features.slice(i, i + batchSize);

        // Build raw SQL INSERT with ST_GeogFromGeoJSON
        // TypeORM doesn't handle PostGIS geography types automatically
        const values = batch.map((feature: any, index: number) => {
          const props = feature.properties;

          const pincode = props.Pincode || props.pincode || props.PINCODE;
          const state = props.Circle || props.circle || props.state || props.STATE;
          const district = props.Division || props.division || props.district || props.DISTRICT;
          const city = props.Region || props.region || props.city || props.CITY;
          const officeName = props.Office_Name || props.office_name || props.OFFICE_NAME;
          const geometryJson = JSON.stringify(feature.geometry);

          // Log first feature for debugging
          if (i === 0 && index === 0) {
            this.logger.debug(`Sample feature - Pincode: ${pincode}, Type: ${feature.geometry.type}`);
          }

          return `(
            ${this.escapeString(pincode)},
            ST_GeogFromGeoJSON(${this.escapeString(geometryJson)}),
            ${this.escapeString(state)},
            ${this.escapeString(district)},
            ${this.escapeString(city)},
            ${this.escapeString(officeName)},
            true
          )`;
        }).join(',\n');

        const sql = `
          INSERT INTO pincodes (pincode, boundary, state, district, city, office_name, is_active)
          VALUES ${values}
          ON CONFLICT (pincode) DO NOTHING
        `;

        try {
          await this.pincodeRepository.query(sql);

          processedCount += batch.length;
          const progress = ((processedCount / geojson.features.length) * 100).toFixed(1);
          const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
          const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
          const estimatedRemaining = ((Date.now() - startTime) / processedCount * (geojson.features.length - processedCount) / 1000).toFixed(0);

          this.logger.log(
            `✓ Batch ${Math.floor(i / batchSize) + 1}: ${processedCount}/${geojson.features.length} (${progress}%) | ` +
            `Batch: ${batchDuration}s | Total: ${totalDuration}s | ETA: ~${estimatedRemaining}s`
          );
        } catch (error) {
          this.logger.error(`Failed to insert batch starting at index ${i}:`, error.message);
          this.logger.error(`First pincode in failed batch: ${batch[0]?.properties?.Pincode}`);
          throw error;
        }
      }

      this.logger.log(`✅ Successfully inserted ${processedCount} pincodes`);
    } catch (error) {
      this.logger.error('Failed to parse and insert GeoJSON:', error.stack);
      throw error;
    }
  }

  /**
   * Escape string for SQL (prevents SQL injection)
   */
  private escapeString(value: string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return 'NULL';
    }
    // Escape single quotes by doubling them
    const escaped = value.toString().replace(/'/g, "''");
    return `'${escaped}'`;
  }

  /**
   * Cleanup temporary files
   */
  private async cleanup(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await access(file);
        await unlink(file);
        this.logger.debug(`Deleted temporary file: ${file}`);
      } catch (error) {
        // File doesn't exist or can't be deleted - not critical
        this.logger.debug(`Could not delete ${file}: ${error.message}`);
      }
    }
  }
}

