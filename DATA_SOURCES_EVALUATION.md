# Indian Postal Data Sources - Quality Evaluation

## Purpose
This document tracks all available data sources for Indian postal codes (pincodes) and post office information. We evaluate each source for data quality, completeness, and accuracy to determine which to use for the PinPoint India API.

---

## Current Dataset (In Production)

### Source: BharatPin 2026 (Combined)
- **Records**: 165,627 post offices
- **States**: 38 unique states/UTs
- **Pincodes**: 19,596 unique pincodes

#### Known Issues
1. **Andaman & Nicobar Mismatches** (100 postoffices)
   - A&N postoffices incorrectly marked as "Dadra & Nagar Haveli and Daman & Diu"
   - Status: SQL fix ready, not yet applied
   
2. **UT Name Separation** (9 pincodes)
   - "Dadra & Nagar Haveli" and "Daman & Diu" separated instead of merged
   - Official merger: 2020 (should be one combined UT)
   - Status: SQL fix ready, not yet applied

3. **Unknown State** (3 pincodes)
   - Pincodes with state='unknown'
   - Status: Needs investigation or deletion

4. **District Mismatches** (~1,450 postoffices)
   - Postoffices with different district than their pincode boundary
   - May be legitimate (cross-district service areas) or data inconsistencies
   - Status: Needs careful review before bulk update

5. **Data Loss** (325 postoffices)
   - Deleted during cleanup attempt
   - Need to restore from original CSV

#### Data Quality Score
- **State Names**: ✅ Good (normalized, consistent case)
- **Pincode Coverage**: ✅ Good (19,596 pincodes)
- **Completeness**: ⚠️ Medium (325 deleted rows to restore)
- **Consistency**: ⚠️ Medium (state/district sync issues)
- **GPS Coordinates**: ✅ Good (~92.7% coverage)

---

## Alternative Sources

### 1. Kaggle: Pincode_Dataset.csv
- **Location**: `./Pincode_Dataset.csv`
- **Records**: 155,598 post offices (9,970 fewer than current)
- **Format**: CSV with columns: Circle Name, Region Name, Division Name, Office Name, Pincode, OfficeType, Delivery, District, StateName

#### Issues Found
1. **Truncated State Names**
   - "Andaman and Nico.In." (should be "Andaman & Nicobar")
   - "Dadra and Nagar Hav." (truncated)
   
2. **Mixed Data in StateName Column** (109 unique values instead of ~38)
   - District names appearing as states: ANGUL, BANKA, ARIYALUR, COIMBATORE, etc.
   - Delivery status leaking: "Non Delivery" appears as state
   - Header corruption: "StateName" appears as a value
   
3. **Inconsistent Casing**
   - Mix of UPPERCASE and Title Case
   - Examples: "DHARMAPURI" vs "Tamil Nadu"

4. **Fewer Records**
   - Missing ~9,970 post offices compared to current dataset

#### Data Quality Score
- **State Names**: ❌ Poor (truncated, mixed data)
- **Pincode Coverage**: ⚠️ Unknown (needs analysis)
- **Completeness**: ⚠️ Lower (155k vs 165k records)
- **Consistency**: ❌ Poor (mixed district/state data)
- **GPS Coordinates**: ❓ Not checked yet

#### Verdict
❌ **Not Recommended** - Requires extensive cleanup, truncated names, fewer records

---

## Evaluation Criteria

For each data source, we evaluate:

1. **Completeness**
   - Total post office count
   - Pincode coverage (target: 19,000+)
   - GPS coordinate availability

2. **Accuracy**
   - State names (proper, not truncated)
   - District names (current administrative divisions)
   - Pincode format (6 digits)

3. **Consistency**
   - Normalized casing
   - No mixed data in columns
   - Proper state/UT names (post-2020 mergers)

4. **Administrative Correctness**
   - Reflects current state/UT structure (38 states/UTs)
   - Includes recent changes (e.g., Ladakh separation, UT mergers)
   - Correct district reorganizations

---

## Official Government Sources

### 1. data.gov.in - All India Pincode Directory (Web Service)
- **URL**: https://www.data.gov.in/catalog/all-india-pincode-directory-through-webservice
- **Publisher**: Ministry of Communications, Department of Posts
- **License**: National Data Sharing and Accessibility Policy (NDSAP)
- **Published**: December 4, 2020
- **Updated**: March 10, 2025
- **Resource ID**: `6176ee09-3d56-4a3b-8115-21841576b2f6`
- **Status**: ✅ Active - Official Government Source

