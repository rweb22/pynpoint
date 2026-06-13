/**
 * Test the MultiPolygon fix for H3 buffering issue
 */

const { polygonToCells, getHexagonEdgeLengthAvg } = require('h3-js');
const { buffer } = require('@turf/buffer');
const fs = require('fs');
const path = require('path');

const H3_RESOLUTION = 9;

function testFixedApproach(pincode) {
  console.log(`\nTesting pincode: ${pincode}`);
  
  try {
    const filePath = path.join(__dirname, '..', 'tmp', `${pincode}.json`);
    const geojsonStr = fs.readFileSync(filePath, 'utf8').trim();
    const geometry = JSON.parse(geojsonStr);
    
    const edgeLengthKm = getHexagonEdgeLengthAvg(H3_RESOLUTION, 'km');
    
    let polygons = [];
    if (geometry.type === 'Polygon') {
      polygons = [geometry.coordinates];
    } else if (geometry.type === 'MultiPolygon') {
      polygons = geometry.coordinates;
    }
    
    const allHexagons = new Set();
    
    for (let i = 0; i < polygons.length; i++) {
      const polygon = polygons[i];
      
      try {
        const originalFeature = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: polygon,
          },
          properties: {},
        };
        
        const bufferedFeature = buffer(originalFeature, edgeLengthKm, {
          units: 'kilometers',
        });
        
        if (!bufferedFeature || !bufferedFeature.geometry) {
          console.log(`  ⚠️  Buffer failed`);
          continue;
        }
        
        // THE FIX: Handle MultiPolygon output from buffer
        let polygonsToProcess = [];
        
        if (bufferedFeature.geometry.type === 'Polygon') {
          polygonsToProcess = [bufferedFeature.geometry.coordinates];
        } else if (bufferedFeature.geometry.type === 'MultiPolygon') {
          polygonsToProcess = bufferedFeature.geometry.coordinates;
          console.log(`  📦 Buffer created MultiPolygon with ${polygonsToProcess.length} parts`);
        }
        
        // Process each polygon part separately
        for (const polygonCoords of polygonsToProcess) {
          try {
            const hexagons = polygonToCells(
              polygonCoords,
              H3_RESOLUTION,
              true,
            );
            hexagons.forEach((hex) => allHexagons.add(hex));
          } catch (h3Error) {
            console.log(`    ⚠️  One part failed: ${h3Error.message}`);
          }
        }
        
      } catch (polygonError) {
        console.log(`  ❌ Polygon ${i} failed: ${polygonError.message}`);
      }
    }
    
    console.log(`  ✅ Total hexagons: ${allHexagons.size}`);
    return allHexagons.size;
    
  } catch (error) {
    console.log(`  ❌ Fatal error: ${error.message}`);
    return 0;
  }
}

// Test all failed pincodes
const failedPincodes = [
  '673005', '504293', '440037', '587301', '370015',
  '360110', '360050', '306023', '132035', '247453',
  '246475', '171214', '177039', '226303', '811314',
  '843126'
];

console.log('Testing the MultiPolygon Fix');
console.log('='.repeat(60));

const results = {};
let totalHexagons = 0;

for (const pincode of failedPincodes) {
  const count = testFixedApproach(pincode);
  results[pincode] = count;
  totalHexagons += count;
}

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));

const successful = Object.keys(results).filter(p => results[p] > 0);
const failed = Object.keys(results).filter(p => results[p] === 0);

console.log(`\n✅ Successful: ${successful.length}/${failedPincodes.length}`);
console.log(`❌ Still failing: ${failed.length}/${failedPincodes.length}`);
console.log(`📊 Total hexagons generated: ${totalHexagons.toLocaleString()}`);

if (successful.length > 0) {
  console.log('\nSuccessful pincodes:');
  successful.forEach(p => {
    console.log(`  ✓ ${p}: ${results[p].toLocaleString()} hexagons`);
  });
}

if (failed.length > 0) {
  console.log('\nStill failing:');
  failed.forEach(p => {
    console.log(`  ✗ ${p}`);
  });
}

console.log('\n' + '='.repeat(60));
