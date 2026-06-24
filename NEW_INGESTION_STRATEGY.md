# New Data Ingestion Strategy

## Current Problems

**Current Flow:**
1. ❌ Ingest GeoJSON first → Creates `pincodes` table with 19,312 records
2. ❌ Ingest CSV second → Updates pincodes, adds 274 new ones, inserts postoffices
3. ❌ GeoJSON provides WRONG state/district (postal "Circle", not administrative state)
4. ❌ CSV then overwrites with correct state/district

**Issues:**
- GeoJSON "Circle" field is NOT the same as state (groups UTs, uses "North Eastern", etc.)
- Wastes time loading wrong data just to overwrite it
- Complex logic to handle mismatches
- 274 pincodes only in CSV get no boundaries (should be handled better)

---

## New Strategy (Correct Order)

### Phase 1: Create Tables with Proper Schema

**1.1 Create `pincodes` table:**
```sql
CREATE TABLE IF NOT EXISTS pincodes (
  pincode VARCHAR(6) PRIMARY KEY,
  
  -- Core administrative data (from CSV/JSON)
  state VARCHAR(100),
  district VARCHAR(100),
  city VARCHAR(100),
  office_name VARCHAR(200),  -- Main/HO office for this pincode
  
  -- Spatial data (from GeoJSON - nullable)
  boundary GEOGRAPHY(MULTIPOLYGON, 4326),
  centroid GEOGRAPHY(POINT, 4326),
  
  -- Metadata
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pincodes_state ON pincodes(state);
CREATE INDEX idx_pincodes_district ON pincodes(district);
CREATE INDEX idx_pincodes_city ON pincodes(city);
CREATE INDEX idx_pincodes_boundary ON pincodes USING GIST(boundary);
CREATE INDEX idx_pincodes_centroid ON pincodes USING GIST(centroid);
```

**1.2 Create `postoffices` table:**
```sql
CREATE TABLE IF NOT EXISTS postoffices (
  id SERIAL PRIMARY KEY,
  pincode VARCHAR(6) NOT NULL REFERENCES pincodes(pincode) ON DELETE SET NULL,
  
  -- Office details
  officename VARCHAR(200) NOT NULL,
  officetype VARCHAR(2),  -- HO, SO, BO
  delivery VARCHAR(20),
  
  -- Location
  area VARCHAR(200),
  district VARCHAR(100),
  state VARCHAR(100),
  
  -- Postal hierarchy
  division VARCHAR(100),
  region VARCHAR(100),
  circle VARCHAR(100),
  
  -- GPS coordinates
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_postoffices_pincode ON postoffices(pincode);
CREATE INDEX idx_postoffices_state ON postoffices(state);
CREATE INDEX idx_postoffices_district ON postoffices(district);
CREATE INDEX idx_postoffices_officetype ON postoffices(officetype);
CREATE INDEX idx_postoffices_coords ON postoffices(latitude, longitude);
```

### Phase 2: Ingest Official JSON Data (Google Drive)

**Source:** `https://drive.google.com/uc?export=download&id=1n2gZPURDVlnBfQk3rm8h7V6vNQiqyGi-`

**Data:** 165,627 postoffices, 19,586 pincodes

**Steps:**
1. Download JSON from Google Drive
2. Extract unique pincodes → Insert into `pincodes` table (19,586 records)
   - `pincode`, `state`, `district`, `city` (area), `office_name` (canonical)
   - Leave `boundary` and `centroid` NULL for now
3. Insert all postoffices → Insert into `postoffices` table (165,627 records)
   - All fields from JSON
   - Map `officetype='PO'` → `'SO'`

**Result:**
- ✅ `pincodes`: 19,586 records with correct state/district (no boundaries yet)
- ✅ `postoffices`: 165,627 records
- ✅ All foreign keys satisfied

### Phase 3: Enrich with GeoJSON Boundary Data

**Source:** `Datagov_Pincode_Boundaries.geojson` (local file, 87MB)

**Data:** 19,312 pincode boundaries

**Steps:**
1. Parse GeoJSON file
2. For each feature:
   - Extract `pincode` and `geometry` (polygon/multipolygon)
   - Calculate centroid from geometry
   - **UPDATE existing pincode** in `pincodes` table:
     ```sql
     UPDATE pincodes
     SET boundary = ST_GeomFromGeoJSON('<geometry>')::geography,
         centroid = ST_Centroid(ST_GeomFromGeoJSON('<geometry>'))::geography,
         updated_at = CURRENT_TIMESTAMP
     WHERE pincode = '<pincode>';
     ```
3. Log pincodes that have boundaries vs those that don't

**Result:**
- ✅ 19,302 pincodes updated with boundaries (overlap with JSON)
- ⚠️ 274 pincodes from JSON have no boundaries (acceptable - new pincodes)
- ⚠️ 10 pincodes from GeoJSON not in JSON (very new - log for investigation)

---

## Benefits of New Strategy

1. ✅ **Correct data first** - State/district from official CSV, not postal circles
2. ✅ **Simpler logic** - No overwrites, just enrichment
3. ✅ **Clear separation** - Administrative data (JSON) + Spatial data (GeoJSON)
4. ✅ **Nullable boundaries** - Pincodes without boundaries are fine
5. ✅ **Traceable** - Can see which pincodes have/don't have boundaries
6. ✅ **Idempotent** - Can re-run Phase 3 to update boundaries without affecting data

---

## Implementation Tasks

1. ✅ Update `pynpoint/DATA_SOURCES_EVALUATION.md` with analysis
2. ✅ Create new `official-json-ingestion.service.ts` - **DONE**
3. ✅ Update `data-ingestion.service.ts` to only handle GeoJSON enrichment (UPDATE mode) - **DONE**
4. ✅ Update `initialization.service.ts` with new order (Phase 2 first, then Phase 3) - **DONE**
5. ✅ Update `initialization.module.ts` with new service provider - **DONE**
6. ✅ Build succeeds with no errors - **VERIFIED**
7. ⏳ Environment variables needed:
   - `OFFICIAL_JSON_URL` - Google Drive link (default configured)
   - `GEOJSON_FILE_PATH` - Local GeoJSON path (default: `./Datagov_Pincode_Boundaries.geojson`)
8. ⏳ Test locally with clean database
9. ⏳ Deploy to Railway

---

## Data Quality Handling

**715 'NA' state records:**
- Keep as-is for now
- Can be cleaned up later based on pincode prefix analysis

**Missing GPS (12,007 records):**
- Store as NULL
- Can enrich later via geocoding API

**Office type mapping:**
- `PO` → `SO` during JSON import
- Store consistently as `HO`, `SO`, `BO`
