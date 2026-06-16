# Spatial Relationship Refactoring - Part 2

## PostGIS Spatial Functions Mapping

### Relationship → PostGIS Function

| Relationship | PostGIS Function | Description |
|-------------|------------------|-------------|
| contains | ST_Contains(A, B) | A completely contains B |
| contained_by | ST_Within(A, B) | A is completely within B |
| intersects | ST_Intersects(A, B) | A and B share any space (default) |
| overlaps | ST_Overlaps(A, B) | A and B partially overlap (excluding contains/within) |

### Implementation Examples

#### 1. Pincode → H3 (Contains)
Find all H3 cells COMPLETELY INSIDE pincode

```sql
SELECT h3_index
FROM h3_cells
WHERE ST_Contains(
  (SELECT boundary::geometry FROM pincodes WHERE pincode = '110001'),
  ST_GeomFromGeoJSON(h3_boundary)
)
```

#### 2. H3 → Pincode (Contained By)
Find all pincodes that COMPLETELY CONTAIN this H3 cell

```sql
SELECT pincode, office_name, district, state
FROM pincodes
WHERE ST_Contains(boundary::geometry, ST_GeomFromGeoJSON($1))
  AND is_active = true
```

---

## Implementation Strategy

### Phase 1: Add Query Parameters (No Breaking Changes)

1. Add DTOs with new optional parameters
2. Default behavior: relationship=intersects (current behavior)
3. Keep existing responses but prepare for array migration

### Phase 2: Update Response DTOs to Arrays

1. H3ToDigipinResponse: digipinCode → digipinCodes[]
2. All responses: Add relationship field
3. All responses: Add optional metadata field

### Phase 3: Implement Spatial Query Logic

1. ConversionService methods:
   - Add relationship parameter
   - Route to correct PostGIS function
   - Return filtered results

2. New helper methods:
   - applyRelationshipFilter()
   - computeOverlapPercentage()
   - filterByRelationship()

### Phase 4: Performance Optimization

1. H3 Cell Geometry Caching
   - Pre-compute H3 cell boundaries at common resolutions
   - Store in Redis: h3:geometry:{index} → GeoJSON

2. DIGIPIN Boundary Caching
   - Pre-compute DIGIPIN boundaries at common levels
   - Store in Redis: digipin:geometry:{code} → GeoJSON

3. Spatial Indexing
   - Add GIST index on computed H3/DIGIPIN geometries if needed

---

## Testing Strategy

### Test Matrix

| Source | Target | Relationship | Expected Behavior |
|--------|--------|-------------|-------------------|
| Pincode (large) | H3 res-9 (small) | contains | Returns many H3 cells fully inside |
| Pincode (large) | H3 res-7 (large) | contained_by | Returns 0 or few H3 cells that contain pincode |
| Pincode | H3 res-9 | intersects | Returns all overlapping cells (current) |
| Pincode | H3 res-9 | overlaps | Returns cells that partially overlap (edge) |
| H3 res-9 | Pincode | contains | Returns 0 (H3 too small) |
| H3 res-9 | Pincode | contained_by | Returns pincodes that fully contain H3 |
| H3 res-9 | Pincode | intersects | Returns all overlapping pincodes (current) |

### Test Cases

1. Large pincode + small H3: Expect many contains results
2. Small pincode + large H3: Expect 0-1 contained_by results
3. Edge cases: H3 cell exactly on pincode boundary
4. Performance: Bulk queries with relationship filters
5. DIGIPIN levels: Test all 10 precision levels
6. H3 resolutions: Test resolutions 6-10

---

## All Endpoints to Refactor

### Stack 1: Pincode-Centric (4 endpoints)

1. GET /convert/pincode-to-h3/:pincode
   - Add: ?relationship=contains|contained_by|intersects|overlaps
   - Add: &resolution=0-15
   - Change: h3Indexes (already array) ✅
   - Add: relationship field in response
   - Add: metadata.h3Details[] with overlapPercentage

2. GET /convert/h3-to-pincode/:h3Index
   - Add: ?relationship=contains|contained_by|intersects|overlaps
   - Change: pincodes[] (already array) ✅
   - Add: relationship field in response
   - Add: metadata.pincodeDetails[] with overlapPercentage

3. GET /convert/pincode-to-digipin/:pincode
   - Add: ?relationship=contains|contained_by|intersects|overlaps
   - Add: &level=1-10
   - Change: digipinCodes (already array) ✅
   - Add: relationship field in response
   - Add: metadata.digipinDetails[] with overlapPercentage

4. GET /convert/digipin-to-pincode/:digipinCode
   - Add: ?relationship=contains|contained_by|intersects|overlaps
   - Change: pincodes[] (already array) ✅
   - Add: relationship field in response
   - Add: metadata.pincodeDetails[] with overlapPercentage

### Stack 2: DIGIPIN-H3 Bridge (2 endpoints)

5. GET /convert/h3-to-digipin/:h3Index
   - Add: ?relationship=contains|contained_by|intersects|overlaps
   - Add: &level=1-10
   - Change: digipinCode → digipinCodes[] ❌ BREAKING
   - Add: totalDigipinCells
   - Add: primaryDigipin
   - Add: relationship field
   - Add: metadata.digipinDetails[]

6. GET /convert/digipin-to-h3/:digipinCode
   - Add: ?relationship=contains|contained_by|intersects|overlaps
   - Add: &resolution=0-15
   - Change: h3Indexes (already array) ✅
   - Add: relationship field
   - Add: metadata.h3Details[]

---

## Timeline

1. Day 1-2: Design review, finalize DTOs
2. Day 3-4: Implement query parameters, update DTOs
3. Day 5-6: Implement PostGIS spatial logic
4. Day 7: Testing and optimization
5. Day 8: Documentation and deployment

