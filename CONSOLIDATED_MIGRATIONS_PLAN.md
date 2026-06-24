# Consolidated Migrations Plan

## Current State
- **11 migrations** spread across multiple concerns
- Difficult to understand schema at a glance
- Historical baggage (boundary NOT NULL → nullable)

## Proposed Consolidation

**Target: 5 clean migrations**

1. **00-EnablePostGIS.ts** - Extension setup
2. **01-CreatePincodesTable.ts** - Pincodes schema (complete)
3. **02-CreatePostOfficesTable.ts** - PostOffices schema (complete)
4. **03-CreateAuthTables.ts** - API authentication (complete)
5. **04-CreateDigipinFunctions.ts** - DIGIPIN functions (complete)

---

## Migration 00: EnablePostGIS

**Purpose:** Enable PostGIS extension  
**Dependencies:** None  
**Run Once:** Yes (extension persists)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## Migration 01: CreatePincodesTable

**Purpose:** Complete pincodes table with all columns, indexes, constraints, and triggers

### Columns (10 total)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment |
| `pincode` | VARCHAR(6) | UNIQUE, NOT NULL | Indexed |
| `boundary` | GEOGRAPHY(MultiPolygon, 4326) | NULLABLE | Spatial index |
| `centroid` | GEOGRAPHY(Point, 4326) | NULLABLE | Spatial index |
| `state` | VARCHAR(100) | NULLABLE | Functional index |
| `district` | VARCHAR(100) | NULLABLE | Functional index |
| `city` | VARCHAR(100) | NULLABLE | B-tree index |
| `office_name` | VARCHAR(200) | NULLABLE | - |
| `is_active` | BOOLEAN | DEFAULT TRUE | B-tree index |
| `created_at` | TIMESTAMP | DEFAULT NOW() | - |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Auto-updated |

### Indexes (8 total)

```sql
-- B-tree indexes
CREATE UNIQUE INDEX idx_pincodes_pincode ON pincodes(pincode);
CREATE INDEX idx_pincodes_state ON pincodes(state);
CREATE INDEX idx_pincodes_district ON pincodes(district);
CREATE INDEX idx_pincodes_city ON pincodes(city);
CREATE INDEX idx_pincodes_is_active ON pincodes(is_active);

-- Functional composite index (performance: 30s → 50ms)
CREATE INDEX idx_pincodes_state_district_lower 
ON pincodes (LOWER(state), LOWER(district));

-- Spatial indexes (GIST)
CREATE INDEX idx_pincodes_boundary ON pincodes USING GIST(boundary);
CREATE INDEX idx_pincodes_centroid ON pincodes USING GIST(centroid);
```

### Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_pincodes_updated_at
BEFORE UPDATE ON pincodes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Design Decisions

✅ **`boundary` is NULLABLE** - 274 pincodes (out of 19,586) don't have GeoJSON data  
✅ **Lowercase normalization** - All text stored in lowercase for consistency  
✅ **Functional index** - Supports `WHERE LOWER(state) = LOWER(?)` queries efficiently  
✅ **Spatial indexes** - Critical for point-in-polygon queries (1-5s → 1-10ms)

---

## Migration 02: CreatePostOfficesTable

**Purpose:** Complete postoffices table with all columns, indexes, constraints, and FK

### Columns (16 total)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment |
| `pincode` | VARCHAR(6) | NOT NULL, FK | References pincodes(pincode) |
| `officename` | VARCHAR(200) | NOT NULL | Part of unique constraint |
| `area` | VARCHAR(200) | NULLABLE | Can be NULL for official JSON |
| `officetype` | VARCHAR(2) | NOT NULL | HO, SO, BO |
| `delivery` | VARCHAR(20) | NOT NULL | "delivery" or "non delivery" |
| `district` | VARCHAR(100) | NOT NULL | Lowercase normalized |
| `state` | VARCHAR(100) | NOT NULL | Lowercase normalized |
| `division` | VARCHAR(100) | NULLABLE | Postal hierarchy |
| `region` | VARCHAR(100) | NULLABLE | Postal hierarchy |
| `circle` | VARCHAR(100) | NULLABLE | Postal hierarchy |
| `latitude` | DECIMAL(10,7) | NULLABLE | 7.3% missing |
| `longitude` | DECIMAL(10,7) | NULLABLE | 7.3% missing |
| `is_active` | BOOLEAN | DEFAULT TRUE | Soft delete |
| `created_at` | TIMESTAMP | DEFAULT NOW() | - |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | Auto-updated |

