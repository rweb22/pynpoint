import { Client } from 'pg';
import * as dotenv from 'dotenv';

/**
 * Check PostgreSQL capabilities for H3 PostGIS migration
 * 
 * This script checks:
 * 1. PostgreSQL version
 * 2. PostGIS version and installation
 * 3. Existing extensions
 * 4. H3 extension availability
 * 5. Database size and statistics
 */

dotenv.config();

async function checkPostgresCapabilities() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL\n');

    // 1. Check PostgreSQL version
    console.log('📊 PostgreSQL Version:');
    const versionResult = await client.query('SELECT version();');
    console.log(versionResult.rows[0].version);
    console.log();

    // 2. Check PostGIS installation and version
    console.log('🗺️  PostGIS Status:');
    try {
      const postgisVersion = await client.query('SELECT PostGIS_Version();');
      console.log(`✅ PostGIS installed: ${postgisVersion.rows[0].postgis_version}`);
      
      const postgisFullVersion = await client.query('SELECT PostGIS_Full_Version();');
      console.log(postgisFullVersion.rows[0].postgis_full_version);
    } catch (error) {
      console.log('❌ PostGIS not installed');
      console.log(`   Error: ${error.message}`);
    }
    console.log();

    // 3. List all installed extensions
    console.log('🔌 Installed Extensions:');
    const extensions = await client.query(`
      SELECT extname, extversion, extrelocatable 
      FROM pg_extension 
      ORDER BY extname;
    `);
    if (extensions.rows.length === 0) {
      console.log('   No extensions installed');
    } else {
      extensions.rows.forEach(ext => {
        console.log(`   - ${ext.extname} (version ${ext.extversion})`);
      });
    }
    console.log();

    // 4. Check available extensions (not yet installed)
    console.log('📦 Available Extensions:');
    const available = await client.query(`
      SELECT name, default_version, comment
      FROM pg_available_extensions
      WHERE name LIKE '%h3%' OR name LIKE '%postgis%'
      ORDER BY name;
    `);
    if (available.rows.length === 0) {
      console.log('   No H3 or PostGIS extensions available');
    } else {
      available.rows.forEach(ext => {
        console.log(`   - ${ext.name} (${ext.default_version}): ${ext.comment}`);
      });
    }
    console.log();

    // 5. Check if h3 functions exist
    console.log('🔍 Checking H3 Function Availability:');
    try {
      const h3Functions = await client.query(`
        SELECT proname, prosrc
        FROM pg_proc
        WHERE proname LIKE 'h3_%'
        LIMIT 5;
      `);
      if (h3Functions.rows.length > 0) {
        console.log(`✅ Found ${h3Functions.rows.length} H3 functions:`);
        h3Functions.rows.forEach(func => {
          console.log(`   - ${func.proname}`);
        });
      } else {
        console.log('❌ No H3 functions found');
      }
    } catch (error) {
      console.log('❌ Error checking H3 functions');
    }
    console.log();

    // 6. Database statistics
    console.log('📈 Database Statistics:');
    const dbSize = await client.query(`
      SELECT pg_size_pretty(pg_database_size(current_database())) as size;
    `);
    console.log(`   Database size: ${dbSize.rows[0].size}`);

    const tableStats = await client.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      LIMIT 5;
    `);
    console.log('   Largest tables:');
    tableStats.rows.forEach(table => {
      console.log(`   - ${table.tablename}: ${table.size} (${table.row_count} rows)`);
    });
    console.log();

    // 7. Check pincodes table
    console.log('🏷️  Pincodes Table Status:');
    const pincodeCount = await client.query('SELECT COUNT(*) FROM pincodes;');
    console.log(`   Total pincodes: ${pincodeCount.rows[0].count}`);

    const boundaryType = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'pincodes' AND column_name = 'boundary';
    `);
    if (boundaryType.rows.length > 0) {
      console.log(`   Boundary column type: ${boundaryType.rows[0].udt_name}`);
    }

    // Check for spatial index
    const spatialIndex = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'pincodes' AND indexdef LIKE '%GIST%';
    `);
    if (spatialIndex.rows.length > 0) {
      console.log(`   ✅ Spatial index exists: ${spatialIndex.rows[0].indexname}`);
    } else {
      console.log('   ❌ No spatial index found (should create GIST index)');
    }
    console.log();

    // 8. Test basic PostGIS query
    console.log('🧪 Testing PostGIS Functionality:');
    try {
      const testQuery = await client.query(`
        SELECT ST_AsText(ST_MakePoint(77.2090, 28.6139)) as point;
      `);
      console.log(`   ✅ PostGIS working: ${testQuery.rows[0].point}`);
    } catch (error) {
      console.log(`   ❌ PostGIS test failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('📋 Summary & Recommendations:');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkPostgresCapabilities().catch(console.error);
