import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Pincode } from '../../database/entities/pincode.entity';

/**
 * DatabaseCapabilityService
 * 
 * Checks PostgreSQL and PostGIS capabilities for H3 migration
 */
@Injectable()
export class DatabaseCapabilityService {
  private readonly logger = new Logger(DatabaseCapabilityService.name);

  constructor(
    @InjectRepository(Pincode)
    private readonly pincodeRepository: Repository<Pincode>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Check all database capabilities
   */
  async checkCapabilities(): Promise<any> {
    const results = {
      timestamp: new Date().toISOString(),
      postgresql: await this.checkPostgreSQL(),
      postgis: await this.checkPostGIS(),
      h3Extension: await this.checkH3Extension(),
      database: await this.checkDatabaseStats(),
      pincodes: await this.checkPincodesTable(),
      recommendation: '',
    };

    // Generate recommendation
    results.recommendation = this.generateRecommendation(results);

    return results;
  }

  /**
   * Check PostgreSQL version
   */
  private async checkPostgreSQL(): Promise<any> {
    try {
      const result = await this.dataSource.query('SELECT version();');
      const version = result[0].version;
      
      return {
        installed: true,
        version: version,
        versionNumber: this.extractPostgresVersion(version),
      };
    } catch (error) {
      return {
        installed: false,
        error: error.message,
      };
    }
  }

  /**
   * Check PostGIS installation and version
   */
  private async checkPostGIS(): Promise<any> {
    try {
      const versionResult = await this.dataSource.query('SELECT PostGIS_Version();');
      const fullVersionResult = await this.dataSource.query('SELECT PostGIS_Full_Version();');
      
      return {
        installed: true,
        version: versionResult[0].postgis_version,
        fullVersion: fullVersionResult[0].postgis_full_version,
        functionsWork: await this.testPostGISFunctions(),
      };
    } catch (error) {
      return {
        installed: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if H3 extension is available
   */
  private async checkH3Extension(): Promise<any> {
    try {
      // Check installed extensions
      const installedExtensions = await this.dataSource.query(`
        SELECT extname, extversion 
        FROM pg_extension 
        WHERE extname LIKE '%h3%'
        ORDER BY extname;
      `);

      // Check available extensions
      const availableExtensions = await this.dataSource.query(`
        SELECT name, default_version, comment
        FROM pg_available_extensions
        WHERE name LIKE '%h3%'
        ORDER BY name;
      `);

      // Check if H3 functions exist
      const h3Functions = await this.dataSource.query(`
        SELECT COUNT(*) as count
        FROM pg_proc
        WHERE proname LIKE 'h3_%';
      `);

      const h3FunctionCount = parseInt(h3Functions[0].count);

      // Test a basic H3 function if available
      let testResult: any = null;
      let functionsWork = false;
      if (h3FunctionCount > 0) {
        try {
          testResult = await this.dataSource.query(`
            SELECT h3_lat_lng_to_cell(POINT(77.2090, 28.6139), 9) as h3_cell;
          `);
          functionsWork = true;
        } catch (error) {
          testResult = { error: error.message };
          functionsWork = false;
        }
      }

      return {
        installed: installedExtensions.length > 0,
        installedExtensions,
        availableExtensions,
        functionCount: h3FunctionCount,
        functionsWork,
        testResult,
      };
    } catch (error) {
      return {
        installed: false,
        error: error.message,
      };
    }
  }

  /**
   * Check database statistics
   */
  private async checkDatabaseStats(): Promise<any> {
    try {
      const sizeResult = await this.dataSource.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `);

      const tableStats = await this.dataSource.query(`
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_live_tup as row_count
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
        LIMIT 5;
      `);

      return {
        databaseSize: sizeResult[0].size,
        largestTables: tableStats,
      };
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  /**
   * Check pincodes table configuration
   */
  private async checkPincodesTable(): Promise<any> {
    try {
      const countResult = await this.pincodeRepository.count();

      // Check boundary column type
      const boundaryType = await this.dataSource.query(`
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'pincodes' AND column_name = 'boundary';
      `);

      // Check for spatial indexes
      const spatialIndexes = await this.dataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'pincodes' AND indexdef LIKE '%GIST%';
      `);

      return {
        totalPincodes: countResult,
        boundaryType: boundaryType[0]?.udt_name || 'not found',
        spatialIndexes: spatialIndexes.map(idx => idx.indexname),
        hasSpatialIndex: spatialIndexes.length > 0,
      };
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  /**
   * Test basic PostGIS functions
   */
  private async testPostGISFunctions(): Promise<boolean> {
    try {
      await this.dataSource.query(`
        SELECT ST_AsText(ST_MakePoint(77.2090, 28.6139)) as point;
      `);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract PostgreSQL version number
   */
  private extractPostgresVersion(versionString: string): string {
    const match = versionString.match(/PostgreSQL ([\d.]+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Generate implementation recommendation
   */
  private generateRecommendation(results: any): string {
    if (!results.postgis.installed) {
      return 'CRITICAL: PostGIS not installed. Install PostGIS before proceeding.';
    }

    if (results.h3Extension.functionCount > 0 && results.h3Extension.functionsWork) {
      return 'RECOMMENDED: Use native H3 extension (h3_polygon_to_cells). Fastest and most accurate approach.';
    }

    if (results.postgis.functionsWork) {
      return 'RECOMMENDED: Use hybrid approach (JavaScript h3-js + PostGIS ST_Intersects). Accurate but slower build time.';
    }

    return 'WARNING: PostGIS functions not working properly. Fix PostGIS installation first.';
  }

  /**
   * Log capabilities on startup
   */
  async logCapabilitiesOnStartup(): Promise<void> {
    this.logger.log('🔍 Checking database capabilities for H3 migration...');
    
    try {
      const capabilities = await this.checkCapabilities();
      
      this.logger.log('='.repeat(60));
      this.logger.log('📊 PostgreSQL Capabilities Assessment');
      this.logger.log('='.repeat(60));
      
      // PostgreSQL
      this.logger.log(`PostgreSQL: ${capabilities.postgresql.installed ? '✅' : '❌'}`);
      if (capabilities.postgresql.installed) {
        this.logger.log(`   Version: ${capabilities.postgresql.versionNumber}`);
      }

      // PostGIS
      this.logger.log(`PostGIS: ${capabilities.postgis.installed ? '✅' : '❌'}`);
      if (capabilities.postgis.installed) {
        this.logger.log(`   Version: ${capabilities.postgis.version}`);
        this.logger.log(`   Functions work: ${capabilities.postgis.functionsWork ? '✅' : '❌'}`);
      }

      // H3 Extension
      this.logger.log(`H3 Extension: ${capabilities.h3Extension.installed ? '✅' : '❌'}`);
      if (capabilities.h3Extension.functionCount > 0) {
        this.logger.log(`   Functions found: ${capabilities.h3Extension.functionCount}`);
        this.logger.log(`   Functions work: ${capabilities.h3Extension.functionsWork ? '✅' : '❌'}`);
      }

      // Database
      this.logger.log(`Database size: ${capabilities.database.databaseSize}`);
      this.logger.log(`Total pincodes: ${capabilities.pincodes.totalPincodes}`);
      this.logger.log(`Spatial index: ${capabilities.pincodes.hasSpatialIndex ? '✅' : '❌ (should create)'}`);

      // Recommendation
      this.logger.log('='.repeat(60));
      this.logger.log(`📋 RECOMMENDATION: ${capabilities.recommendation}`);
      this.logger.log('='.repeat(60));

    } catch (error) {
      this.logger.error('Failed to check database capabilities:', error);
    }
  }
}
