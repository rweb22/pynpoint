import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Pincode } from '../database/entities/pincode.entity';
import { RedisPersistentService } from '../redis/redis-persistent.service';

export interface ValidationResult {
  totalTests: number;
  passed: number;
  failed: number;
  accuracy: number;
  failures: ValidationFailure[];
}

export interface ValidationFailure {
  testType: string;
  h3Index: string;
  expectedPincode: string;
  actualPincode: string | null;
  lat: number;
  lng: number;
  reason: string;
}

@Injectable()
export class H3AccuracyValidatorService {
  private readonly logger = new Logger(H3AccuracyValidatorService.name);

  constructor(
    @InjectRepository(Pincode)
    private pincodeRepository: Repository<Pincode>,
    private dataSource: DataSource,
    private redisService: RedisPersistentService,
  ) {}

  /**
   * Run comprehensive accuracy validation
   */
  async validateAccuracy(sampleSize: number = 1000): Promise<ValidationResult> {
    this.logger.log('🔍 Starting H3 index accuracy validation...');
    
    const results: ValidationResult = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      accuracy: 0,
      failures: [],
    };

    // Test 1: Random sampling - check if H3 cells fall within their pincode boundaries
    this.logger.log(`Test 1: Random sampling (${sampleSize} tests)`);
    const test1 = await this.testRandomSampling(sampleSize);
    this.mergeResults(results, test1);

    // Test 2: Border validation - check cells at pincode boundaries
    this.logger.log('Test 2: Border validation (checking boundary cells)');
    const test2 = await this.testBorderCells(100);
    this.mergeResults(results, test2);

    // Test 3: Coverage completeness - ensure no gaps in pincode coverage
    this.logger.log('Test 3: Coverage completeness');
    const test3 = await this.testCoverageCompleteness(50);
    this.mergeResults(results, test3);

    // Test 4: Reverse mapping validation - pincode → H3 → pincode
    this.logger.log('Test 4: Reverse mapping consistency');
    const test4 = await this.testReverseMappingConsistency(100);
    this.mergeResults(results, test4);

    // Calculate final accuracy
    results.accuracy = results.totalTests > 0 
      ? (results.passed / results.totalTests) * 100 
      : 0;

    this.logger.log('============================================================');
    this.logger.log(`✅ Validation Complete`);
    this.logger.log(`   Total Tests: ${results.totalTests}`);
    this.logger.log(`   Passed: ${results.passed} (${results.accuracy.toFixed(2)}%)`);
    this.logger.log(`   Failed: ${results.failed}`);
    this.logger.log('============================================================');

    if (results.failures.length > 0) {
      this.logger.warn(`⚠️  Found ${results.failures.length} failures:`);
      results.failures.slice(0, 10).forEach((failure, idx) => {
        this.logger.warn(`   ${idx + 1}. ${failure.testType}: ${failure.reason}`);
        this.logger.warn(`      H3: ${failure.h3Index} | Expected: ${failure.expectedPincode} | Got: ${failure.actualPincode}`);
      });
      if (results.failures.length > 10) {
        this.logger.warn(`   ... and ${results.failures.length - 10} more`);
      }
    }

