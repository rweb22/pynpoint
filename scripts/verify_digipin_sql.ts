#!/usr/bin/env ts-node
/**
 * Verification script: Test DIGIPIN SQL implementation
 * 
 * Step 1: Create SQL functions
 * Step 2: Test with known coordinates
 * Step 3: Compare with TypeScript implementation
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

console.log('🧪 DIGIPIN SQL Implementation Verification');
console.log('==========================================\n');

// Step 1: Load SQL functions
console.log('📥 Step 1: Creating PostgreSQL functions...');
const sqlContent = fs.readFileSync('./migrations/create_digipin_functions.sql', 'utf-8');

try {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL environment variable not set!');
    process.exit(1);
  }

  // Create functions using psql
  fs.writeFileSync('/tmp/test_digipin.sql', sqlContent);
  execSync(`psql "${dbUrl}" -f /tmp/test_digipin.sql`, { stdio: 'inherit' });
  console.log('✅ Functions created successfully\n');

  // Step 2: Run basic SQL tests
  console.log('📊 Step 2: Running SQL tests...');
  fs.writeFileSync('/tmp/test_digipin_run.sql', `
-- Test major cities
\\echo 'Testing major city coordinates:'
SELECT 'Delhi' as city, encode_digipin_level6(28.6139, 77.2090) as code
UNION ALL
SELECT 'Mumbai', encode_digipin_level6(18.9220, 72.8347)
UNION ALL
SELECT 'Bangalore', encode_digipin_level6(12.9716, 77.5946)
UNION ALL
SELECT 'Kolkata', encode_digipin_level6(22.5448, 88.3426)
UNION ALL
SELECT 'Chennai', encode_digipin_level6(13.0478, 80.2824);

-- Validate format
\\echo ''
\\echo 'Validating code format:'
SELECT 
  encode_digipin_level6(28.6139, 77.2090) as sample_code,
  length(encode_digipin_level6(28.6139, 77.2090)) as char_count,
  CASE 
    WHEN encode_digipin_level6(28.6139, 77.2090) ~ '^[2-9CFJKLMPT]{6}$' THEN '✅ Valid charset'
    ELSE '❌ Invalid charset'
  END as charset_check;
`);

  execSync(`psql "${dbUrl}" -f /tmp/test_digipin_run.sql`, { stdio: 'inherit' });
  console.log('\n✅ SQL tests completed\n');

  console.log('✅ Basic verification complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Run: cd pynpoint && npm run build');
  console.log('2. Run: ts-node test_digipin_comparison.ts');
  console.log('   (This will compare SQL vs TypeScript implementation)');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
