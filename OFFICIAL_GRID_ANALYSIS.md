# 🎯 OFFICIAL DIGIPIN GRID LAYOUT DISCOVERY

## 📋 Official Grid from India Post PDF

From the official technical document Annexure 1, the JavaScript code shows:

```javascript
var L=[
 ['F', 'C', '9', '8'],
 ['J', '3', '2', '7'],
 ['K', '4', '5', '6'],
 ['L', 'M', 'P', 'T']
];
```

And the encoding uses:
```javascript
vDIGIPIN = vDIGIPIN + L[row][column];
```

## 🔍 Analysis: What This Means

### **Grid Layout Visualization**

```
       col=0  col=1  col=2  col=3
row=0:   F      C      9      8
row=1:   J      3      2      7
row=2:   K      4      5      6
row=3:   L      M      P      T
```

### **Our Current Implementation (WRONG)**

We use a **1D array** with row-major indexing:
```typescript
CHARSET = ['2', '3', '4', '5', '6', '7', '8', '9', 'C', 'F', 'J', 'K', 'L', 'M', 'P', 'T']
cellIndex = latIndex * 4 + lngIndex
```

This produces:
```
       col=0  col=1  col=2  col=3
row=0:   2      3      4      5
row=1:   6      7      8      9
row=2:   C      F      J      K
row=3:   L      M      P      T
```

**Completely different!**

## ✅ Correct Implementation Needed

We need to use a **2D array** exactly as shown in the official spec:

```typescript
private readonly GRID = [
  ['F', 'C', '9', '8'],  // row 0 (bottom latitude band)
  ['J', '3', '2', '7'],  // row 1
  ['K', '4', '5', '6'],  // row 2
  ['L', 'M', 'P', 'T']   // row 3 (top latitude band)
];

// Then use:
const char = this.GRID[latIndex][lngIndex];
```

## 🧪 Key Discovery: Latitude Direction is REVERSED

### Official Algorithm (from PDF Annexure 1):

```javascript
var NextLvlMaxLat = MaxLat;           // Start from TOP (38.5)
var NextLvlMinLat = MaxLat - LatDivDeg;  // First band is TOP quarter

for (x = 0; x < LatDivBy; x++) {
  if (lat >= NextLvlMinLat && lat < NextLvlMaxLat) {
    row = x;  // row=0 is the TOP band, row=3 is BOTTOM
    break;
  }
  NextLvlMaxLat = NextLvlMinLat;
  NextLvlMinLat = NextLvlMaxLat - LatDivDeg;  // Move DOWN
}
```

**Grid orientation:**
```
row=0 (TOP):    ['F', 'C', '9', '8']  // MaxLat down to MaxLat-9
row=1:          ['J', '3', '2', '7']
row=2:          ['K', '4', '5', '6']
row=3 (BOTTOM): ['L', 'M', 'P', 'T']  // MinLat up to MinLat+9
```

### Longitude (normal, left-to-right):

```javascript
var NextLvlMinLon = MinLon;           // Start from LEFT (63.5)
var NextLvlMaxLon = MinLon + LonDivDeg;

for (x = 0; x < LonDivBy; x++) {
  if (lon >= NextLvlMinLon && lon < NextLvlMaxLon) {
    column = x;  // column=0 is LEFT, column=3 is RIGHT
    break;
  }
  NextLvlMinLon = NextLvlMaxLon;
  NextLvlMaxLon = NextLvlMinLon + LonDivDeg;  // Move RIGHT
}
```

### Our Implementation (WRONG):

We calculate from BOTTOM to TOP:
```typescript
latIndex = floor((lat - minLat) / latStep)  // 0 = BOTTOM
```

We need:
```typescript
latIndex = floor((maxLat - lat) / latStep)  // 0 = TOP
```

## 🎯 Action Items

1. Replace 1D CHARSET array with 2D GRID array
2. Use `GRID[latIndex][lngIndex]` directly
3. Verify latitude indexing direction (might need to invert)
4. Update both TypeScript and SQL implementations
5. Re-test against known coordinates

## 📚 Official Source

- PDF: India Post DIGIPIN Technical Document
- Section: Annexure 1 - DIGIPIN Programming Code
- Function: `Get_DIGIPIN(lat, lon)`