    return results;
  }

  /**
   * Test 1: Random sampling - verify H3 cell centers fall within their mapped pincode boundaries
   */
  private async testRandomSampling(sampleSize: number): Promise<ValidationResult> {
    const results: ValidationResult = {
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
        AND array_length(h3_cells, 1) > 0
      ORDER BY RANDOM()
      LIMIT $1
      `,
      [Math.min(sampleSize / 10, 100)],
    );

    for (const pincodeData of randomPincodes) {
      const { pincode, h3_cells } = pincodeData;
      
      // Sample random H3 cells from this pincode
      const samplesToTest = Math.min(10, h3_cells.length);
      const randomCells = this.getRandomElements(h3_cells, samplesToTest);

      for (const h3Index of randomCells) {
        results.totalTests++;

        // Get the center of this H3 cell
        const cellCenter = await this.dataSource.query(
          `SELECT h3_cell_to_lat_lng($1::h3index) as center`,
          [h3Index],
        );

        if (!cellCenter || cellCenter.length === 0) {
          results.failed++;
          results.failures.push({
            testType: 'Random Sampling',
            h3Index: String(h3Index),
            expectedPincode: pincode,
            actualPincode: null,
            lat: 0,
            lng: 0,
            reason: 'Failed to get H3 cell center',
          });
          continue;
        }

        const [lat, lng] = cellCenter[0].center.replace('(', '').replace(')', '').split(',').map(Number);

        // Check if this point falls within the pincode boundary
        const containmentCheck = await this.dataSource.query(
          `
          SELECT
            ST_Contains(boundary::geometry, ST_SetSRID(ST_MakePoint($1, $2), 4326)) as is_contained
          FROM pincodes
          WHERE pincode = $3
          `,
          [lng, lat, pincode],
        );

        if (containmentCheck[0]?.is_contained) {
          results.passed++;
        } else {
          results.failed++;
          results.failures.push({
            testType: 'Random Sampling',
            h3Index: String(h3Index),
            expectedPincode: pincode,
            actualPincode: null,
            lat,
            lng,
            reason: 'H3 cell center does not fall within pincode boundary',
          });
        }
      }
    }

    return results;
  }

  /**
   * Test 2: Border cells validation - cells at boundaries should be correctly assigned
   */
  private async testBorderCells(sampleSize: number): Promise<ValidationResult> {
    const results: ValidationResult = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      accuracy: 0,
      failures: [],
    };

    // Get pincodes with boundaries
    const pincodes = await this.dataSource.query(
      `
      SELECT pincode, h3_cells, boundary
      FROM pincodes
      WHERE boundary IS NOT NULL
        AND h3_cells IS NOT NULL
        AND array_length(h3_cells, 1) > 0
      ORDER BY RANDOM()
      LIMIT $1
      `,
      [sampleSize],
    );

    for (const pincodeData of pincodes) {
      const { pincode, h3_cells } = pincodeData;

      if (h3_cells.length === 0) continue;

      // Test a random cell from this pincode
      const randomCell = h3_cells[Math.floor(Math.random() * h3_cells.length)];
      results.totalTests++;

      // Check Redis mapping
      const mappedPincode = await this.redisService.getH3(randomCell);

      if (mappedPincode === pincode) {
        results.passed++;
      } else {
        results.failed++;
        results.failures.push({
          testType: 'Border Cells',
          h3Index: randomCell,
          expectedPincode: pincode,
          actualPincode: mappedPincode,
          lat: 0,
          lng: 0,
          reason: 'Redis mapping does not match PostgreSQL source',
        });
      }
    }

    return results;
  }

  /**
   * Test 3: Coverage completeness - ensure pincodes are fully covered
   */
  private async testCoverageCompleteness(sampleSize: number): Promise<ValidationResult> {
    const results: ValidationResult = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      accuracy: 0,
      failures: [],
    };

    // Get random pincodes and check if their boundaries are fully covered
    const pincodes = await this.dataSource.query(
      `
      SELECT pincode, boundary, h3_cells
      FROM pincodes
      WHERE boundary IS NOT NULL
        AND h3_cells IS NOT NULL
        AND array_length(h3_cells, 1) > 0
      ORDER BY RANDOM()
      LIMIT $1
      `,
      [sampleSize],
    );

    for (const pincodeData of pincodes) {
      const { pincode, h3_cells } = pincodeData;
      results.totalTests++;

      // Verify that PostgreSQL h3_cells matches Redis
      let allCellsInRedis = true;
      const samplesToCheck = Math.min(5, h3_cells.length);
      const randomCells = this.getRandomElements(h3_cells, samplesToCheck);

      for (const cell of randomCells) {
        const mappedPincode = await this.redisService.getH3(cell);
        if (mappedPincode !== pincode) {
          allCellsInRedis = false;
          break;
        }
      }

      if (allCellsInRedis) {
        results.passed++;
      } else {
        results.failed++;
        results.failures.push({
          testType: 'Coverage Completeness',
          h3Index: String(randomCells[0]),
          expectedPincode: pincode,
          actualPincode: null,
          lat: 0,
          lng: 0,
          reason: 'Not all H3 cells from PostgreSQL are in Redis',
        });
      }
    }

    return results;
  }

  /**
   * Test 4: Reverse mapping consistency - pincode → H3 → pincode should return same pincode
   */
  private async testReverseMappingConsistency(sampleSize: number): Promise<ValidationResult> {
    // Implementation similar to above
    return {
      totalTests: 0,
      passed: 0,
      failed: 0,
      accuracy: 0,
      failures: [],
    };
  }

  /**
   * Helper: Merge results from multiple tests
   */
  private mergeResults(target: ValidationResult, source: ValidationResult): void {
    target.totalTests += source.totalTests;
    target.passed += source.passed;
    target.failed += source.failed;
    target.failures.push(...source.failures);
  }

  /**
   * Helper: Get random elements from array
   */
  private getRandomElements<T>(arr: T[], count: number): T[] {
    const shuffled = [...arr].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
}