**What it provides:**
- Circle Name, Region Name, Division Name
- Office Name, Pincode, Office Type
- Delivery status, District, State Name
- RESTful API access with filters and sorting
- CSV/JSON/XML export options

**Access Options:**

1. **API Access** (Requires authentication):
   - Free registration at data.gov.in
   - API key needed (generated from "My Account" page)
   - API endpoint format: `https://api.data.gov.in/resource/6176ee09-3d56-4a3b-8115-21841576b2f6?api-key=YOUR_KEY&format=json&offset=0&limit=1000`
   - Supports filters, sorting, pagination

2. **Bulk CSV Download** (Likely available):
   - India Post website links to: `https://data.gov.in/node/6818285` (Download All India Pincode Directory)
   - Alternative: `https://data.gov.in/catalog/locality-based-pincode` (Village/Locality based)
   - Note: Direct access blocked during testing (may require login or captcha)

**Known Issues:**
- ⚠️ API requires authentication (not suitable for public-facing apps without proxy)
- ⚠️ Rate limits may apply
- ⚠️ Bulk download links may require manual access via browser
- ⚠️ Data.gov.in has access restrictions (WAF blocking automated tools)

**Community Tools:**
- Python wrapper: `datagovindia` package (pip install datagovindia)
- R wrapper: `datagovindia` package
- PHP wrapper: `liridian/pincode-directory`
- Node.js wrapper: `rahasya-co/india-location-details`

**Community Mirrors:**
- GitHub: `saravanakumargn/All-India-Pincode-Directory` (JSON, XML, SQL, CSV, Excel formats)
- GitHub: `dropdevrahul/pincodes-india` (Go client + data)

**Deep Analysis Results** (File: `5c2f62fe-5afa-4119-a499-fec9d604d5bd.csv`):
- **Total Records**: 165,627 post offices (exact match with current dataset)
- **Unique Pincodes**: 19,586 (current dataset has 19,596 - difference of 10)
- **Unique States**: 37
- **Unique Districts**: 750
- **GPS Coverage**: 92.7% (153,618 with coordinates, 12,009 missing)

**Columns Available**:
1. circlename, regionname, divisionname
2. officename, pincode, officetype
3. delivery, district, statename
4. latitude, longitude

**Office Type Mapping**:
- `HO` = Head Office (811 records)
- `PO` = Post Office/Sub Office (24,546 records) → Maps to `SO` in current schema
- `BO` = Branch Office (140,270 records)

**Data Quality Issues Found**:
1. **statename='NA'**: 715 records (4.3% of unknown state)
2. **Pincodes spanning multiple states**: 290 pincodes
   - Mostly Telangana/Andhra Pradesh border areas (expected - recent state split)
   - Some with 'NA' state mixed with valid states
3. **State naming**: Consistent uppercase format
   - "ANDAMAN AND NICOBAR ISLANDS" ✅
   - "THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU" ✅ (correct merged UT name)
4. **Missing 10 pincodes** compared to current dataset (needs investigation)

**Pros**:
✅ Official government source (Ministry of Communications, Department of Posts)
✅ Recently updated (March 10, 2025)
✅ Complete coverage (165,627 postoffices)
✅ High GPS coverage (92.7%)
✅ Consistent state naming (uppercase)
✅ Proper UT merger handling
✅ Includes administrative hierarchy (circle, region, division)

**Cons**:
❌ 715 records with state='NA' (4.3%)
❌ Missing 10 pincodes vs current dataset
❌ Office type uses 'PO' instead of 'SO' (requires mapping)
❌ 7.3% missing GPS coordinates
❌ 290 pincodes span multiple states (requires policy on how to handle)

**JSON vs CSV Comparison**:
- ✅ **Identical content** - Both CSV and JSON have exactly 165,627 records
- ✅ **Same field structure** - All 11 fields match perfectly
- ✅ **Same data types** - Both use strings for all fields
- ✅ **Same coverage** - Both have 19,586 unique pincodes
- ✅ **Same issues** - Both have 715 'NA' state records
- 📦 **File sizes**: CSV = ~23MB, JSON = ~57MB

**Recommendation**: Use **CSV format** for import (smaller file size, same data)

