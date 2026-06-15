# DIGIPIN Specification & Implementation Research

**Date**: 2026-06-15  
**Source**: India Post Official Repository & Technical Documentation  
**GitHub**: https://github.com/INDIAPOST-gov/digipin  
**License**: Apache 2.0 (Open Source)

---

## 📋 Official DIGIPIN Specification

### **What is DIGIPIN?**

**DIGIPIN (Digital Postal Index Number)** is India Post's official geo-coded addressing system developed in collaboration with:
- Department of Posts, Government of India
- Indian Institute of Technology, Hyderabad
- National Remote Sensing Centre (NRSC), ISRO

### **Key Characteristics**

- **10-character alphanumeric code** (e.g., `C4P8K63M4M`)
- **Grid-based hierarchical system** (4x4 subdivision)
- **Precision**: ~4m x 4m cell at Level 10
- **Coverage**: All of India (including maritime regions)
- **Offline-capable**: Pure algorithmic encoding/decoding

---

## 🔢 Character Set

DIGIPIN uses **16 alphanumeric symbols**:
```
2, 3, 4, 5, 6, 7, 8, 9, G, J, K, L, M, P, W, X
```

**Note**: The technical document shows two different character sets:
- Document 1: `2-9, C, F, J, K, L, M, P, T`
- Document 2: `2-9, G, J, K, L, M, P, W, X`

**IMPORTANT**: Use the **official GitHub repository** as the source of truth.

---

## 🗺️ Encoding Algorithm

### **Hierarchical 4x4 Grid Subdivision**

```
Level 1: India bounding box → 4x4 grid = 16 regions (1 character)
Level 2: Each region → 4x4 grid = 256 subregions (2 characters)
Level 3-10: Continue subdivision → 16^10 total cells
```

### **Encoding Process** (Lat/Lng → DIGIPIN)

```typescript
function encode(lat: number, lng: number): string {
  // 1. Define India's bounding box
  const bbox = {
    minLat: X.XXXX,  // From official spec
    maxLat: X.XXXX,
    minLng: X.XXXX,
    maxLng: X.XXXX
  };
  
  // 2. Initialize result
  let digipin = '';
  let currentBox = bbox;
  
  // 3. For each of 10 levels
  for (let level = 1; level <= 10; level++) {
    // 4. Divide current box into 4x4 grid
    const latStep = (currentBox.maxLat - currentBox.minLat) / 4;
    const lngStep = (currentBox.maxLng - currentBox.minLng) / 4;
    
    // 5. Find which of 16 cells contains the point
    const latIndex = Math.floor((lat - currentBox.minLat) / latStep);
    const lngIndex = Math.floor((lng - currentBox.minLng) / lngStep);
    
    // 6. Map (latIndex, lngIndex) to character
    const cellIndex = latIndex * 4 + lngIndex; // 0-15
    digipin += SYMBOLS[cellIndex];
    
    // 7. Update bounding box to selected cell
    currentBox = {
      minLat: currentBox.minLat + latIndex * latStep,
      maxLat: currentBox.minLat + (latIndex + 1) * latStep,
      minLng: currentBox.minLng + lngIndex * lngStep,
      maxLng: currentBox.minLng + (lngIndex + 1) * lngStep
    };
  }
  
  return digipin; // 10 characters
}
```

---

## 🔄 Decoding Algorithm

### **Decoding Process** (DIGIPIN → Lat/Lng)