### Indexes (8 total)

```sql
CREATE INDEX idx_postoffices_pincode ON postoffices(pincode);
CREATE INDEX idx_postoffices_state ON postoffices(state);
CREATE INDEX idx_postoffices_district ON postoffices(district);
CREATE INDEX idx_postoffices_area ON postoffices(area);
CREATE INDEX idx_postoffices_officetype ON postoffices(officetype);
CREATE INDEX idx_postoffices_delivery ON postoffices(delivery);
CREATE INDEX idx_postoffices_is_active ON postoffices(is_active);
CREATE INDEX idx_postoffices_coords ON postoffices(latitude, longitude);
```

### Constraints

```sql
-- Unique constraint (prevent duplicates)
ALTER TABLE postoffices
ADD CONSTRAINT uq_postoffices_pincode_officename
UNIQUE (pincode, officename);

-- Foreign key (ON DELETE SET NULL - pincodes may be soft-deleted)
ALTER TABLE postoffices
ADD CONSTRAINT fk_postoffices_pincode
FOREIGN KEY (pincode)
REFERENCES pincodes(pincode)
ON DELETE SET NULL;
```

### Triggers

```sql
CREATE TRIGGER update_postoffices_updated_at
BEFORE UPDATE ON postoffices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

### Design Decisions

✅ **`area` is NULLABLE** - Official JSON doesn't have this field  
✅ **Unique on (pincode, officename)** - Prevents duplicate imports  
✅ **Foreign key SET NULL** - Preserves postoffices if pincode soft-deleted  
✅ **Composite index on coords** - Supports GPS-based queries

---

## Migration 03: CreateAuthTables

**Purpose:** API authentication and usage tracking

### Tables: `api_keys` and `api_usage`

(Keep existing migration #6 as-is - already well-designed)

**Changes:** None needed - already consolidated

---

## Migration 04: CreateDigipinFunctions

**Purpose:** DIGIPIN encoding functions for India Post digital addressing

### Functions (6 total)

1. `digipin_calc_indices(lat, lng, box_min_lat, box_max_lat, box_min_lng, box_max_lng)`
2. `digipin_grid_char(lat_idx, lng_idx)`
3. `digipin_update_box(lat_idx, lng_idx, box_min_lat, box_max_lat, box_min_lng, box_max_lng)`
4. `encode_digipin_level6(lat, lng)` - Main encoding function
5. `polygon_to_digipin_cells_level6(geom GEOMETRY, spacing)` - Polygon coverage
6. `polygon_to_digipin_cells_level6(geog GEOGRAPHY, spacing)` - Overload

(Merge migrations #8 and #9 into one)

**Changes:** Combine into single migration with all 6 functions

---

## Benefits of Consolidation

| Aspect | Before (11 migrations) | After (5 migrations) |
|--------|------------------------|----------------------|
| **Clarity** | Scattered across 11 files | One file per table |
| **Maintainability** | Hard to track changes | Clear ownership |
| **Onboarding** | Must read 11 files | Read 5 files |
| **Testing** | Test 11 migrations | Test 5 migrations |
| **Schema understanding** | Piece together | See complete picture |

---

## Migration Strategy

### Option A: Fresh Start (Recommended for clean DB)
1. Drop all existing migrations
2. Create new 5 migrations
3. Apply to fresh database

### Option B: Append Consolidation (For production DB)
1. Keep existing 11 migrations (historical record)
2. Create migration #12: "Consolidate schema verification"
3. Verify schema matches consolidated design
4. Document that migrations 1-11 are deprecated

**Recommendation:** Option A for development, Option B for production

---

## Next Steps

1. ✅ Review this plan
2. ⏳ Create 5 new migration files
3. ⏳ Test on clean database
4. ⏳ Verify all features work (spatial queries, DIGIPIN, auth)
5. ⏳ Update documentation

**Should I proceed with creating the 5 consolidated migrations?**
