# H3 Index Migration: Buffer → PostGIS

## Overview

This document guides the migration from buffer-based H3 index generation to 100% accurate PostGIS-based approach.

**Goal:** Improve H3-Pincode index accuracy from ~80-85% to 100% by using PostGIS spatial intersection instead of buffer approximation.

**Impact:**
- ✅ 100% accurate spatial intersection
- ✅ No false positives at boundaries
- ✅ Consistent with query-time behavior
- ⏱️ Index build time: 5-10 minutes (one-time)
- 💾 Redis usage: Similar (~2GB, ~32M keys)

---

## Current State (Buffer Approach)

### Algorithm
```typescript
1. Buffer pincode boundary by edge length (~174m)
2. Apply h3.polygonToCells() to buffered polygon
3. Store in Redis: h3:{cell} → SET {pincodes}
```

### Problems
- **Over-inclusion**: Cells 80% outside pincode still get tagged
- **Inconsistent**: Index uses buffered, queries use actual boundaries
- **MultiPolygon issues**: Buffer can create invalid geometries
- **Arbitrary parameter**: Edge length buffer doesn't match cell geometry

---

## New Approach (PostGIS)

### Algorithm
```typescript
1. Get pincode boundary from PostgreSQL
2. Generate candidate H3 cells (bounding box)
3. Use PostGIS ST_Intersects to validate actual overlap
4. Store in Redis: h3:{cell} → SET {pincodes}
```

### Benefits
- ✅ 100% accurate spatial intersection
- ✅ Handles all geometry types correctly
- ✅ Consistent with query behavior
- ✅ No arbitrary parameters

---

## Prerequisites

### Required
- PostgreSQL 12+ with PostGIS 3.0+
- Redis with persistent storage
- ~10 minutes for index rebuild
- Railway CLI or direct database access

### Check Current Setup
```bash
# On Railway or with DATABASE_URL set:
./scripts/check-database-capabilities.sh

# Check Redis status:
./scripts/check-redis-h3-index.sh
```

---

## Migration Steps

### Phase 0: Pre-Migration Assessment

1. **Document current state**
   ```bash
   # Save current statistics
   ./scripts/check-redis-h3-index.sh > redis-before.txt
   ./scripts/check-database-capabilities.sh > db-before.txt
   ```

2. **Backup data**
   ```bash
   # Backup PostgreSQL (if not already backed up by Railway)
   # Backup Redis RDB file from Railway persistent volume
   ```

3. **Verify PostGIS & H3**
   - Check if PostGIS is installed
   - Check if h3 extension is available
   - Identify implementation approach based on availability

### Phase 1: Clear Old Redis Index

1. **Create backup script** (if needed for rollback)
   ```typescript
   // Export sample of current index for comparison
   ```

2. **Delete H3 keys**
   ```bash
   # This will be done via NestJS script (safer than redis-cli)
   npm run script:clear-h3-index
   ```

3. **Verify clean state**
   - Memory usage should drop to minimal
   - Key count should be near zero

### Phase 2: Choose Implementation Approach

#### Option A: Native H3 Extension (Best)
If `h3` and `h3_postgis` extensions are available:
```sql
CREATE EXTENSION IF NOT EXISTS h3;
CREATE EXTENSION IF NOT EXISTS h3_postgis;
```

#### Option B: Pure PostGIS (Fallback)
If H3 extension not available:
- Generate H3 cells in JavaScript (existing h3-js library)
- Validate intersection using PostGIS ST_Intersects
- Slower but still accurate

### Phase 3: Update Index Generation Code

Implementation determined by Phase 2 outcome.

See `src/initialization/h3-index-postgis.service.ts` (to be created)

### Phase 4: Testing

1. **Test on sample dataset**
   ```bash
   # Test with 100 pincodes first
   npm run script:test-postgis-index
   ```

2. **Compare accuracy**
   - Old index: ~125 cells per pincode (buffered)
   - New index: ~100 cells per pincode (accurate)
   - Expected: 15-20% reduction in cell count

3. **Verify queries still work**
   ```bash
   npm run test:track4
   ```

### Phase 5: Production Deployment

1. **Deploy code**
   ```bash
   git push origin main
   # Railway auto-deploys
   ```

2. **Rebuild index**
   ```bash
   # Trigger via API or initialization service
   curl -X POST https://api.pinpoint.co.in/admin/rebuild-h3-index \
     -H "Authorization: Bearer $ADMIN_API_KEY"
   ```

3. **Monitor**
   - Watch logs for progress
   - Verify completion
   - Check Redis memory usage

### Phase 6: Validation

1. **Test endpoints**
   ```bash
   ./scripts/test-track4-endpoints.sh ppk_live_sk_9126d370214ccc5afe102ceb_5
   ```

2. **Compare results**
   - Old: May include cells outside pincode
   - New: Only cells that actually overlap

---

## Rollback Plan

If migration fails:

1. **Restore Redis from backup**
   ```bash
   # Copy backup RDB file to Redis persistent volume
   # Restart Redis
   ```

2. **Revert code**
   ```bash
   git revert HEAD
   git push origin main
   ```

3. **Use feature flag**
   ```bash
   # Set H3_INDEX_METHOD=buffer in Railway env vars
   # Restart service
   ```

---

## Implementation Status

- [x] Phase 0: Assessment scripts created
- [ ] Phase 0: Current state documented
- [ ] Phase 1: Redis cleared
- [ ] Phase 2: Implementation approach chosen
- [ ] Phase 3: PostGIS service implemented
- [ ] Phase 4: Testing complete
- [ ] Phase 5: Production deployed
- [ ] Phase 6: Validated

---

## Files Modified

### New Files
- `scripts/check-database-capabilities.sh`
- `scripts/check-redis-h3-index.sh`
- `scripts/clear-h3-index.ts`
- `src/initialization/h3-index-postgis.service.ts`
- `MIGRATION_H3_POSTGIS.md`

### Modified Files
- `src/initialization/initialization.service.ts` (feature flag)
- `src/initialization/initialization.module.ts` (conditional provider)

---

## Next Steps

Run assessment scripts to determine implementation approach:

```bash
# 1. Check PostgreSQL capabilities
./scripts/check-database-capabilities.sh

# 2. Check Redis status
./scripts/check-redis-h3-index.sh

# 3. Based on results, proceed with appropriate implementation
```

---

## Questions?

Contact: Development team
Date: 2026-06-17
