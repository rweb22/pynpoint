# DIGIPIN Testing Checklist

## Pre-Testing Verification

- [ ] Population complete: 99.88% (19,288/19,312)
- [ ] GIN index exists: `idx_pincodes_digipin_cells_gin`
- [ ] Statistics updated: `ANALYZE pincodes;`
- [ ] API server running

---

## Phase 1: Database Tests

### Quick Validation ✅
```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/quick-validation-tests.sql
```

- [ ] Delhi test: 110001 contains `39J438`
- [ ] Reverse lookup: `39J438` returns 110001
- [ ] Round-trip: 5/5 pincodes pass
- [ ] Centroid: All in cells array
- [ ] Format: All cells 6 chars, valid charset

### Internal Consistency ✅
```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/test-api-internal-consistency.sql
```

- [ ] Round-trip consistency: 100%
- [ ] Boundary cells identified
- [ ] Unique cells validated
- [ ] Cell format: All Level 6

### External Validation ✅
```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/test-api-external-validation.sql
```

- [ ] Delhi coordinates: (28.6139, 77.2090) → `39J438`
- [ ] Centroid encoding: >95% match
- [ ] Regional prefixes: Consistent
- [ ] Known coordinates: All validated

---

## Phase 2: API Endpoint Tests

### Setup
```bash
chmod +x pynpoint/scripts/test-api-endpoints.sh
```

### Local Testing ✅
```bash
npm run start:dev
./pynpoint/scripts/test-api-endpoints.sh
```

- [ ] **Test 1**: Pincode → DIGIPIN (110001)
  - HTTP 200
  - Contains `39J438`
  - Level 6
  - Response time <50ms

- [ ] **Test 2**: DIGIPIN → Pincode (39J438)
  - HTTP 200
  - Returns 110001
  - Response time <20ms

- [ ] **Test 3**: Level 8 truncation (39J438FC)
  - HTTP 200
  - Truncated to `39J438`
  - Same result as Test 2

- [ ] **Test 4**: Level 10 truncation (39J438FC7M)
  - HTTP 200
  - Truncated to `39J438`

- [ ] **Test 5**: Level 4 rejection (39J4)
  - HTTP 400
  - Clear error message

- [ ] **Test 6**: Other cities
  - Mumbai (400001): HTTP 200
  - Chennai (600001): HTTP 200
  - Bangalore (560001): HTTP 200

- [ ] **Test 7**: Invalid pincode (999999)
  - HTTP 404
  - Not found message

---

## Performance Verification

### Database Performance ✅
```sql
EXPLAIN ANALYZE
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'];
```

- [ ] Uses Bitmap Index Scan
- [ ] NOT using Sequential Scan
- [ ] Execution time <2ms
- [ ] Index: `idx_pincodes_digipin_cells_gin`

### API Performance ✅
- [ ] Pincode → DIGIPIN: <50ms
- [ ] DIGIPIN → Pincode: <20ms
- [ ] No timeouts
- [ ] Consistent response times

---

## Edge Cases

- [ ] Boundary cells (multiple pincodes): Valid
- [ ] Multiple regional prefixes: Expected for large states
- [ ] Empty cells (24 pincodes): Geometry issues (acceptable)
- [ ] Centroid on boundary: Within 200m tolerance

---

## Production Readiness

- [ ] All database tests pass
- [ ] All API tests pass
- [ ] Performance benchmarks met
- [ ] Error handling works
- [ ] Documentation complete
- [ ] No critical issues

---

## Sign-Off

**Database Tests**: ☐ Pass ☐ Fail  
**API Tests**: ☐ Pass ☐ Fail  
**Performance**: ☐ Pass ☐ Fail  
**Overall**: ☐ Ready for Production ☐ Needs Work

**Tested by**: ________________  
**Date**: ________________  
**Notes**: 

---

## Next Steps After Sign-Off

✅ **All Pass** → Deploy to production  
⚠️ **Partial Pass** → Fix issues and retest  
❌ **Fail** → Review implementation

---

## Quick Commands Reference

```bash
# Database quick test
railway run psql $DATABASE_URL -f pynpoint/scripts/quick-validation-tests.sql

# API test
./pynpoint/scripts/test-api-endpoints.sh

# Check index usage
railway run psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'];"

# Population status
railway run psql $DATABASE_URL -c "SELECT COUNT(*) FILTER (WHERE digipin_cells != '{}') as populated, COUNT(*) as total FROM pincodes WHERE boundary IS NOT NULL;"
```
