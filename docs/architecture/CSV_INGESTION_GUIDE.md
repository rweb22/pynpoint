# CSV Ingestion Guide - BharatPin 2026 Dataset

## Overview

The CSV ingestion system processes the **BharatPin 2026 dataset** (165,627 post office records) to populate:
1. **`postoffices` table** - All post office records with detailed metadata
2. **`pincodes` table** - Updates state/district/city for existing pincodes, adds new pincodes without boundaries

---

## Data Sources

### 1. GeoJSON (Pincode Boundaries)
- **File**: `Datagov_Pincode_Boundaries.geojson`
- **Source**: data.gov.in
- **Records**: 19,312 pincodes with geographic boundaries
- **Purpose**: Spatial data for reverse geocoding and mapping

### 2. CSV (Post Office Data)
- **File**: `bharatpin_pincodes_2026.csv`
- **Source**: BharatPin/India Post 2026
- **Records**: 165,627 post offices
- **Unique Pincodes**: 19,586
- **Coverage**: All 37 states/UTs

---

## Initialization Workflow

### Phase 1: Database Validation
- Checks PostGIS extension is enabled
- Validates database connectivity

### Phase 2: Pincode Boundary Ingestion (GeoJSON)
- **Service**: `DataIngestionService`
- **Input**: `Datagov_Pincode_Boundaries.geojson`
- **Output**: 19,312 pincodes with boundaries in `pincodes` table
- **Check**: Skips if any pincodes exist

### Phase 3: CSV Data Ingestion (NEW)
- **Service**: `CSVIngestionService`
- **Input**: `bharatpin_pincodes_2026.csv`
- **Output**:
  - 165,627 post offices in `postoffices` table
  - Updates metadata for 19,312 existing pincodes
  - Inserts 274 new pincodes (without boundaries)

**Validation Criteria:**
- Minimum 160,000 post offices (97% threshold)
- Minimum 19,000 pincodes with metadata (97% threshold)
- Prevents partial ingestions

### Phase 4: H3 Spatial Index Build
- **Service**: `H3IndexService`
- **Output**: 32M+ hexagons in Redis
- Unchanged from previous implementation

---

## CSV Data Processing

### 1. Data Normalization

All text fields are normalized:
- **Trimmed**: No leading/trailing whitespace
- **Lowercase**: Consistent casing for state, district, city, area
- **Null handling**: Empty strings converted to `null`
- **GPS coordinates**: Invalid values converted to `null`

**Example:**
```
Before: "Kerala ", "Thrissur  ", "KOCHI"
After:  "kerala",   "thrissur",  "kochi"
```

### 2. Canonical Office Selection

When multiple offices share a pincode, the system selects the "canonical" office using:

**Priority 1: Office Type**
- HO (Head Office) > SO (Sub Office) > BO (Branch Office)

**Priority 2: Delivery Status**
- "delivery" > "non delivery"

**Example:**
```
Pincode 682024 has 3 offices:
1. Edapally SO (delivery)      ← CANONICAL (SO with delivery)
2. Edapally West BO (delivery)
3. Edapally East BO (non delivery)

Result: state="kerala", district="ernakulam", city="kochi" from Edapally SO
```

### 3. Pincode Updates

**For existing pincodes (with boundaries):**
- Updates `state`, `district`, `city`, `office_name` from canonical office
- Preserves `boundary` and `centroid` (spatial data)

**For new pincodes (without boundaries):**
- Inserts into `pincodes` table with metadata
- Sets `boundary=NULL`, `centroid=NULL`
- Useful for metadata lookups even without spatial capabilities

---

## Database Schema

### `postoffices` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `SERIAL` | Primary key |
| `pincode` | `VARCHAR(6)` | 6-digit postal code |
| `officename` | `VARCHAR(200)` | Official post office name |
| `area` | `VARCHAR(200)` | Locality/area name (normalized) |
| `officetype` | `VARCHAR(2)` | HO, SO, or BO |
| `delivery` | `VARCHAR(20)` | "delivery" or "non delivery" |
| `district` | `VARCHAR(100)` | District name (normalized) |
| `state` | `VARCHAR(100)` | State/UT name (normalized) |
| `division` | `VARCHAR(100)` | Postal division |
| `region` | `VARCHAR(100)` | Postal region |
| `circle` | `VARCHAR(100)` | Postal circle |
| `latitude` | `DECIMAL(10,7)` | GPS latitude (nullable) |
| `longitude` | `DECIMAL(10,7)` | GPS longitude (nullable) |

**Indexes:**
- `pincode`, `state`, `district`, `area`, `officetype`, `delivery`, `is_active`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CSV_DATA_PATH` | `./bharatpin_pincodes_2026.csv` | Path to CSV file |
| `FORCE_REINGEST_CSV` | `false` | Force re-ingestion even if data exists |
| `SKIP_INITIALIZATION` | `false` | Skip entire initialization |
| `NODE_ENV` | - | `production` = fail fast, `development` = auto-ingest |

---

## Performance

**CSV Ingestion:**
- Post offices: ~1000 records/batch
- Processing time: ~2-3 minutes for 165,627 records
- Memory: Moderate (streaming CSV parser)

**Total Initialization (Cold Start):**
1. Phase 2 (GeoJSON): ~30-60 seconds
2. Phase 3 (CSV): ~2-3 minutes
3. Phase 4 (H3): ~10-12 minutes
4. **Total**: ~13-15 minutes

---

## Data Quality

**GPS Coverage:** 92.7%
- 153,585 post offices have coordinates
- 12,042 post offices missing coordinates (still searchable by metadata)

**State Coverage:** All 37 states/UTs
- No "North Eastern" grouping
- No "Jammukashmir" errors
- Proper state names in lowercase

---

## Troubleshooting

### CSV ingestion keeps re-running
**Cause**: Fewer than 160,000 post offices or 19,000 pincodes with metadata

**Solution**: Check the thresholds in `checkCSVDataExists()`:
```typescript
const MIN_POST_OFFICES = 160000;
const MIN_PINCODES_WITH_METADATA = 19000;
```

### Duplicate post offices
**Cause**: Force re-ingestion without clearing existing data

**Solution**: Set `FORCE_REINGEST_CSV=true` - it automatically clears before re-inserting

### Missing states/districts
**Cause**: CSV file incomplete or corrupted

**Solution**: Re-download `bharatpin_pincodes_2026.csv` (21.5 MB, 165,628 lines including header)

---

## Migration History

1. `1718260800000-InitialSchema.ts` - Creates `pincodes` table, enables PostGIS
2. `1718349000000-AddIndexesAndCentroid.ts` - Adds indexes and centroid column
3. `1718350000000-CreatePostOfficesTable.ts` - Creates `postoffices` table ✨ NEW

---

**Last Updated**: 2026-06-13
