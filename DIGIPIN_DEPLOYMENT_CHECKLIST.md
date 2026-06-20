# DIGIPIN Deployment Checklist

## Pre-Deployment

### ✅ Local Testing
- [ ] Run `./pynpoint/scripts/test-digipin-migration.sh`
- [ ] Verify all tests pass
- [ ] Check functions exist
- [ ] Check column exists
- [ ] Check GIN index exists
- [ ] Verify Delhi encodes to `39J438`
- [ ] Verify polygon function works

### ✅ Validation Complete
- [ ] Reviewed validation results:
  - ✅ Algorithm accuracy: 100%
  - ✅ Delhi 110001 cells start with `39J...`
  - ✅ 549/549 cells valid
  - ✅ Performance acceptable (< 4s for large pincodes)
- [ ] Reviewed `POLYGON_OPTIMIZATION.md`
- [ ] Reviewed `DIGIPIN_MIGRATION_GUIDE.md`

### ✅ Migration Files Ready
- [ ] `1781705000000-AddDigipinFunctions.ts` - Core functions
- [ ] `1781706000000-AddDigipinPolygonFunction.ts` - Polygon coverage
- [ ] `1781707000000-AddDigipinCellsColumn.ts` - Storage column + index
- [ ] All files committed to git

---

## Deployment to Railway

### Step 1: Deploy Migrations
```bash
# Commit and push
git add src/database/migrations/178170*.ts
git commit -m "feat: Add DIGIPIN Level 6 support with optimized polygon coverage"
git push
```

**Expected:**
- ✅ Railway auto-deploys
- ✅ Migrations run automatically (RUN_MIGRATIONS=true)
- ✅ Functions created
- ✅ Column created (empty)
- ✅ App starts successfully
- ⏱️ Total time: ~2-3 minutes

**Verify:**
```bash
# Check migration status
railway run npm run migration:show

# Should show:
# [X] AddDigipinFunctions1781705000000
# [X] AddDigipinPolygonFunction1781706000000  
# [X] AddDigipinCellsColumn1781707000000
```

### Step 2: Verify Functions
```bash
# Test encode function
railway run psql $DATABASE_URL -c "SELECT encode_digipin_level6(28.6139, 77.209)"
# Expected: 39J438

# Check column exists
railway run psql $DATABASE_URL -c "
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'pincodes' AND column_name = 'digipin_cells'
"
# Expected: digipin_cells | ARRAY
```

### Step 3: Populate Cells (Manual - Run Separately)
```bash
# Option A: Railway shell
railway run psql $DATABASE_URL -f pynpoint/scripts/populate-digipin-cells.sql

# Option B: Direct connection (get URL from Railway dashboard)
psql <railway-database-url> -f pynpoint/scripts/populate-digipin-cells.sql
```

**Expected:**
- ⏱️ Duration: 2-4 hours
- 📊 Progress shown every 10 batches
- ✅ Resumable if interrupted
- ✅ Final stats displayed

**Monitor Progress:**
- Watch console output
- Batches of 100 pincodes
- Shows cells generated
- Shows average cells/pincode

---

## Post-Deployment Verification

### ✅ Check Population Status
```sql
-- Run in Railway psql
SELECT 
  COUNT(*) AS total_pincodes,
  COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') AS populated,
  SUM(cardinality(digipin_cells)) AS total_cells,
  ROUND(AVG(cardinality(digipin_cells))::numeric, 2) AS avg_cells
FROM pincodes;
```

**Expected:**
- Total pincodes: 19,312
- Populated: ~19,300+ (excluding 0-area pincodes)
- Total cells: ~80-90M
- Avg cells: ~4,000-5,000

### ✅ Test Reverse Lookup (GIN Index)
```sql
-- Find pincode containing specific DIGIPIN cell
SELECT pincode, office_name, cardinality(digipin_cells) as total_cells
FROM pincodes
WHERE '39J438' = ANY(digipin_cells);
```

**Expected:**
- Should return Delhi pincodes (e.g., 110001)
- Query time: < 10ms

### ✅ Sample Queries
```sql
-- Get cells for specific pincode
SELECT 
  pincode,
  office_name,
  cardinality(digipin_cells) as cell_count,
  digipin_cells[1:5] as sample_cells
FROM pincodes
WHERE pincode = '110001';

-- Expected: 26 cells, samples like {39J422, 39J423, 39J427, ...}
```

---

## Rollback Plan (If Needed)

If something goes wrong:

```bash
# Connect to Railway
railway link

# Revert migrations (in reverse order)
railway run npm run migration:revert  # Revert column
railway run npm run migration:revert  # Revert polygon function
railway run npm run migration:revert  # Revert core functions

# Redeploy
git revert HEAD
git push
```

**Impact of rollback:**
- ✅ Functions removed
- ✅ Column removed
- ✅ No data loss (column was just added)
- ✅ App continues working normally

---

## Success Criteria

### ✅ Migration Phase
- [x] All 3 migrations run successfully
- [x] Functions exist in database
- [x] Column exists with GIN index
- [x] No errors in Railway logs
- [x] App starts and responds to health checks

### ✅ Population Phase
- [ ] All pincodes processed (19,312)
- [ ] ~80-90M cells generated
- [ ] No timeout errors
- [ ] Statistics look reasonable

### ✅ Functional Tests
- [ ] Delhi encodes to `39J438`
- [ ] Reverse lookup works (< 10ms)
- [ ] Sample pincodes have expected cell counts
- [ ] GIN index being used (check EXPLAIN plans)

---

## Performance Benchmarks

### Expected Performance:
| Operation | Target | Measured |
|-----------|--------|----------|
| Point encoding | < 1ms | ✅ |
| Polygon (small, 1 km²) | < 1s | ✅ |
| Polygon (medium, 10 km²) | < 2s | ✅ 1s |
| Polygon (large, 200 km²) | < 30s | ✅ 3.5s |
| Reverse lookup (GIN) | < 10ms | ⏳ TBD |

---

## Next Steps After Deployment

1. **Update Pincode Entity**
   - Add `digipin_cells` field to entity
   - Add to TypeORM repository

2. **Implement DIGIPIN Service**
   - Create service for DIGIPIN operations
   - Add methods for encoding, reverse lookup

3. **Add API Endpoints**
   - GET `/digipin/encode?lat=X&lng=Y`
   - GET `/digipin/decode/:code`
   - GET `/digipin/nearby/:code`

4. **Add to Redis (Optional)**
   - Cache DIGIPIN → Pincode mappings
   - Improve reverse lookup performance

5. **Documentation**
   - Update API docs
   - Add DIGIPIN examples
   - Update README

---

## Contact / Support

If issues arise:
1. Check Railway logs
2. Review this checklist
3. Check `DIGIPIN_MIGRATION_GUIDE.md`
4. Verify database connectivity

---

## Sign-off

- [ ] Local tests passed
- [ ] Migrations deployed to Railway
- [ ] Functions verified
- [ ] Cells populated
- [ ] Performance acceptable
- [ ] Documentation updated

**Deployed by:** _________________  
**Date:** _________________  
**Production URL:** _________________
