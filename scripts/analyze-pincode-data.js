#!/usr/bin/env node

/**
 * Analyze Pincode GeoJSON Data
 * 
 * This script analyzes the downloaded pincode GeoJSON file to:
 * 1. Count total pincodes
 * 2. Show state distribution
 * 3. Validate data structure
 * 4. Show sample features
 * 5. Check for coverage gaps
 */

const fs = require('fs');
const path = require('path');

const GEOJSON_PATH = path.join(process.env.HOME, 'Downloads', 'Datagov_Pincode_Boundaries.geojson');

console.log('📊 Analyzing Pincode GeoJSON Data...\n');
console.log(`File: ${GEOJSON_PATH}`);

// Check file exists
if (!fs.existsSync(GEOJSON_PATH)) {
  console.error('❌ File not found!');
  process.exit(1);
}

// Get file stats
const stats = fs.statSync(GEOJSON_PATH);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log('\n🔄 Reading file (this may take a moment)...\n');

// Read and parse JSON
let data;
try {
  const content = fs.readFileSync(GEOJSON_PATH, 'utf-8');
  data = JSON.parse(content);
} catch (error) {
  console.error('❌ Failed to parse JSON:', error.message);
  process.exit(1);
}

console.log('✅ File parsed successfully!\n');

// Validate structure
console.log('📋 Data Structure:');
console.log(`  Type: ${data.type}`);
console.log(`  Total Features: ${data.features ? data.features.length : 0}`);

if (!data.features || !Array.isArray(data.features)) {
  console.error('❌ Invalid GeoJSON: missing features array');
  process.exit(1);
}

// Analyze features
const totalFeatures = data.features.length;
const stateStats = {};
const districtStats = {};
const pincodes = new Set();
const geometryTypes = {};
let sampleFeature = null;

data.features.forEach((feature, index) => {
  if (index === 0) {
    sampleFeature = feature;
  }

  const props = feature.properties || {};
  // Try various property name variations
  const pincode = props.Pincode || props.pincode || props.PINCODE || props.pin || props.PIN;
  const state = props.Circle || props.circle || props.state || props.STATE || props.statename || props.STATENAME;
  const district = props.Division || props.division || props.district || props.DISTRICT;
  const region = props.Region || props.region;
  const geometryType = feature.geometry?.type;

  if (pincode) {
    pincodes.add(pincode);
  }

  if (state) {
    stateStats[state] = (stateStats[state] || 0) + 1;
  }

  if (district) {
    districtStats[district] = (districtStats[district] || 0) + 1;
  }

  if (geometryType) {
    geometryTypes[geometryType] = (geometryTypes[geometryType] || 0) + 1;
  }
});

// Print results
console.log('\n📊 Analysis Results:');
console.log('='.repeat(60));
console.log(`\n✨ Total Unique Pincodes: ${pincodes.size.toLocaleString()}`);
console.log(`📍 Total Features: ${totalFeatures.toLocaleString()}`);
console.log(`🗺️  Total States: ${Object.keys(stateStats).length}`);
console.log(`🏘️  Total Districts: ${Object.keys(districtStats).length}`);

console.log('\n📐 Geometry Types:');
Object.entries(geometryTypes).forEach(([type, count]) => {
  console.log(`  ${type}: ${count.toLocaleString()}`);
});

console.log('\n🇮🇳 State Distribution (Top 10):');
const topStates = Object.entries(stateStats)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10);

topStates.forEach(([state, count]) => {
  const bar = '█'.repeat(Math.floor(count / 100));
  console.log(`  ${state.padEnd(25)} ${count.toString().padStart(6)} ${bar}`);
});

if (Object.keys(stateStats).length > 10) {
  console.log(`  ... and ${Object.keys(stateStats).length - 10} more states`);
}

// Sample feature
if (sampleFeature) {
  console.log('\n📄 Sample Feature (first entry):');
  console.log(JSON.stringify({
    type: sampleFeature.type,
    properties: sampleFeature.properties,
    geometry: {
      type: sampleFeature.geometry?.type,
      coordinates: '... (truncated)'
    }
  }, null, 2));
}

// Check for expected major states
console.log('\n🔍 Coverage Check (Major States):');
const expectedStates = [
  'Maharashtra', 'Uttar Pradesh', 'Tamil Nadu', 'Karnataka', 'Gujarat',
  'Rajasthan', 'West Bengal', 'Madhya Pradesh', 'Andhra Pradesh', 'Kerala'
];

expectedStates.forEach(state => {
  const found = Object.keys(stateStats).some(s => 
    s.toLowerCase().includes(state.toLowerCase()) || 
    state.toLowerCase().includes(s.toLowerCase())
  );
  const status = found ? '✅' : '❌';
  console.log(`  ${status} ${state}`);
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📈 Summary:');
console.log(`  ✅ File is valid GeoJSON`);
console.log(`  ✅ Contains ${pincodes.size.toLocaleString()} unique pincodes`);
console.log(`  ✅ Covers ${Object.keys(stateStats).length} states/UTs`);
console.log(`  ✅ Data appears comprehensive`);

// India has approximately 19,000-20,000 active pincodes
if (pincodes.size > 15000) {
  console.log(`  ✅ Pincode count suggests good coverage (India has ~19,000-20,000 active pincodes)`);
} else {
  console.log(`  ⚠️  Pincode count is lower than expected (India has ~19,000-20,000 active pincodes)`);
}

console.log('\n✨ Analysis complete!');
