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
 * Phase 3: Enriches existing pincodes with boundary data from GeoJSON
 *
 * NEW STRATEGY (2025-06):
 * - This service NO LONGER creates pincodes (that's done in Phase 2)
 * - It ONLY updates existing pincodes with boundary geometries
 * - Updates ~19,312 pincodes with MultiPolygon boundaries
 *
 * Data Source: Datagov_Pincode_Boundaries.geojson (87MB, local file)
 *
 * Process:
 * 1. Check if boundaries already exist
 * 2. Parse GeoJSON file
 * 3. For each feature: UPDATE existing pincode with boundary + centroid
 * 4. Log coverage statistics
 *
 * Idempotent: Safe to run multiple times, updates existing records.
 */
@Injectable()
export class DataIngestionService {
  private readonly logger = new Logger(DataIngestionService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
  ) {}

  /**
   * Check how many pincodes have boundary data
   */
  async checkBoundaryCount(): Promise<number> {
    try {
      const result = await this.pincodeRepository.query(
        'SELECT COUNT(*) as count FROM pincodes WHERE boundary IS NOT NULL',
      );
      const count = parseInt(result[0].count, 10);
      this.logger.debug(`Found ${count} pincodes with boundaries`);
      return count;
    } catch (error) {
      this.logger.error('Error checking boundary count:', error);
      throw error;
    }
  }

  /**
   * Enrich existing pincodes with boundary data from GeoJSON
   *
   * @param force - If true, re-enrich even if boundaries exist
   */
  async enrichBoundaries(force = false): Promise<void> {
    const forceEnrich = force || process.env.FORCE_ENRICH_BOUNDARIES === 'true';

    if (!forceEnrich) {
      const boundaryCount = await this.checkBoundaryCount();
      const MIN_BOUNDARIES = 19000; // ~97% of 19,312 expected

      if (boundaryCount >= MIN_BOUNDARIES) {
        this.logger.log(`Boundaries already exist (${boundaryCount.toLocaleString()}), skipping enrichment`);
        return;
      }
    }

    // Use local GeoJSON file or download from URL
    const geojsonFile =
      process.env.GEOJSON_FILE_PATH ||
      '/tmp/Datagov_Pincode_Boundaries.geojson';

    const geojsonUrl =
      process.env.GEOJSON_URL ||
      'https://pub-0429b8e3b5a946e69ea007df844a6f1c.r2.dev/postal/boundaries/Datagov_Pincode_Boundaries.geojson';

    this.logger.log(`Enriching pincodes with boundaries from GeoJSON...`);

    try {
      // Check if file exists, download if missing
      try {
        await access(geojsonFile);
        this.logger.log(`✅ Using existing GeoJSON file: ${geojsonFile}`);
      } catch {
        this.logger.log(`GeoJSON file not found locally, downloading from Cloudflare R2...`);
        await this.downloadFile(geojsonUrl, geojsonFile);
        this.logger.log('✅ Download complete');
      }

      // Step 1: Parse and update pincodes
      this.logger.log('Parsing GeoJSON and updating pincodes...');
      await this.parseAndEnrich(geojsonFile);
      this.logger.log('✅ Boundary enrichment complete');

      // Step 2: Log statistics
      const finalCount = await this.checkBoundaryCount();
      const totalPincodes = await this.pincodeRepository.count();
      const coverage = ((finalCount / totalPincodes) * 100).toFixed(1);

      this.logger.log('');
      this.logger.log('📊 Boundary Enrichment Summary:');
      this.logger.log(`  • Total pincodes: ${totalPincodes.toLocaleString()}`);
      this.logger.log(`  • With boundaries: ${finalCount.toLocaleString()}`);
      this.logger.log(`  • Coverage: ${coverage}%`);
      this.logger.log(`  • Missing: ${(totalPincodes - finalCount).toLocaleString()}`);
    } catch (error) {
      this.logger.error('Boundary enrichment failed:', error.stack);
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
   * Parse GeoJSON and UPDATE existing pincodes with boundary data
   */
  private async parseAndEnrich(geojsonPath: string): Promise<void> {
    this.logger.log('Parsing GeoJSON file...');

    try {
      // Read and parse GeoJSON
      const geojsonContent = await readFile(geojsonPath, 'utf-8');
      const geojson = JSON.parse(geojsonContent);

      if (!geojson.features || !Array.isArray(geojson.features)) {
        throw new Error('Invalid GeoJSON: missing features array');
      }

      this.logger.log(`Found ${geojson.features.length} features to process`);

      // Process in batches for better performance
      const batchSize = 500;
      let updatedCount = 0;
      let notFoundCount = 0;
      const startTime = Date.now();

      this.logger.log(`Starting batch UPDATE (batch size: ${batchSize})...`);

      for (let i = 0; i < geojson.features.length; i += batchSize) {
        const batchStartTime = Date.now();
        const batch = geojson.features.slice(i, i + batchSize);

        // Process each feature individually (UPDATE requires individual queries)
        for (const feature of batch) {
          const props = feature.properties;
          const pincode = props.Pincode || props.pincode || props.PINCODE;
          const geometryJson = JSON.stringify(feature.geometry);

          // Log first feature for debugging
          if (i === 0 && updatedCount === 0) {
            this.logger.debug(`Sample feature - Pincode: ${pincode}, Type: ${feature.geometry.type}`);
          }

          // Validate required fields
          if (!pincode) {
            this.logger.warn(`Skipping feature: missing pincode`);
            continue;
          }

          // UPDATE existing pincode with boundary and centroid
          // Note: We do NOT update state/district/city (those come from JSON in Phase 2)
          const sql = `
            UPDATE pincodes
            SET
              boundary = ST_GeomFromGeoJSON(${this.escapeString(geometryJson)})::geography,
              centroid = ST_Centroid(ST_GeomFromGeoJSON(${this.escapeString(geometryJson)}))::geography,
              updated_at = CURRENT_TIMESTAMP
            WHERE pincode = ${this.escapeString(pincode)}
          `;

          try {
            const result = await this.pincodeRepository.query(sql);

            // Check if row was updated (result[1] is the affected row count)
            if (result[1] > 0) {
              updatedCount++;
            } else {
              notFoundCount++;
              if (notFoundCount <= 5) {
                this.logger.debug(`Pincode ${pincode} not found in database (will skip)`);
              }
            }
          } catch (error) {
            this.logger.error(`Failed to update pincode ${pincode}:`, error.message);
            // Continue with next pincode instead of failing entire batch
          }
        }

        // Log progress
        const processedCount = updatedCount + notFoundCount;
        const progress = ((processedCount / geojson.features.length) * 100).toFixed(1);
        const batchDuration = ((Date.now() - batchStartTime) / 1000).toFixed(2);
        const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);

        // Log every 10 batches to reduce log volume
        if (i === 0 || (Math.floor(i / batchSize) + 1) % 10 === 0 || processedCount >= geojson.features.length) {
          this.logger.log(
            `✓ Batch ${Math.floor(i / batchSize) + 1}: ${updatedCount} updated, ${notFoundCount} not found | ` +
            `Progress: ${progress}% | Total: ${totalDuration}s`
          );
        }
      }

      this.logger.log(`✅ Successfully updated ${updatedCount.toLocaleString()} pincodes with boundaries`);
      if (notFoundCount > 0) {
        this.logger.warn(`⚠️  ${notFoundCount.toLocaleString()} pincodes from GeoJSON not found in database (expected for new pincodes)`);
      }
    } catch (error) {
      this.logger.error('Failed to parse and enrich GeoJSON:', error.stack);
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

  /**
   * Download file from URL (with redirect handling)
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);
      let redirectCount = 0;
      const MAX_REDIRECTS = 5;

      const download = (currentUrl: string) => {
        https
          .get(currentUrl, (response) => {
            // Handle redirects (all 3xx codes)
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400) {
              redirectCount++;
              if (redirectCount > MAX_REDIRECTS) {
                reject(new Error('Too many redirects'));
                return;
              }
              const redirectUrl = response.headers.location;
              if (!redirectUrl) {
                reject(new Error(`Redirect without location header: ${response.statusCode}`));
                return;
              }
              this.logger.debug(`Following redirect ${response.statusCode} to: ${redirectUrl}`);
              download(redirectUrl);
              return;
            }

            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode}: ${currentUrl}`));
              return;
            }

            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedBytes = 0;
            let lastLoggedProgress = 0;

            response.on('data', (chunk) => {
              downloadedBytes += chunk.length;
              if (totalBytes > 0) {
                const progress = Math.floor((downloadedBytes / totalBytes) * 100);
                // Log every 10%
                if (progress >= lastLoggedProgress + 10) {
                  this.logger.log(`  Download progress: ${progress}%`);
                  lastLoggedProgress = progress;
                }
              }
            });

            response.pipe(file);

            file.on('finish', () => {
              file.close();
              this.logger.log(`  Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
              resolve();
            });

            file.on('error', (err) => {
              file.close();
              unlink(destPath).catch(() => {});
              reject(err);
            });
          })
          .on('error', (err) => {
            file.close();
            unlink(destPath).catch(() => {});
            reject(err);
          });
      };

      download(url);
    });
  }
}

