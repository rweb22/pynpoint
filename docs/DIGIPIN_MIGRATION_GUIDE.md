# DIGIPIN Migration Guide

## Overview

This guide covers the safe deployment of DIGIPIN Level 6 functionality to production.

**What is DIGIPIN?**
- Official India Post spatial coding system
- 6-character alphanumeric codes (e.g., `39J438`)
- ~200m × 200m grid resolution
- Complements H3 hexagons with India-specific standard

---

## Migration Strategy

We use a **3-phase approach** to avoid Railway timeout issues:

### Phase 1: Create Functions (Fast - ~1 second)
- ✅ Creates PL/pgSQL functions
- ✅ Safe to run multiple times
- ✅ No data modification

### Phase 2: Add Column (Fast - ~1 second)
- ✅ Adds `digipin_cells text[]` column
- ✅ Creates GIN index
- ✅ Column starts empty

### Phase 3: Populate Data (Slow - 2-4 hours)
- ⏳ Runs separately after deployment
- ⏳ Processes 19,312 pincodes in batches
- ⏳ ~82M cells total

---

## Step-by-Step Deployment

### Step 1: Local Testing

```bash
# Build the project
npm run build

# Run migrations locally
npm run migration:run

# Verify functions exist
psql $DATABASE_URL -c "SELECT encode_digipin_level6(28.6139, 77.209)"
# Expected: 39J438

# Test on sample pincode
psql $DATABASE_URL -c "
  SELECT 
    pincode,
    cardinality(polygon_to_digipin_cells_level6(boundary, 200.0)) as cells
  FROM pincodes 
  WHERE pincode = '110001'
"
# Expected: 26 cells
```

### Step 2: Deploy to Railway

```bash
# Commit migrations
git add src/database/migrations/178170*.ts
git commit -m "Add DIGIPIN migrations"
git push

# Railway will:
# 1. Build project
# 2. Run migrations automatically (if RUN_MIGRATIONS=true)
# 3. Start app
# 4. Functions + column created ✅
# 5. digipin_cells column is empty (OK!)
```

**Expected deployment time:** ~2-3 minutes (normal deployment)

### Step 3: Populate Cells (Manual)

**Option A: Railway Shell (Recommended)**

```bash
# Connect to Railway
railway link

# Run population script
railway run psql $DATABASE_URL -f pynpoint/scripts/populate-digipin-cells.sql
```

**Option B: Direct psql**

```bash
# Use DATABASE_URL from Railway dashboard
psql <railway-database-url> -f pynpoint/scripts/populate-digipin-cells.sql
```

**Expected time:** 2-4 hours
- Processes in batches of 100
- Shows progress every 10 batches
- Resumable (skips already-processed pincodes)

---

## Migration Files

### 1. `1781705000000-AddDigipinFunctions.ts`
Creates core DIGIPIN functions:
- `digipin_calc_indices(lat, lng)` - Grid index calculation
- `digipin_grid_char(idx)` - Character lookup
- `encode_digipin_level6(lat, lng)` - Point encoding

### 2. `1781706000000-AddDigipinPolygonFunction.ts`
Creates polygon coverage function:
- `polygon_to_digipin_cells_level6(geom, spacing)` - Array of cells
- Handles both GEOGRAPHY and GEOMETRY types
- Optimized for large polygons

### 3. `1781707000000-AddDigipinCellsColumn.ts`
Adds storage column:
- `digipin_cells text[]` column
- GIN index for reverse lookups
- Starts empty

---

## Verification

### Check Migration Status
```bash
npm run migration:show
```

Expected output:
```
[X] AddDigipinFunctions1781705000000
[X] AddDigipinPolygonFunction1781706000000
[X] AddDigipinCellsColumn1781707000000
```

### Check Functions Exist
```sql
SELECT 
  proname,
  pronargs
FROM pg_proc 
WHERE proname LIKE 'digipin%' OR proname LIKE '%digipin%'
ORDER BY proname;
```

Expected:
- `digipin_calc_indices` (2 args)
- `digipin_grid_char` (1 arg)
- `encode_digipin_level6` (2 args)
- `polygon_to_digipin_cells_level6` (2 args) - 2 overloads

### Check Column Exists
```sql
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'pincodes' AND column_name = 'digipin_cells';
```

Expected:
- `digipin_cells` | `ARRAY` | `YES`

### Check Index Exists
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pincodes' AND indexname LIKE '%digipin%';
```

Expected:
- `idx_pincodes_digipin_cells_gin` using GIN

---

## Rollback Plan

If something goes wrong:

```bash
# Revert last migration
npm run migration:revert

# Or revert all DIGIPIN migrations
npm run migration:revert  # Revert column
npm run migration:revert  # Revert polygon function
npm run migration:revert  # Revert core functions
```

**Note:** Rollback is safe - no data loss (column data is deleted)

---

## Performance Expectations

### Migration Phase (Phases 1-2)
- **Time:** < 5 seconds
- **Downtime:** None (runs during deployment)
- **Impact:** None (just schema changes)

### Population Phase (Phase 3)
- **Time:** 2-4 hours
- **Downtime:** None (app continues running)
- **Impact:** Temporary DB load increase
- **Progress:** Visible in console output

### Post-Population
- **Column size:** ~100-200 MB
- **Index size:** ~50-100 MB
- **Query performance:** < 10ms for reverse lookups

---

## Troubleshooting

### "Function already exists"
✅ This is OK! Migrations use `CREATE OR REPLACE`

### "Column already exists"
✅ This is OK! We use `ADD COLUMN IF NOT EXISTS`

### "Migration timeout"
❌ This shouldn't happen (Phases 1-2 are fast)
- Check Railway logs
- Verify database connectivity

### "Population script timeout"
⏳ Expected for large datasets
- Script is resumable
- Re-run to continue from where it stopped

---

## Next Steps

After successful population:

1. **Update Pincode entity** to include `digipin_cells` field
2. **Implement DIGIPIN service** for queries
3. **Add API endpoints** for DIGIPIN lookups
4. **Add to Redis** for caching (optional)

---

## Support

If you encounter issues:
1. Check this guide
2. Review migration logs
3. Verify database connectivity
4. Check Railway dashboard for errors
