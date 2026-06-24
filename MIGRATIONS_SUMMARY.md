# Database Migrations Summary

## Overview

**Total Migrations: 11**

The database schema has evolved through 11 migrations that create tables, add indexes, implement spatial functions, and normalize data. All migrations are idempotent and safe to run multiple times.

---

## Migration Timeline

### 1. **InitialSchema** (1718260800000)
**Date:** 2024-06-13  
**Purpose:** Foundation - Creates the core `pincodes` table with PostGIS support

**What it does:**
- ✅ Enables PostGIS extension
- ✅ Creates `pincodes` table with geography columns
- ✅ Adds spatial index on `boundary` (GIST)
- ✅ Creates indexes: pincode, state, is_active
- ✅ Creates `update_updated_at_column()` trigger function

**Schema:**
```sql
pincodes (
  id SERIAL PRIMARY KEY,
  pincode VARCHAR(6) UNIQUE NOT NULL,
  boundary GEOGRAPHY(MultiPolygon, 4326) NOT NULL,  -- ⚠️ Changed to NULLABLE in migration #4
  state VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  office_name VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

### 2. **AddIndexesAndCentroid** (1718349000000)
**Purpose:** Performance - Adds centroid column and more indexes

**What it does:**
- ✅ Adds `centroid GEOGRAPHY(Point, 4326)` column
- ✅ Populates centroid from boundary: `ST_Centroid(boundary::geometry)::geography`
- ✅ Creates GIST index on centroid
- ✅ Adds B-tree indexes on district and city

**Use case:** Point-based queries, map markers, nearest pincode searches

---

### 3. **CreatePostOfficesTable** (1718350000000)
**Purpose:** Data structure - Creates the `postoffices` table for detailed office records

**What it does:**
- ✅ Creates `postoffices` table (165,627 rows expected)
- ✅ Creates foreign key: `postoffices.pincode` → `pincodes.pincode` (ON DELETE SET NULL)
- ✅ Creates 7 B-tree indexes: pincode, state, district, area, officetype, delivery, is_active
- ✅ Creates `update_postoffices_updated_at` trigger

**Schema:**
```sql
postoffices (
  id SERIAL PRIMARY KEY,
  pincode VARCHAR(6) REFERENCES pincodes(pincode),
  officename VARCHAR(200) NOT NULL,
  area VARCHAR(200) NOT NULL,  -- ⚠️ Will be NULL for official JSON data
  officetype VARCHAR(2) NOT NULL,  -- HO, SO, BO
  delivery VARCHAR(20) NOT NULL,
  district VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  division VARCHAR(100),
  region VARCHAR(100),
  circle VARCHAR(100),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

### 4. **MakeBoundaryNullable** (1718370000000)
**Purpose:** Data flexibility - Allow pincodes without boundaries

**What it does:**
- ✅ Changes `boundary` column from NOT NULL to NULLABLE
- ✅ Ensures `centroid` is also NULLABLE

**Reason:**
- GeoJSON has 19,312 pincodes
- CSV/JSON has 19,586 pincodes
- **274 pincodes** have no boundary data (but should still exist for metadata)

---

### 5. **AddPostOfficeUniqueConstraint** (1718380000000)
**Purpose:** Data integrity - Prevent duplicate postoffice records

**What it does:**
- ✅ Adds UNIQUE constraint on `(pincode, officename)`

**Reason:** Previous failed deployments caused duplicates  
**Note:** Requires deduplication BEFORE running this migration

---

### 6. **CreateAuthTables** (1749830400000)
**Date:** 2026-06-14  
**Purpose:** API authentication and usage tracking

**What it does:**
- ✅ Creates `api_keys` table (UUID primary key, prefix, hash, tier, environment)
- ✅ Creates `api_usage` table (tracks requests per customer/day/endpoint)
- ✅ Creates 8 indexes including partial indexes for active keys
- ✅ Creates triggers for auto-updating `updated_at`

**Architecture:** Decoupled - No customer table, uses external_customer_id (string)

---

### 7. **AddSpatialIndexToPincodes** (1781695686582)
**Purpose:** Performance - Critical spatial query optimization

**What it does:**
- ✅ Creates GIST index on `pincodes.boundary`
- ✅ Runs ANALYZE to update query planner statistics
- ✅ Idempotent check (skips if index exists)

**Performance impact:**
- **Before:** Sequential scan (~1-5 seconds)
- **After:** Index scan (~1-10ms)
- **Index size:** ~10-20MB for 19K polygons
- **Build time:** ~5-10 seconds

**Use cases:**
- Coordinate → Pincode conversion (reverse geocoding)
- DIGIPIN → Pincode validation
- Point-in-polygon lookups
- ST_Intersects, ST_Contains, ST_Within queries

---

### 8. **AddDigipinFunctions** (1781705000000)
**Purpose:** DIGIPIN encoding - Implements India Post DIGIPIN specification

**What it does:**
- ✅ Creates `digipin_calc_indices(lat, lng, box...)` - Calculate grid indices
- ✅ Creates `digipin_grid_char(lat_idx, lng_idx)` - Convert index to character
- ✅ Creates `digipin_update_box(...)` - Update bounding box for next iteration
- ✅ Creates `encode_digipin_level6(lat, lng)` - Main encoding function

**All functions:** `IMMUTABLE PARALLEL SAFE` for query optimization

**DIGIPIN Grid:**
```
   Lng →
Lat  F  C  9  8
↓    J  3  2  7
     K  4  5  6
     L  M  P  T
```

**India bounds:** Lat [2.5, 38.5], Lng [63.5, 99.5]

---

### 9. **AddDigipinPolygonFunction** (1781706000000)
**Purpose:** DIGIPIN polygon coverage - Generate cells for pincode boundaries

**What it does:**
- ✅ Creates `polygon_to_digipin_cells_level6(geom, spacing)` for GEOMETRY
- ✅ Creates overload for GEOGRAPHY type
- ✅ Uses set-based operations (no loops) for performance
- ✅ Safety limit: 1M cells to prevent timeout
- ✅ Returns array of unique DIGIPIN codes

**Parameters:**
- `geom`: Polygon geometry/geography (auto-converts to SRID 4326)
- `grid_spacing_meters`: Default 100m (use 200m for large polygons)

**Algorithm:**
1. Calculate bounding box
2. Generate grid points at specified spacing
3. Filter points inside polygon
4. Encode each point to DIGIPIN
5. Return unique codes

---

### 10. **AddDistrictSearchIndex** (1781708000000)
**Date:** 2026-06-22  
**Purpose:** Performance - Fix slow state+district queries

**Problem:**
```sql
-- This query took 30+ seconds:
WHERE LOWER(state) = LOWER('Karnataka') AND LOWER(district) = LOWER('Bangalore Urban')
```

**Solution:**
```sql
CREATE INDEX idx_pincode_state_district_lower 
ON pincodes (LOWER(state), LOWER(district))
```

**Impact:** 30s+ → <50ms

---

### 11. **NormalizeNamesToLowercase** (1781709000000)
**Date:** 2026-06-22  
**Purpose:** Data consistency - Eliminate mixed-case duplicates

**Problem:** "Andhra Pradesh" and "andhra pradesh" appeared as separate states

**What it does:**
1. Drop unique constraint `uq_postoffices_pincode_officename`
2. Normalize `pincodes` table: state, district, city, office_name → lowercase
3. Normalize `postoffices` table: all text fields → lowercase
4. Deduplicate `postoffices` (keep oldest per pincode+officename)
5. Re-add unique constraint

**Performance:** ~1-2 seconds for 19K pincodes + 165K postoffices

**Breaking:** No - all queries already use `LOWER()` for case-insensitive search

---

## Current Schema State

After all 11 migrations, the database has:

**Tables:**
- `pincodes` - 19,586 rows (274 without boundaries)
- `postoffices` - 165,627 rows (deduplicated)
- `api_keys` - API authentication
- `api_usage` - Usage tracking

**Indexes (17 total):**
- 2 GIST spatial indexes (boundary, centroid)
- 1 functional composite index (LOWER(state), LOWER(district))
- 14 B-tree indexes (various fields)

**Functions:**
- `update_updated_at_column()` - Auto-update timestamp trigger
- `digipin_calc_indices()` - DIGIPIN grid calculation
- `digipin_grid_char()` - Character lookup
- `digipin_update_box()` - Bounding box helper
- `encode_digipin_level6()` - Coordinate → DIGIPIN
- `polygon_to_digipin_cells_level6()` - Polygon → DIGIPIN array (2 overloads)

---

## Migration Dependencies

```
1. InitialSchema (creates pincodes)
   ↓
2. AddIndexesAndCentroid (adds centroid column)
   ↓
3. CreatePostOfficesTable (creates postoffices, FK to pincodes)
   ↓
4. MakeBoundaryNullable (modifies pincodes.boundary)
   ↓
5. AddPostOfficeUniqueConstraint (adds constraint to postoffices)
   
6. CreateAuthTables (independent - auth system)
   
7. AddSpatialIndexToPincodes (depends on pincodes table)
   ↓
8. AddDigipinFunctions (creates base functions)
   ↓
9. AddDigipinPolygonFunction (depends on #8 functions)
   
10. AddDistrictSearchIndex (depends on pincodes table)
    
11. NormalizeNamesToLowercase (depends on pincodes + postoffices)
```

---

## Notes

- All migrations use `CREATE OR REPLACE` or `IF EXISTS` for idempotency
- All spatial operations use SRID 4326 (WGS 84 - GPS coordinates)
- All text normalization uses lowercase for consistency
- PostGIS extension required (enabled in migration #1)
- TypeORM auto-runs migrations in order on startup
