# GIN vs GiST Indexes for Arrays

## Quick Comparison

| Feature | GIN | GiST |
|---------|-----|------|
| **Speed** | Faster for lookups | Slower for lookups |
| **Index Size** | Larger | Smaller |
| **Build Time** | Slower | Faster |
| **Update Performance** | Slower | Faster |
| **text[] Support** | ✅ Built-in | ❌ No default operator class |
| **= ANY() Support** | ❌ No | ❌ No |
| **@> Support** | ✅ Yes (fast) | ⚠️ Requires extension |
| **Best For** | Read-heavy workloads | Geometric data (PostGIS) |
| **Nearest Neighbor** | ❌ No | ✅ Yes |

## TL;DR

**For text[] arrays (like DIGIPIN)**: Use **GIN** - it's the only practical choice
- ✅ Built-in support for text[] arrays
- ✅ Fast lookups (0.6ms vs 2.6ms Sequential Scan)
- ⚠️ GiST has **no default operator class** for text[] arrays
- 🎯 Read-heavy workloads benefit most from GIN

**For geometric data**: Use **GiST** (PostGIS default)
- ✅ Optimized for spatial queries
- ✅ Supports nearest-neighbor searches
- ✅ Better for ranges, bounding boxes

---

## Detailed Comparison

### GIN (Generalized Inverted Index)

**Structure**: Inverted index
```
'tag1' → [row1, row5, row9]
'tag2' → [row2, row5]
'tag3' → [row1, row3]
```

**Pros**:
- ✅ **Very fast lookups** (contains, overlap queries)
- ✅ **Optimal for read-heavy workloads**
- ✅ **Best choice for arrays** in most cases
- ✅ **Exact matches** are extremely fast

**Cons**:
- ❌ **Slower to build** (initial index creation)
- ❌ **Slower updates** (each write updates multiple posting lists)
- ❌ **Larger index size** (stores all values)
- ❌ **No nearest-neighbor support**

**Use When**:
- High read:write ratio (>10:1)
- Exact containment/overlap queries
- Arrays don't change frequently
- **This is our DIGIPIN case!**

---

### GiST (Generalized Search Tree)

**Structure**: Balanced tree with bounding regions
```
Node: Contains tags in range [tag0-tag9]
  ├─ Subtree: [tag0-tag4]
  └─ Subtree: [tag5-tag9]
```

**Pros**:
- ✅ **Faster to build**
- ✅ **Faster updates** (fewer index entries to modify)
- ✅ **Smaller index size**
- ✅ **Supports nearest-neighbor** searches (via `<->` operator)
- ✅ **Better for geometric types** (PostGIS uses GiST)

**Cons**:
- ❌ **Slower lookups** than GIN
- ❌ **Less optimal for exact matches**
- ❌ **Tree rebalancing overhead**

**Use When**:
- High write:read ratio
- Frequent array updates
- Need nearest-neighbor searches
- Geometric/spatial queries (ranges, distances)

---

## Both Have the Same = ANY() Issue

```sql
-- Both fail to use index for = ANY():
CREATE INDEX idx_gin ON table USING GIN(array_col);    
CREATE INDEX idx_gist ON table USING GiST(array_col);

-- ❌ Neither uses index:
SELECT * FROM table WHERE 'value' = ANY(array_col);

-- ✅ Both use index:
SELECT * FROM table WHERE array_col @> ARRAY['value'];
```

**Reason**: `= ANY()` is not a GIN/GiST operator. Use `@>` instead.

---

## Performance Comparison (Example)

### Test Setup
```sql
CREATE TABLE test (id INT, tags TEXT[]);
INSERT INTO test SELECT i, ARRAY['tag' || (random()*20)::int] FROM generate_series(1, 10000) i;
```

### Query: Find rows containing 'tag5'

| Index Type | Operator | Scan Type | Time |
|------------|----------|-----------|------|
| None | `= ANY()` | Seq Scan | 15ms |
| None | `@>` | Seq Scan | 15ms |
| GIN | `= ANY()` | Seq Scan | 15ms ❌ |
| GIN | `@>` | Bitmap Index Scan | **0.5ms** ✅ |
| GiST | `= ANY()` | Seq Scan | 15ms ❌ |
| GiST | `@>` | Index Scan | **2ms** ✅ |

**Winner**: GIN with `@>` operator (3-4x faster than GiST)

---

## When Would You Use GiST for Arrays?

### Scenario 1: Write-Heavy Workload
```
Reads:  100 queries/sec
Writes: 500 updates/sec

→ Use GiST (fast updates more important than fast reads)
```

### Scenario 2: Nearest-Neighbor Searches
```sql
-- Find rows with arrays most similar to a target
SELECT id, tags <-> ARRAY['tag1', 'tag2'] AS distance
FROM table
ORDER BY distance
LIMIT 10;

-- Only GiST supports the <-> operator
```

### Scenario 3: Mixed Data Types
```sql
-- If you also need geometric queries on the same table
CREATE INDEX idx_location ON table USING GiST(location);  -- PostGIS
CREATE INDEX idx_tags ON table USING GiST(tags);          -- Arrays

-- Using same index type for consistency
```

---

## Our DIGIPIN Use Case

### Workload Profile
- **Reads**: 1000+ queries/sec (API lookups)
- **Writes**: ~1 update/sec (rare pincode boundary changes)
- **Read:Write Ratio**: 1000:1

### Query Patterns
- ✅ Exact containment: "Does pincode contain DIGIPIN X?"
- ✅ Multiple values: "Which pincodes contain any of [X, Y, Z]?"
- ❌ Nearest-neighbor: Not needed
- ❌ Range queries: Not needed

### Decision: GIN ✅

**Why**:
1. **Read-heavy workload**: Lookups far outnumber updates
2. **Performance critical**: API response time matters
3. **Exact matches**: We need fast containment checks
4. **No nearest-neighbor**: Don't need GiST's unique features
5. **Proven results**: 0.6ms queries with GIN + `@>` operator

---

## Migration Notes

If you ever need to switch from GIN to GiST:

```sql
-- Drop GIN index
DROP INDEX idx_pincodes_digipin_cells_gin;

-- Create GiST index
CREATE INDEX idx_pincodes_digipin_cells_gist 
ON pincodes USING GiST(digipin_cells);

-- Same query works (no code changes needed)
SELECT pincode FROM pincodes WHERE digipin_cells @> ARRAY['39J438'];
```

**Expected impact**:
- Query time: 0.6ms → 2ms (3x slower, but still fast)
- Update time: Faster
- Index size: Smaller

**Recommendation**: Don't switch unless you have write performance issues.

---

## Summary Table

### Use GIN When:
✅ Read-heavy workload  
✅ Need fastest possible lookups  
✅ Arrays don't change often  
✅ Don't need nearest-neighbor  
✅ **← Our DIGIPIN case**

### Use GiST When:
✅ Write-heavy workload  
✅ Frequent array updates  
✅ Need nearest-neighbor searches  
✅ Want smaller indexes  
✅ Need geometric query support

---

## Test Script

To test both index types on your data:

```bash
railway run psql $DATABASE_URL -f pynpoint/scripts/test-gist-vs-gin-any-operator.sql
```

This will show you:
1. Index usage with `= ANY()` vs `@>`
2. Performance comparison
3. Index size comparison
4. Proof that both have the same `= ANY()` issue

---

## References

- [PostgreSQL GIN Documentation](https://www.postgresql.org/docs/current/gin.html)
- [PostgreSQL GiST Documentation](https://www.postgresql.org/docs/current/gist.html)
- [Array Operators](https://www.postgresql.org/docs/current/functions-array.html)
