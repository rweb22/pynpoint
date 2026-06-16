# Spatial Conversion Library Specification

## Package Name
`@pinpoint/spatial-converter` or `@pinpoint/grid-converter`

## Overview
A TypeScript library for precise conversions between H3 hexagonal grid and DIGIPIN grid systems, with support for spatial relationship calculations (containment, overlap, intersection).

---

## Core Features

### 1. Resolution/Level Equivalence
```typescript
// Get equivalent H3 resolution for DIGIPIN level
getEquivalentH3Resolution(digipinLevel: number): number

// Get equivalent DIGIPIN level for H3 resolution
getEquivalentDigipinLevel(h3Resolution: number): number

// Get area coverage comparison
compareAreas(h3Res: number, digipinLevel: number): AreaComparison
```

### 2. Spatial Containment Analysis
```typescript
// Check if H3 cell contains DIGIPIN cell
h3ContainsDigipin(h3Index: string, digipinCode: string): boolean

// Check if DIGIPIN cell contains H3 cell
digipinContainsH3(digipinCode: string, h3Index: string): boolean

// Calculate overlap percentage
calculateOverlap(h3Index: string, digipinCode: string): number
```

### 3. Bulk Conversion
```typescript
// Convert H3 cell to all overlapping DIGIPIN cells
h3ToDigipinCells(h3Index: string, digipinLevel: number, options?: ConversionOptions): string[]

// Convert DIGIPIN cell to all overlapping H3 cells
digipinToH3Cells(digipinCode: string, h3Resolution: number, options?: ConversionOptions): string[]
```

### 4. Relationship-Based Queries
```typescript
// Get DIGIPIN cells with specific relationship to H3 cell
h3ToDigipinByRelationship(
  h3Index: string, 
  digipinLevel: number,
  relationship: SpatialRelationship
): ConversionResult

// Get H3 cells with specific relationship to DIGIPIN cell
digipinToH3ByRelationship(
  digipinCode: string,
  h3Resolution: number,
  relationship: SpatialRelationship
): ConversionResult
```

---

## Type Definitions

```typescript
/**
 * Spatial relationship between two grid cells
 */
export enum SpatialRelationship {
  /** Cell A completely contains cell B */
  CONTAINS = 'contains',
  
  /** Cell A is completely contained by cell B */
  CONTAINED_BY = 'contained_by',
  
  /** Cells A and B share any area (includes contains/contained_by) */
  INTERSECTS = 'intersects',
  
  /** Cells A and B partially overlap (excludes contains/contained_by) */
  OVERLAPS = 'overlaps',
}

/**
 * Conversion options
 */
export interface ConversionOptions {
  /** Minimum overlap percentage to include (0-100) */
  minOverlapPercent?: number;
  
  /** Include detailed metadata for each result */
  includeMetadata?: boolean;
  
  /** Maximum number of results to return */
  maxResults?: number;
  
  /** Sampling density for overlap calculation (1-100, default: 10) */
  samplingDensity?: number;
}

/**
 * Area comparison result
 */
export interface AreaComparison {
  h3Resolution: number;
  h3AreaKm2: number;
  digipinLevel: number;
  digipinAreaKm2: number;
  ratio: number; // h3Area / digipinArea
  equivalenceScore: number; // 0-100, how similar they are
}

/**
 * Cell metadata
 */
export interface CellMetadata {
  center: { lat: number; lng: number };
  areaKm2: number;
  overlapPercent: number;
  boundary?: GeoJSON.Polygon;
}

/**
 * Conversion result
 */
export interface ConversionResult {
  sourceCellId: string;
  sourceType: 'h3' | 'digipin';
  targetCells: string[];
  totalCells: number;
  relationship: SpatialRelationship;
  metadata?: {
    [cellId: string]: CellMetadata;
  };
}
```

---

## Library Structure

```
@pinpoint/spatial-converter/
├── src/
│   ├── index.ts                     # Main exports
│   ├── types.ts                     # Type definitions
│   ├── equivalence/
│   │   ├── resolution-mapping.ts    # Resolution/level equivalence
│   │   ├── area-calculator.ts       # Area calculations
│   │   └── equivalence-table.ts     # Pre-computed equivalence data
│   ├── conversion/
│   │   ├── h3-to-digipin.ts        # H3 → DIGIPIN conversion
│   │   ├── digipin-to-h3.ts        # DIGIPIN → H3 conversion
│   │   └── converter.ts             # Main converter class
│   ├── spatial/
│   │   ├── containment.ts           # Containment checks
│   │   ├── overlap.ts               # Overlap calculations
│   │   └── relationship.ts          # Relationship determination
│   ├── geometry/
│   │   ├── h3-geometry.ts           # H3 hexagon geometry
│   │   ├── digipin-geometry.ts      # DIGIPIN grid geometry
│   │   └── intersection.ts          # Geometric intersection
│   └── utils/
│       ├── sampling.ts              # Grid sampling utilities
│       ├── precision.ts             # Numeric precision handling
│       └── cache.ts                 # In-memory caching
├── test/
│   ├── unit/
│   │   ├── equivalence.test.ts
│   │   ├── conversion.test.ts
│   │   ├── containment.test.ts
│   │   └── overlap.test.ts
│   └── integration/
│       ├── h3-to-digipin.test.ts
│       └── digipin-to-h3.test.ts
├── benchmarks/
│   ├── conversion-performance.ts
│   └── overlap-calculation.ts
├── examples/
│   ├── basic-usage.ts
│   ├── relationship-queries.ts
│   └── bulk-conversion.ts
├── package.json
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

---

## API Examples

### Example 1: Basic Equivalence
```typescript
import { SpatialConverter } from '@pinpoint/spatial-converter';

const converter = new SpatialConverter();

// Get equivalent H3 resolution for DIGIPIN level 6
const h3Res = converter.getEquivalentH3Resolution(6);
console.log(h3Res); // 9 (approximate)

// Compare areas
const comparison = converter.compareAreas(9, 6);
console.log(comparison);
// {
//   h3Resolution: 9,
//   h3AreaKm2: 0.105,
//   digipinLevel: 6,
//   digipinAreaKm2: 0.04,
//   ratio: 2.625,
//   equivalenceScore: 85
// }
```

### Example 2: Containment Check
```typescript
// Check if H3-9 cell contains DIGIPIN-10 cell
const contains = converter.h3ContainsDigipin(
  '89283082803ffff',  // H3-9 (~0.1 km²)
  'NJ4VJMABCD'        // DIGIPIN-10 (~0.0000001 km²)
);
console.log(contains); // true (likely)

// Calculate overlap percentage
const overlap = converter.calculateOverlap(
  '89283082803ffff',
  'NJ4VJM'
);
console.log(overlap); // 85.3 (%)
```

### Example 3: Relationship-Based Conversion
```typescript
// Get all DIGIPIN-8 cells FULLY INSIDE H3-9 cell
const result = converter.h3ToDigipinByRelationship(
  '89283082803ffff',
  8, // DIGIPIN level
  SpatialRelationship.CONTAINS
);

console.log(result);
// {
//   sourceCellId: '89283082803ffff',
//   sourceType: 'h3',
//   targetCells: ['NJ4VJMAB', 'NJ4VJMAC', ...],
//   totalCells: 15,
//   relationship: 'contains',
//   metadata: {
//     'NJ4VJMAB': {
//       center: { lat: 28.614, lng: 77.209 },
//       areaKm2: 0.0001,
//       overlapPercent: 100.0
//     }
//   }
// }
```

