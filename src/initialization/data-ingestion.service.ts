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
      'https://data.gov.in/api/datastore/resource.json?resource_id=pincode-boundaries';
    const expectedChecksum = process.env.PINCODE_DATA_CHECKSUM;

    this.logger.log(`Downloading pincode data from ${dataUrl}...`);

    try {
      // Step 1: Download file
      const tempFile = '/tmp/pincode-boundaries.geojson.gz';
      await this.downloadFile(dataUrl, tempFile);
      this.logger.log('✅ Download complete');

      // Step 2: Verify checksum (if configured)
      if (expectedChecksum) {
        this.logger.log('Verifying file integrity...');
        await this.verifyChecksum(tempFile, expectedChecksum);
        this.logger.log('✅ Checksum verified');
      }

      // Step 3: Decompress
      const decompressedFile = '/tmp/pincode-boundaries.geojson';
      await this.decompressFile(tempFile, decompressedFile);
      this.logger.log('✅ File decompressed');

      // Step 4: Parse and insert into PostgreSQL
      this.logger.log('Parsing GeoJSON and inserting into database...');
      await this.parseAndInsert(decompressedFile);
      this.logger.log('✅ Data inserted into PostgreSQL');

      // Step 5: Cleanup
      await this.cleanup([tempFile, decompressedFile]);
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

      for (let i = 0; i < geojson.features.length; i += batchSize) {
        const batch = geojson.features.slice(i, i + batchSize);

        // Transform features to Pincode entities
        const entities = batch.map((feature: any) => {
          const pincode = this.pincodeRepository.create({
            pincode: feature.properties.pincode || feature.properties.PINCODE,
            state: feature.properties.state || feature.properties.STATE,
            district: feature.properties.district || feature.properties.DISTRICT,
            city: feature.properties.city || feature.properties.CITY,
            office_name: feature.properties.office_name || feature.properties.OFFICE_NAME,
            // Convert GeoJSON geometry to PostGIS format
            // TypeORM will use ST_GeomFromGeoJSON() function
            boundary: JSON.stringify(feature.geometry),
            is_active: true,
          });

          return pincode;
        });

        // Bulk insert
        await this.pincodeRepository.save(entities, { chunk: 100 });

        processedCount += entities.length;
        const progress = ((processedCount / geojson.features.length) * 100).toFixed(1);
        this.logger.log(
          `Inserted ${processedCount}/${geojson.features.length} (${progress}%)`,
        );
      }

      this.logger.log(`✅ Successfully inserted ${processedCount} pincodes`);
    } catch (error) {
      this.logger.error('Failed to parse and insert GeoJSON:', error.stack);
      throw error;
    }
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

