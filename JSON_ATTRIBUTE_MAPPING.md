# Official JSON Attribute Mapping

## Source Data Structure

**File:** `official-pincode-data.json` (57MB, 165,627 records)  
**Source:** data.gov.in "All India Pincode Directory" (May 2025)  
**Download:** `https://drive.google.com/uc?export=download&id=1n2gZPURDVlnBfQk3rm8h7V6vNQiqyGi-`

### Available Attributes (11 fields per record)

```json
{
  "circlename": "Telangana Circle",
  "regionname": "Hyderabad Region",
  "divisionname": "Adilabad Division",
  "officename": "Kothimir B.O",
  "pincode": "504273",
  "officetype": "BO",
  "delivery": "Delivery",
  "district": "KUMURAM BHEEM ASIFABAD",
  "statename": "TELANGANA",
  "latitude": "19.3638689",
  "longitude": "79.5376658"
}
```

---

## Mapping to Database Tables

### 1. `pincodes` Table (19,586 unique pincodes)

**Source:** Aggregated from all postoffice records (canonical selection: HO > SO > BO)

| DB Column | JSON Attribute | Transformation | Example |
|-----------|---------------|----------------|---------|
| `pincode` | `pincode` | Trim, substring(0,6) | `"504273"` |
| `state` | `statename` | Normalize (lowercase, trim), substring(0,100) | `"telangana"` |
| `district` | `district` | Normalize (lowercase, trim), substring(0,100) | `"kumuram bheem asifabad"` |
| `city` | ❌ N/A | Set to `NULL` | `null` |
| `office_name` | `officename` | Trim, substring(0,200) - from canonical office | `"Kothimir B.O"` |
| `boundary` | ❌ N/A | Set to `NULL` (filled in Phase 3 from GeoJSON) | `null` |
| `centroid` | ❌ N/A | Set to `NULL` (filled in Phase 3 from GeoJSON) | `null` |
| `is_active` | ❌ N/A | Default `TRUE` | `true` |

**Notes:**
- City/area not available in official JSON (unlike the old BharatPin CSV)
- Canonical office selected by priority: HO > SO/PO > BO
- State/district normalized to lowercase for consistency

---

### 2. `postoffices` Table (165,627 records - ALL offices)

| DB Column | JSON Attribute | Transformation | Example |
|-----------|---------------|----------------|---------|
| `pincode` | `pincode` | Trim, substring(0,6) | `"504273"` |
| `officename` | `officename` | Trim, substring(0,200) | `"Kothimir B.O"` |
| `officetype` | `officetype` | **Map `PO` → `SO`**, uppercase, trim | `"BO"` |
| `delivery` | `delivery` | Normalize (lowercase, trim), substring(0,20) | `"delivery"` |
| `area` | ❌ N/A | Set to `NULL` | `null` |
| `district` | `district` | Normalize (lowercase, trim), substring(0,100) | `"kumuram bheem asifabad"` |
| `state` | `statename` | Normalize (lowercase, trim), substring(0,100) | `"telangana"` |
| `division` | `divisionname` | Trim, substring(0,100) | `"Adilabad Division"` |
| `region` | `regionname` | Trim, substring(0,100) | `"Hyderabad Region"` |
| `circle` | `circlename` | Trim, substring(0,100) | `"Telangana Circle"` |
| `latitude` | `latitude` | Parse float, round to 7 decimals, validate, handle `"NA"` | `19.3638689` |
| `longitude` | `longitude` | Parse float, round to 7 decimals, validate, handle `"NA"` | `79.5376658` |

**Notes:**
- **Office Type Mapping:** `PO` → `SO` (data.gov.in uses "PO" where we use "SO")
- **GPS Validation:** Coordinates rounded to 7 decimal places (DECIMAL(10,7)), invalid/missing set to NULL
- **Postal Hierarchy:** Division/Region/Circle preserved for reference (not used in main logic)

---

## Data Transformations

### 1. Normalize Text
```typescript
private normalize(value: string | null | undefined): string | null {
  if (!value || value.trim() === '') return null;
  return value.trim().toLowerCase();
}
```

**Applied to:**
- `state`, `district`, `delivery` (lowercase for search consistency)

**NOT applied to:**
- `officename`, `division`, `region`, `circle` (preserve original case)
- `officetype` (uppercase: HO, SO, BO)

### 2. Office Type Mapping
```typescript
officetype: record.officetype?.trim().toUpperCase() === 'PO' ? 'SO' : record.officetype?.trim().toUpperCase()
```

**Reason:** Official data uses "PO" (Post Office) where our schema uses "SO" (Sub Office)

### 3. Coordinate Parsing
```typescript
private parseCoordinate(coord: string | null | undefined): number | null {
  if (!coord || coord.trim() === '' || coord === 'NA') return null;
  const parsed = parseFloat(coord);
  if (isNaN(parsed)) return null;
  const rounded = Math.round(parsed * 10000000) / 10000000; // 7 decimals
  if (Math.abs(rounded) > 999) return null; // Validate DECIMAL(10,7) range
  return rounded;
}
```

**Handles:**
- Missing values: `""`, `null`, `undefined`, `"NA"` → `NULL`
- Invalid floats → `NULL`
- Rounding to 7 decimal places (~11mm precision)
- Range validation for DECIMAL(10,7) column type

### 4. Canonical Pincode Selection

For each unique pincode, select the "canonical" office for the pincodes table:

**Priority:**
1. **HO** (Head Office) - highest priority
2. **SO/PO** (Sub Office / Post Office) - medium priority
3. **BO** (Branch Office) - lowest priority

```typescript
const priority = { HO: 1, SO: 2, PO: 2, BO: 3 };
```

This ensures each pincode in the `pincodes` table has the most authoritative state/district/office_name.

---

## Missing Attributes (compared to old BharatPin CSV)

| Attribute | Status | Workaround |
|-----------|--------|------------|
| `area` / `city` | ❌ Not in official JSON | Set to NULL, can be enriched later |
| Boundary polygon | ❌ Not in official JSON | Phase 3: Enrich from GeoJSON file |
| Centroid point | ❌ Not in official JSON | Phase 3: Calculate from GeoJSON boundary |

---

## Data Quality

| Aspect | Count | Percentage | Handling |
|--------|-------|-----------|----------|
| Total records | 165,627 | 100% | Process all |
| Unique pincodes | 19,586 | - | Aggregate to pincodes table |
| Missing GPS | 12,007 | 7.25% | Store as NULL |
| 'NA' state/district | 715 | 0.43% | Keep as-is, can filter later |
| Office type 'PO' | ~155,000 | 94% | Map to 'SO' |

---

## Summary

**We are using ALL 11 attributes from the official JSON:**

✅ **Core identification:**
- `pincode`, `officename`, `officetype`

✅ **Administrative hierarchy:**
- `statename`, `district`

✅ **Postal hierarchy:**
- `circlename`, `regionname`, `divisionname`

✅ **Service info:**
- `delivery`

✅ **Location:**
- `latitude`, `longitude`

❌ **NOT in JSON (will remain NULL or enriched later):**
- `area` / `city` (not in official data)
- `boundary`, `centroid` (Phase 3: from GeoJSON)
