// Test the TypeScript DIGIPIN algorithm to see what it produces

const GRID = [
  ['F', 'C', '9', '8'],  // row 0 (TOP latitude band)
  ['J', '3', '2', '7'],  // row 1
  ['K', '4', '5', '6'],  // row 2
  ['L', 'M', 'P', 'T']   // row 3 (BOTTOM latitude band)
];

const INDIA_BBOX = {
  minLat: 2.5,
  maxLat: 38.5,
  minLng: 63.5,
  maxLng: 99.5,
};

function encode(lat: number, lng: number, level: number = 6): string {
  let digipin = '';
  let currentBox = { ...INDIA_BBOX };

  for (let i = 0; i < level; i++) {
    const latStep = (currentBox.maxLat - currentBox.minLat) / 4;
    const lngStep = (currentBox.maxLng - currentBox.minLng) / 4;

    // Calculate indices
    const latIndex = Math.min(3, Math.floor((currentBox.maxLat - lat) / latStep));
    const lngIndex = Math.min(3, Math.floor((lng - currentBox.minLng) / lngStep));

    const char = GRID[latIndex][lngIndex];
    digipin += char;

    currentBox = {
      maxLat: currentBox.maxLat - latIndex * latStep,
      minLat: currentBox.maxLat - (latIndex + 1) * latStep,
      minLng: currentBox.minLng + lngIndex * lngStep,
      maxLng: currentBox.minLng + (lngIndex + 1) * lngStep,
    };
  }

  return digipin;
}

// Test Delhi coordinates
console.log('Delhi (28.6139, 77.2090):', encode(28.6139, 77.2090, 6));
console.log('Expected: 39J438');
