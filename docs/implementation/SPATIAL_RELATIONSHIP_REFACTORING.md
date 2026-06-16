# Spatial Relationship Refactoring Design

## Overview

This document defines the refactoring of v1 APIs to support complex spatial relationships between Pincodes, H3 cells, and DIGIPIN codes.

---

## Problem Statement

### Current Limitations

1. **H3ToDigipinResponse** returns singular `digipinCode` (line 95)
   - Doesn't account for containment direction
   - Assumes 1:1 relationship
   
2. **No relationship parameter**
   - Can't specify: contains, contained_by, overlaps, intersects
   - Developer can't control query semantics
   
3. **Fixed resolution/precision**
   - H3 resolution hardcoded to 9
   - DIGIPIN precision hardcoded to 6
   - Can't query different hierarchical levels

4. **Unclear semantics**
   - Does `/pincode-to-h3/110001` return h3 cells INSIDE pincode or h3 cells that OVERLAP?
   - Currently returns all intersecting cells (overlap logic)

---

## Proposed Solution

### Query Parameter System

Add optional query parameters to all conversion endpoints:

```typescript
/**
 * Spatial Relationship Types
 */
export enum SpatialRelationship {
  CONTAINS = 'contains',           // A contains B completely
  CONTAINED_BY = 'contained_by',   // A is contained by B completely
  INTERSECTS = 'intersects',       // A and B share any area (default)
  OVERLAPS = 'overlaps',           // A and B partially overlap (excludes contains/contained_by)
}
```

### Enhanced Query DTOs

```typescript
// Base spatial query parameters
export class SpatialQueryDto {
  @IsOptional()
  @IsEnum(SpatialRelationship)
  relationship?: SpatialRelationship = SpatialRelationship.INTERSECTS;
  
  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean = true;  // Include overlapPercentage, area, etc.
}

// Pincode-to-H3 with relationship
export class PincodeToH3QueryDto extends SpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  resolution?: number = 9;
}

// H3-to-Pincode with relationship
export class H3ToPincodeQueryDto extends SpatialQueryDto {
  // No additional params - resolution derived from h3Index
}

// Pincode-to-DIGIPIN with relationship
export class PincodeToDigipinQueryDto extends SpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  level?: number = 6;
}

// DIGIPIN-to-Pincode with relationship
export class DigipinToPincodeQueryDto extends SpatialQueryDto {
  // No additional params - level derived from digipinCode
}

// H3-to-DIGIPIN with relationship
export class H3ToDigipinQueryDto extends SpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  level?: number = 6;
}

// DIGIPIN-to-H3 with relationship
export class DigipinToH3QueryDto extends SpatialQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  resolution?: number = 9;
}
```

---

## Updated Response DTOs

All responses now return **arrays** instead of singular values.

### Before vs After

**Before (Singular):**
```typescript
export interface H3ToDigipinResponse {
  h3Index: string;
  h3Resolution: number;
  digipinCode: string;  // ❌ Singular
  digipinLevel: number;
  center: { latitude: number; longitude: number };
}
```

**After (Array):**
```typescript
export interface H3ToDigipinResponse {
  h3Index: string;
  h3Resolution: number;
  digipinCodes: string[];  // ✅ Array
  totalDigipinCells: number;
  primaryDigipin: string;  // Centroid-based primary
  relationship: SpatialRelationship;
  center: { latitude: number; longitude: number };
  metadata?: {
    digipinDetails: Array<{
      code: string;
      level: number;
      overlapPercentage: number;
      area: { value: number; unit: string };
    }>;
  };
}
```

---

## Example API Calls

### 1. Get H3 cells CONTAINED within a pincode
```bash
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&resolution=9
```

Response:
```json
{
  "pincode": "110001",
  "resolution": 9,
  "h3Indexes": ["89283082803ffff", "89283082807ffff", ...],
  "totalHexagons": 127,
  "relationship": "contains",
  "metadata": {
    "h3Details": [
      {
        "h3Index": "89283082803ffff",
        "overlapPercentage": 100.0,  // Fully contained
        "area": { "value": 0.105, "unit": "km²" }
      }
    ]
  }
}
```

### 2. Get pincodes that CONTAIN an H3 cell
```bash
GET /api/v1/convert/h3-to-pincode/89283082803ffff?relationship=contained_by
```

### 3. Get DIGIPINs that OVERLAP with a pincode
```bash
GET /api/v1/convert/pincode-to-digipin/110001?relationship=overlaps&level=8
```