**Public Download Link**:
- Google Drive (JSON, 57MB): `https://drive.google.com/uc?export=download&id=1n2gZPURDVlnBfQk3rm8h7V6vNQiqyGi-`
- Can be used for automated ingestion in deployment pipeline

**Evaluation**: ⭐⭐⭐ **HIGHLY RECOMMENDED AS PRIMARY SOURCE** - Official, complete, well-structured. The 'NA' state records and office type mapping are minor issues easily fixed during import.

**Detailed Anomaly Analysis** (completed):

1. **Andaman & Nicobar Islands** ✅
   - 100 postoffices across 22 pincodes
   - 3 districts: South Andamans (48), North and Middle Andaman (34), Nicobars (18)
   - Properly named: "ANDAMAN AND NICOBAR ISLANDS"

2. **'NA' State Records** ⚠️
   - 715 records (0.43%) with statename='NA' AND district='NA'
   - Mostly border areas or reorganized districts
   - Examples: Kolalapudi (523261), Karma (811315), Sonbarsha (811106)
   - Decision needed: Keep as-is, investigate, or assign based on pincode prefix

3. **Multi-State Pincodes** ✅ (Expected)
   - 290 pincodes span 2 states each
   - Mostly Telangana/Andhra Pradesh border (state split in 2014)
   - Also some 'NA' state mixed with valid states
   - This is legitimate - border areas served by one pincode

4. **Missing GPS Coordinates** ⚠️
   - 12,007 records (7.25%) missing GPS
   - Tripura worst affected: 86.0% missing
   - Andhra Pradesh: 21.3%, Madhya Pradesh: 15.2%, Karnataka: 13.2%
   - Can be enriched later via geocoding APIs

5. **Office Type Consistency** ✅
   - **94% of 'PO' records have 'S.O' suffix** in officename
   - This confirms: `officetype='PO'` = Sub Office (SO)
   - Only 0.1% have 'P.O' suffix (e.g., actual Post Offices misclassified?)
   - Mapping confirmed: `PO` → `SO` during import

6. **Field Validation** ✅
   - All core fields properly populated
   - Only 'NA' values: regionname (315), district (715), statename (715)
   - These 715 are the same records from item #2

7. **Delivery Status** ✅
   - 157,901 (95.3%) - Delivery
   - 7,726 (4.7%) - Non Delivery
   - Non-delivery offices are administrative/internal

**Next Steps with this source**:
1. ✅ Downloaded official CSV bulk file
2. ✅ Downloaded official JSON bulk file
3. ✅ Verified both formats are identical
4. ✅ Analyzed data structure and quality
5. ✅ Completed anomaly detection
6. ✅ Published to Google Drive for automated ingestion
7. ⏳ Compare with current production database
8. ⏳ Decide on import strategy (full replace vs incremental update)

---

## Source #2: All India Pincode Boundary GeoJSON (May 2025)

