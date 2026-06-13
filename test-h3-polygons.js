/**
 * Test script to debug H3 polygon failures
 * 
 * This script reproduces the exact error we're seeing in production
 * by testing the failed pincodes with the same H3 processing logic.
 */

const { polygonToCells, getHexagonEdgeLengthAvg } = require('h3-js');
const { buffer } = require('@turf/buffer');
const fs = require('fs');
const path = require('path');

const H3_RESOLUTION = 9;

// List of failed pincodes
const failedPincodes = [
  '673005', '504293', '440037', '587301', '370015',
  '360110', '360050', '306023', '132035', '247453',
  '246475', '171214', '177039', '226303', '811314',
  '843126'
];

function testPincode(pincode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing pincode: ${pincode}`);
  console.log('='.repeat(60));

  try {
    // Read the GeoJSON file
    const filePath = path.join(__dirname, '..', 'tmp', `${pincode}.json`);
    const geojsonStr = fs.readFileSync(filePath, 'utf8').trim();
    const geometry = JSON.parse(geojsonStr);

    console.log(`✓ Loaded geometry type: ${geometry.type}`);

    // Get edge length for buffering
    const edgeLengthKm = getHexagonEdgeLengthAvg(H3_RESOLUTION, 'km');
    console.log(`✓ Edge length at resolution ${H3_RESOLUTION}: ${edgeLengthKm.toFixed(6)} km`);

    // Extract polygons
    let polygons = [];
    if (geometry.type === 'Polygon') {
      polygons = [geometry.coordinates];
    } else if (geometry.type === 'MultiPolygon') {
      polygons = geometry.coordinates;
    } else {
      throw new Error(`Unsupported geometry type: ${geometry.type}`);
    }

    console.log(`✓ Found ${polygons.length} polygon(s)`);

    // Test each polygon
    const allHexagons = new Set();
    
    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i];
      console.log(`\n  Testing polygon ${i + 1}/${polygons.length}:`);
      console.log(`    - Rings: ${polygon.length} (1 exterior + ${polygon.length - 1} holes)`);
      console.log(`    - Points in exterior ring: ${polygon[0].length}`);

      try {
        // Create feature for buffering
        const originalFeature = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: polygon,
          },
          properties: {},
        };

        console.log(`    - Attempting buffer...`);
        const bufferedFeature = buffer(originalFeature, edgeLengthKm, {
          units: 'kilometers',
        });

        if (!bufferedFeature || !bufferedFeature.geometry) {
          console.log(`    ⚠️  Buffer operation returned null/empty`);
          continue;
        }

        console.log(`    ✓ Buffer successful`);
        console.log(`    - Buffered geometry type: ${bufferedFeature.geometry.type}`);

        // Now try H3 conversion
        console.log(`    - Attempting H3 polygonToCells...`);
        const hexagons = polygonToCells(
          bufferedFeature.geometry.coordinates,
          H3_RESOLUTION,
          true, // isGeoJson = true
        );

        console.log(`    ✓ H3 conversion successful! Generated ${hexagons.length} hexagons`);
        hexagons.forEach((hex) => allHexagons.add(hex));

      } catch (polygonError) {
        console.log(`    ❌ FAILED: ${polygonError.message}`);
        console.log(`    Error code: ${polygonError.code || 'N/A'}`);
        
        // Try without buffering
        console.log(`    - Attempting H3 WITHOUT buffering...`);
        try {
          const hexagonsNoBuf = polygonToCells(
            polygon,
            H3_RESOLUTION,
            true,
          );
          console.log(`    ✓ SUCCESS without buffering! Generated ${hexagonsNoBuf.length} hexagons`);
          console.log(`    💡 INSIGHT: This polygon fails ONLY after buffering!`);
        } catch (noBufError) {
          console.log(`    ❌ Also fails without buffering: ${noBufError.message}`);
        }
      }
    }

    console.log(`\n✅ Total hexagons for ${pincode}: ${allHexagons.size}`);
    return { success: true, hexagons: allHexagons.size };

  } catch (error) {
    console.log(`\n❌ FATAL ERROR: ${error.message}`);
    console.log(error.stack);
    return { success: false, error: error.message };
  }
}

// Test all failed pincodes
console.log('Starting H3 Polygon Debugging');
console.log('Testing failed pincodes to identify the root cause\n');

const results = {};

for (const pincode of failedPincodes) {
  results[pincode] = testPincode(pincode);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

const successful = Object.keys(results).filter(p => results[p].success);
const failed = Object.keys(results).filter(p => !results[p].success);

console.log(`\nSuccessful: ${successful.length}/${failedPincodes.length}`);
console.log(`Failed: ${failed.length}/${failedPincodes.length}`);

if (successful.length > 0) {
  console.log('\nSuccessful pincodes:');
  successful.forEach(p => {
    console.log(`  ✓ ${p}: ${results[p].hexagons} hexagons`);
  });
}

if (failed.length > 0) {
  console.log('\nFailed pincodes:');
  failed.forEach(p => {
    console.log(`  ❌ ${p}: ${results[p].error}`);
  });
}

console.log('\n' + '='.repeat(60));