```typescript
function decode(digipin: string): { lat: number, lng: number } {
  // 1. Start with India's bounding box
  let currentBox = INDIA_BBOX;
  
  // 2. For each character in DIGIPIN
  for (let i = 0; i < digipin.length; i++) {
    const char = digipin[i];
    const cellIndex = SYMBOLS.indexOf(char); // 0-15
    
    // 3. Convert cell index to grid position
    const latIndex = Math.floor(cellIndex / 4); // 0-3
    const lngIndex = cellIndex % 4;              // 0-3
    
    // 4. Calculate cell dimensions
    const latStep = (currentBox.maxLat - currentBox.minLat) / 4;
    const lngStep = (currentBox.maxLng - currentBox.minLng) / 4;
    
    // 5. Update bounding box to selected cell
    currentBox = {
      minLat: currentBox.minLat + latIndex * latStep,
      maxLat: currentBox.minLat + (latIndex + 1) * latStep,
      minLng: currentBox.minLng + lngIndex * lngStep,
      maxLng: currentBox.minLng + (lngIndex + 1) * lngStep
    };
  }
  
  // 6. Return center of final cell
  return {
    lat: (currentBox.minLat + currentBox.maxLat) / 2,
    lng: (currentBox.minLng + currentBox.minLng) / 2
  };
}
```

---

## 🎯 Precision by Level

| Level | Grid Size | Cell Dimensions (approx) | Example |
|-------|-----------|--------------------------|---------|
| 1 | 4x4 | ~500 km x 500 km | `C` |
| 2 | 16x16 | ~125 km x 125 km | `C4` |
| 3 | 64x64 | ~31 km x 31 km | `C4P` |
| 4 | 256x256 | ~8 km x 8 km | `C4P8` |
| 5 | 1024x1024 | ~2 km x 2 km | `C4P8K` |
| 6 | 4096x4096 | ~500 m x 500 m | `C4P8K6` |
| 7 | 16384x16384 | ~125 m x 125 m | `C4P8K63` |
| 8 | 65536x65536 | ~31 m x 31 m | `C4P8K63M` |
| 9 | 262144x262144 | ~8 m x 8 m | `C4P8K63M4` |
| 10 | 1048576x1048576 | **~4 m x 4 m** | `C4P8K63M4M` |

---

## 📦 Implementation Requirements

### **1. Constants Needed**

```typescript
// India's bounding box (TO BE VERIFIED from official spec)
const INDIA_BBOX = {
  minLat: 6.5546079,   // Southernmost point (Indira Point)
  maxLat: 35.6745457,  // Northernmost point (Siachen)
  minLng: 68.1113787,  // Westernmost point (Gujarat)
  maxLng: 97.395561    // Easternmost point (Arunachal Pradesh)
};

// DIGIPIN character set (VERIFY from GitHub repo)
const SYMBOLS = ['2', '3', '4', '5', '6', '7', '8', '9', 
                 'G', 'J', 'K', 'L', 'M', 'P', 'W', 'X'];
```

### **2. Validation Rules**

```typescript
function isValidDigipin(code: string): boolean {
  // 1. Must be exactly 10 characters
  if (code.length !== 10) return false;
  
  // 2. All characters must be in SYMBOLS set
  for (const char of code) {
    if (!SYMBOLS.includes(char)) return false;
  }
  
  return true;
}

function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= INDIA_BBOX.minLat && 
         lat <= INDIA_BBOX.maxLat &&
         lng >= INDIA_BBOX.minLng && 
         lng <= INDIA_BBOX.maxLng;
}
```

---

## 🔍 Key Implementation Questions

1. **Exact Bounding Box**: What are India's official bounding coordinates for DIGIPIN?
2. **Character Set**: Which character set is correct? (C/F/T vs G/W/X)
3. **Maritime Coverage**: Are maritime regions included in the bounding box?
4. **Precision Handling**: How many decimal places for lat/lng?
5. **Edge Cases**: How are boundary points handled?

---

## 📚 Next Steps

1. **Clone India Post Repository**: `git clone https://github.com/INDIAPOST-gov/digipin.git`
2. **Extract Constants**: Get exact bounding box and character set
3. **Port Algorithm**: Convert Node.js code to TypeScript
4. **Write Tests**: Verify against official examples
5. **Integrate**: Create `DigipinService` in NestJS

---

**References**:
- Official Repo: https://github.com/INDIAPOST-gov/digipin
- Technical Doc: https://www.indiapost.gov.in/documents/offerings/intiatives/DIGIPIN_Technical_document.pdf
- India Post DIGIPIN: https://indiapost.gov.in/digipin
