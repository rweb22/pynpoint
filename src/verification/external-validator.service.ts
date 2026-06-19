import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Pincode } from '../entities/pincode.entity';
import { RedisPersistentService } from '../redis/redis-persistent.service';
import axios from 'axios';

interface ExternalValidationResult {
  source: string;
  totalTests: number;
  passed: number;
  failed: number;
  accuracy: number;
  failures: ExternalValidationFailure[];
}

interface ExternalValidationFailure {
  lat: number;
  lng: number;
  h3Index: string;
  ourPincode: string;
  externalPincode: string;
  source: string;
  reason: string;
}

@Injectable()
export class ExternalValidatorService {
  private readonly logger = new Logger(ExternalValidatorService.name);

  constructor(
    @InjectRepository(Pincode)
    private pincodeRepository: Repository<Pincode>,
    private dataSource: DataSource,
    private redisService: RedisPersistentService,
  ) {}

  /**
   * Validate against Google Geocoding API
   * Requires GOOGLE_MAPS_API_KEY environment variable
   */
  async validateWithGoogle(sampleSize: number = 100): Promise<ExternalValidationResult> {
    this.logger.log('🌍 Validating against Google Geocoding API...');
    
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      this.logger.warn('⚠️  GOOGLE_MAPS_API_KEY not set, skipping Google validation');
      return {
        source: 'Google Geocoding API',
        totalTests: 0,
        passed: 0,
        failed: 0,
        accuracy: 0,
        failures: [],
      };
    }

    const results: ExternalValidationResult = {
      source: 'Google Geocoding API',
      totalTests: 0,
      passed: 0,
      failed: 0,
      accuracy: 0,
      failures: [],
    };

    // Get random pincodes with boundaries
    const randomPincodes = await this.dataSource.query(
      `
      SELECT pincode, h3_cells
      FROM pincodes
      WHERE boundary IS NOT NULL
        AND h3_cells IS NOT NULL
        AND array_length(h3_cells, 1) > 5
      ORDER BY RANDOM()
      LIMIT $1
      `,
      [Math.min(sampleSize / 5, 50)],
    );

    for (const pincodeData of randomPincodes) {
      const { pincode, h3_cells } = pincodeData;
      
      // Test random cells from this pincode
      const cellsToTest = Math.min(5, h3_cells.length);
      const randomCells = this.getRandomElements(h3_cells, cellsToTest);

      for (const h3Index of randomCells) {
        results.totalTests++;

        try {
          // Get center of H3 cell
          const cellCenter = await this.dataSource.query(
            `SELECT h3_cell_to_lat_lng($1::h3index) as center`,
            [h3Index],
          );

          if (!cellCenter || cellCenter.length === 0) {
            results.failed++;
            continue;
          }

          const [lat, lng] = cellCenter[0].center
            .replace('(', '')
            .replace(')', '')
            .split(',')
            .map(Number);

          // Query Google Geocoding API
          const googleResponse = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
              params: {
                latlng: `${lat},${lng}`,
                key: apiKey,
                result_type: 'postal_code',
              },
              timeout: 5000,
            },
          );

          if (googleResponse.data.status !== 'OK') {
            this.logger.warn(`Google API returned: ${googleResponse.data.status}`);
            results.totalTests--; // Don't count this test
            continue;
          }

          // Extract pincode from Google response
          const addressComponents = googleResponse.data.results[0]?.address_components || [];
          const postalCode = addressComponents.find(
            (component: any) => component.types.includes('postal_code'),
          )?.long_name;

          if (!postalCode) {
            this.logger.warn(`No postal code found for ${lat},${lng}`);
            results.totalTests--; // Don't count this test
            continue;
          }

          // Compare with our mapping
          if (postalCode === pincode) {
            results.passed++;
          } else {
            results.failed++;
            results.failures.push({
              lat,
              lng,
              h3Index,
              ourPincode: pincode,
              externalPincode: postalCode,
              source: 'Google',
              reason: `Mismatch: Our system says ${pincode}, Google says ${postalCode}`,
            });
          }

          // Rate limiting - don't overwhelm Google API
          await this.sleep(100);

        } catch (error) {
          this.logger.error(`Error validating with Google: ${error.message}`);
          results.totalTests--; // Don't count failed API calls
        }
      }
    }

    results.accuracy = results.totalTests > 0 
      ? (results.passed / results.totalTests) * 100 
      : 0;

    this.logger.log('============================================================');
    this.logger.log(`✅ Google Validation Complete`);
    this.logger.log(`   Total Tests: ${results.totalTests}`);
    this.logger.log(`   Passed: ${results.passed} (${results.accuracy.toFixed(2)}%)`);
    this.logger.log(`   Failed: ${results.failed}`);
    this.logger.log('============================================================');

    return results;
  }

  /**
   * Helper: Get random elements from array
   */
  private getRandomElements<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Helper: Sleep for rate limiting
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