### Basic Information
- **File**: `Datagov_Pincode_Boundaries.geojson`
- **Size**: 87MB
- **Source**: data.gov.in (same as Source #1)
- **Last Updated**: May 2025
- **Format**: GeoJSON FeatureCollection

### Structure
- **Total Features**: 19,312 pincode boundaries
- **Geometry Types**:
  - Polygon: 18,324 (94.9%)
  - MultiPolygon: 988 (5.1%)

### Attributes (Properties)
Each feature has 5 properties:
1. **Pincode** - 6-digit postal code
2. **Office_Name** - Representative post office name (one per pincode)
3. **Division** - Postal division
4. **Region** - Postal region (3,811 features have empty Region)
5. **Circle** - Postal circle (roughly corresponds to state, 23 unique values)

### Coverage Analysis

**Pincodes**:
- GeoJSON: 19,312 pincodes
- CSV (Source #1): 19,586 pincodes
- **Missing from GeoJSON**: 274 pincodes

**Pincode Differences**:
- **Only in GeoJSON**: 10 pincodes (newer additions like AIIMS Bilaspur, IIITDM Kurnool)
- **Only in CSV**: 284 pincodes (mostly NDCs - Nodal Delivery Centres, new SOs)
- **In Both**: 19,302 pincodes

**Circle (State) Coverage**:
- GeoJSON: 23 "Circles" (postal regions)
- CSV: 37 actual states/UTs
- GeoJSON groups states: "North Eastern" includes multiple NE states
- GeoJSON missing: Andaman & Nicobar, Goa, Ladakh, most UTs

### What This Source Provides

✅ **Pros**:
- **Pincode boundaries** (polygon/multipolygon geometries)
- **Spatial coverage** for 19,312 pincodes
- **Representative office** for each pincode
- **May 2025 data** (recent)
- **Clean geometry** (no topology errors found)

❌ **Cons**:
- **Missing 274 pincodes** compared to CSV
- **No state/district names** (uses postal "Circle" instead)
- **No GPS coordinates** (only polygon boundaries)
- **Only 1 office per pincode** (CSV has multiple offices per pincode)
- **Missing UTs** (grouped into larger regions)
- **No office type** (HO/SO/BO classification)
- **3,811 features missing Region** field

### Data Quality Issues
1. **Incomplete coverage** - 274 pincodes not in GeoJSON
2. **Postal regions ≠ Administrative states** - Cannot directly map Circle to State
3. **No multi-office support** - Each pincode has only 1 office name
4. **Missing administrative hierarchy** - No state/district information

### Use Case for This Source

**Primary Use**: ✅ **Pincode Boundary Geometries**
- Use for spatial operations (point-in-polygon, boundary queries)
- Store polygon geometries in `pincodes` table
- **Do NOT use for state/district names** (use CSV instead)

**Secondary Use**: ⚠️ **Office Name Validation**
- Can cross-reference representative office names
- 19,302 pincodes overlap with CSV

### Recommended Strategy

**Hybrid Approach**:
1. ✅ Use **CSV (Source #1)** for:
   - State/district names
   - All postoffices (165,627 records)
   - GPS coordinates (92.7% coverage)
   - Office types (HO/SO/BO)

2. ✅ Use **GeoJSON (Source #2)** for:
   - Pincode boundary polygons
   - Spatial queries
   - Geographic visualization

3. ⚠️ **Merge Strategy**:
   - Import CSV data for all pincodes
   - Attach GeoJSON polygons to matching pincodes
   - For 274 pincodes only in CSV: no polygon (can approximate or leave null)
   - For 10 pincodes only in GeoJSON: investigate (may be very new)

### Verdict
⭐⭐ **RECOMMENDED FOR BOUNDARIES ONLY** - Essential for spatial operations but insufficient alone. Must be combined with CSV (Source #1) for complete pincode/postoffice data.

---

## Comparison: Official Source vs Current Production Database

### Summary
| Metric | Official (data.gov.in) | Current Production | Notes |
|--------|------------------------|-------------------|-------|
| **Total Postoffices** | 165,627 | 165,627 | ✅ Exact match |
| **Unique Pincodes** | 19,586 | 19,596 | ⚠️ Production has 10 more |
| **Unique States** | 37 | 38 | ⚠️ Investigate difference |
| **GPS Coverage** | 92.7% (153,618) | ~92.7% | ✅ Similar |
| **Office Types** | HO/PO/BO | HO/SO/BO | ⚠️ PO vs SO naming |

### Key Findings

**1. UT Naming - Official Source is CORRECT ✅**
- Official uses: `"THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU"` (52 postoffices)
- Production currently has them separated (needs merge)
- Official uses: `"ANDAMAN AND NICOBAR ISLANDS"` (100 postoffices)
- Production had these misclassified (already fixed)

**2. Office Type Terminology Difference ⚠️**
- Official: `PO` (Post Office) = 24,546 (14.8%)
- Production: `SO` (Sub Office)
- Mapping needed: `PO` → `SO` during import

**3. State 'NA' Records**
- Official has 715 records with `statename='NA'` (0.4%)
- These are legitimate records where state classification is ambiguous
- Examples: Border areas, newly reorganized districts

**4. The 10 Missing Pincodes**
- Official: 19,586 pincodes
- Production: 19,596 pincodes
- Need to identify which 10 pincodes are in production but not in official source
- Action: Query production DB for pincodes not in official CSV

### Verdict: Import Strategy

**Recommendation: Incremental Update (Hybrid Approach)**

**Phase 1: Fix Known Issues**
1. ✅ Fix Andaman & Nicobar mismatches (100 postoffices) - DONE
2. ✅ Merge Dadra & Nagar Haveli + Daman & Diu UTs - DONE
3. ⏳ Restore 325 deleted postoffices from official CSV

**Phase 2: Validate Against Official Source**
1. Compare all 165,627 records field-by-field
2. Identify discrepancies (state/district mismatches)
3. Generate update SQL for corrections

**Phase 3: Handle Edge Cases**
1. Investigate 10 extra pincodes in production
2. Decide on 715 'NA' state records handling
3. Sync office type naming (PO → SO)

---

### 2. data.gov.in - All India Pincode Boundary GeoJSON
- **URL**: https://kerala.data.gov.in/catalog/all-india-pincode-boundary-geo-json
- **Publisher**: Ministry of Communications, Department of Posts
- **Published**: May 9, 2025
- **Updated**: May 9, 2025
- **Format**: GeoJSON (ZIP download)
- **License**: NDSAP
- **Status**: ✅ Active - Official Government Source

**What it provides:**
- Pincode boundary polygons in GeoJSON format
- Official geofencing data from Department of Posts
- Complete spatial boundaries for all delivery pincodes

**Evaluation**: ⭐ **HIGHLY RECOMMENDED** - Official boundary data (May 2025)

---

### 3. DIGIPIN - Official India Post Project
- **GitHub**: https://github.com/INDIAPOST-gov/digipin
- **Documentation**: https://www.indiapost.gov.in/Navigation_Documents/Static_Navigation/DIGIPIN%20Technical%20Document%20Final%20English.pdf
- **Web Portal**: https://dac.indiapost.gov.in/mydigipin/home
- **Publisher**: Department of Posts, Ministry of Communications
- **License**: Open Source

**What it provides:**
- 10-character alphanumeric geocode system
- Hierarchical grid (10 precision levels)
- Encode/decode lat/long to DIGIPIN
- Official algorithm implementation

**Evaluation**: ℹ️ Complementary - Not a replacement for pincode data, but useful for location encoding

---

## Community/Developer Sources

### 4. India Pincode API by Aniket Thapa
- **URL**: https://aniket-thapa.github.io/india-pincode-api/
- **GitHub**: https://github.com/aniket-thapa (inferred)
- **Source**: Official Department of Posts via data.gov.in
- **Format**: Static JSON files (GitHub Pages hosted)
- **License**: CC BY-NC 4.0 (non-commercial use)
- **Status**: ✅ Active, well-maintained

**What it provides:**
- 155,000+ post offices across India
- 36 states & UTs, 700+ districts
- GPS coordinates (where available)
- REST API endpoints (no auth required):
  - `/states.json` - All states
  - `/states/{slug}.json` - State details
  - `/districts/{state}/{district}.json` - District offices
  - `/pincodes/{pincode}.json` - Pincode lookup

**Data Quality:**
- ✅ Clean JSON structure
- ✅ Proper null handling for missing GPS
- ✅ State/district slugs (normalized)
- ✅ Office types (HO, SO, BO)
- ✅ Delivery status flag
- ✅ Circle, Region, Division metadata

**Evaluation**: ⭐ **HIGHLY RECOMMENDED** - Clean, well-structured, actively maintained

---

### 5. devzoy/indian-pincode (NPM/Python package)
- **NPM**: https://www.npmjs.com/package/indian-pincode
- **GitHub**: https://github.com/devzoy/indian-pincode
- **Source**: Processed from official India Post records
- **Package Size**: ~40MB (Node.js), ~10MB (Python)
- **Records**: 19,000+ pincodes, 154,000+ post offices

**What it provides:**
- Embedded database (offline-capable)
- Geospatial data included
- No external API dependency
- Optimized indexing

**Evaluation**: ⚠️ Good for embedded use cases, but large package size

---

## Sources to Investigate Further

### Official Sources
- [ ] data.gov.in Web Service API (requires API key registration)
- [ ] dataful.in dataset (173,468 records with lat/long)
- [ ] India Post official website data dumps

### Community Sources
- [ ] Other Kaggle datasets
- [ ] OpenStreetMap India extracts (for validation)

### Commercial Sources
- [ ] Google Places API (for validation)
- [ ] MapMyIndia datasets

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-24 | Rejected Kaggle Pincode_Dataset.csv | Truncated names, mixed data, fewer records |
| TBD | | |

---

## Next Steps

1. Identify 3-5 additional data sources
2. Evaluate each against criteria above
3. Compare overlapping pincodes for accuracy
4. Make final decision on primary + backup sources
5. Document migration/sync strategy
