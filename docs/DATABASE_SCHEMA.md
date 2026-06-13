# Database Schema - PinPoint India

## Overview

PinPoint India uses a **PostgreSQL + PostGIS** database for spatial data and **Redis** for the H3 spatial index.

---

## PostgreSQL Tables

### **Table: `pincodes`**

Stores Indian postal codes (PINs) with geographic boundaries and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `SERIAL` | `PRIMARY KEY` | Auto-incrementing ID |
| `pincode` | `VARCHAR(6)` | `NOT NULL`, `UNIQUE` | 6-digit postal code |
| `boundary` | `geography(MultiPolygon, 4326)` | `NOT NULL` | PostGIS geographic boundary (WGS 84) |
| `centroid` | `geography(Point, 4326)` | `NULL` | Geometric center of the pincode (computed from boundary) |
| `state` | `VARCHAR(100)` | `NULL` | State name (e.g., "Kerala") |
| `district` | `VARCHAR(100)` | `NULL` | District name (e.g., "Thrissur") |
| `city` | `VARCHAR(100)` | `NULL` | City/Town name |
| `office_name` | `VARCHAR(200)` | `NULL` | Post office name |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT true` | Soft delete flag |
| `created_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Record creation time |
| `updated_at` | `TIMESTAMP` | `NOT NULL`, `DEFAULT CURRENT_TIMESTAMP` | Last update time (auto-updated via trigger) |

#### **Indexes:**

| Index Name | Type | Column(s) | Purpose |
|------------|------|-----------|---------|
| `pincodes_pkey` | PRIMARY KEY | `id` | Primary key |
| `idx_pincodes_pincode` | B-tree | `pincode` | Fast lookups by pincode |
| `idx_pincodes_boundary` | GIST (spatial) | `boundary` | Geographic queries (point-in-polygon, intersects) |
| `idx_pincodes_centroid` | GIST (spatial) | `centroid` | Point-based queries (nearest neighbor, distance) |
| `idx_pincodes_state` | B-tree | `state` | Filter by state |
| `idx_pincodes_district` | B-tree | `district` | Filter by district |
| `idx_pincodes_city` | B-tree | `city` | Filter by city |
| `idx_pincodes_is_active` | B-tree | `is_active` | Soft delete filtering |

#### **Triggers:**

- **`update_pincodes_updated_at`**: Automatically updates `updated_at` column on row modification

#### **Statistics:**

- **Total rows**: 19,312 pincodes
- **Total size**: ~150MB (with indexes)
- **Boundary type**: MultiPolygon (can contain multiple disconnected regions)
- **SRID**: 4326 (WGS 84 - standard GPS coordinates, latitude/longitude)

---

## Redis Data Structures

### **H3 Spatial Index**

Used for reverse geocoding (latitude/longitude → pincode) at resolution 9.

#### **Key Pattern: `h3:{hexagon_id}`**

- **Type**: `SET`
- **Value**: Set of pincode strings
- **Description**: Maps an H3 hexagon to all pincodes that overlap it

**Example:**
```
Key:   h3:8928308280fffff
Value: {"110001", "110002", "110003"}
```

#### **Statistics:**

- **Total keys**: ~30.5 million H3 hexagons
- **Total memory**: ~2GB
- **Resolution**: 9 (hexagon edge length ~174m)
- **Average hexagons per pincode**: ~1,685

### **H3 Metadata Keys**

| Key | Type | Example Value | Description |
|-----|------|---------------|-------------|
| `h3:stats:total_pincodes` | STRING | `"19312"` | Total pincodes indexed |
| `h3:stats:total_hexagons` | STRING | `"32549114"` | Total unique hexagons |
| `h3:stats:avg_hexagons_per_pincode` | STRING | `"1685"` | Average hexagons per pincode |
| `h3:stats:last_built` | STRING | `"2026-06-13T10:06:08.842Z"` | ISO timestamp of last build |
| `h3:stats:resolution` | STRING | `"9"` | H3 resolution level |

---

## Data Sources

### **Pincode Boundaries**

- **Source**: data.gov.in
- **File**: `Datagov_Pincode_Boundaries.geojson` (29.71 MB compressed)
- **Format**: GeoJSON FeatureCollection
- **Coordinate System**: WGS 84 (EPSG:4326)
- **Features**: 19,312 pincodes

**Properties extracted:**
- `Pincode` → `pincode`
- `Office_Name` → `office_name`
- `Division` → (not stored)
- `Region` → (not stored)
- `Circle` → (not stored, but could map to `state`)

### **Centroid Calculation**

The `centroid` column is computed using PostGIS:
```sql
ST_Centroid(boundary::geometry)::geography
```

This provides a representative point for each pincode, useful for:
- Map markers
- Distance calculations
- Nearest pincode queries

---

## Spatial Queries Examples

### **1. Find pincode by coordinates (Point-in-Polygon)**

```sql
SELECT pincode, state, district, city
FROM pincodes
WHERE ST_Covers(boundary, ST_GeogFromText('POINT(77.2090 28.6139)'))
  AND is_active = true;
```

### **2. Find nearest pincodes to a point**

```sql
SELECT pincode, state, district,
       ST_Distance(centroid, ST_GeogFromText('POINT(77.2090 28.6139)')) as distance_m
FROM pincodes
WHERE is_active = true
ORDER BY centroid <-> ST_GeogFromText('POINT(77.2090 28.6139)')
LIMIT 10;
```

### **3. Find all pincodes in a state**

```sql
SELECT pincode, district, city
FROM pincodes
WHERE state = 'Kerala'
  AND is_active = true
ORDER BY pincode;
```

### **4. Calculate distance between two pincodes**

```sql
SELECT ST_Distance(
  (SELECT centroid FROM pincodes WHERE pincode = '110001'),
  (SELECT centroid FROM pincodes WHERE pincode = '400001')
) / 1000 as distance_km;
```

---

## Future Schema Extensions

Based on the design documents, future tables may include:

1. **`post_offices`** - Individual office locations within pincodes
2. **`rto_risk_factors`** - RTO risk scoring data
3. **`tier_classifications`** - Tier 1/2/3 classifications
4. **`distance_cache`** - Cached distances between frequently queried pincodes

---

## Migrations

Migrations are managed by TypeORM and located in `src/database/migrations/`.

**Current migrations:**
1. `1718260800000-InitialSchema.ts` - Creates `pincodes` table, enables PostGIS
2. `1718349000000-AddIndexesAndCentroid.ts` - Adds district/city indexes and centroid column

**To run migrations:**
```bash
npm run migration:run
```

**To revert last migration:**
```bash
npm run migration:revert
```

---

## Performance Notes

1. **Spatial indexes (GIST)** are crucial for geographic queries - never run point-in-polygon queries without them!
2. **B-tree indexes** on `pincode`, `state`, `district`, `city` enable fast filtering
3. **`centroid` column** pre-computed to avoid expensive ST_Centroid calculations at query time
4. **Redis H3 index** provides O(1) reverse geocoding (lat/lng → pincode)
5. **`is_active` flag** allows soft deletes without actually removing data

---

## Backup & Restore

**PostgreSQL:**
```bash
pg_dump $DATABASE_URL > pincodes_backup.sql
psql $DATABASE_URL < pincodes_backup.sql
```

**Redis:**
```bash
redis-cli -u $REDIS_URL --rdb dump.rdb
redis-cli -u $REDIS_URL --pipe < dump.rdb
```

---

**Last Updated**: 2026-06-13
