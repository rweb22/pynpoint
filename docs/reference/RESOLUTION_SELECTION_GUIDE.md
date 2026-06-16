# H3 & DIGIPIN Resolution/Level Selection Guide

## Quick Decision Tree

```
What are you mapping?
│
├─ Country/Multi-State Area (>10,000 km²)
│  └─ Use: H3 Res 2-4 | DIGIPIN Level 1-2
│
├─ State/Large City (1,000-10,000 km²)
│  └─ Use: H3 Res 4-5 | DIGIPIN Level 3-4
│
├─ City/District (10-1,000 km²)
│  └─ Use: H3 Res 6-7 | DIGIPIN Level 4-5
│
├─ Pincode/Neighborhood (0.5-10 km²)
│  └─ Use: H3 Res 8-9 ⭐ | DIGIPIN Level 6-7 ⭐
│  └─ ⭐ DEFAULT: H3-9 & DIGIPIN-6
│
├─ City Block (0.05-0.5 km²)
│  └─ Use: H3 Res 9-10 | DIGIPIN Level 7-8
│
├─ Building/Campus (500-50,000 m²)
│  └─ Use: H3 Res 11-12 | DIGIPIN Level 8-9
│
└─ Room/Precision (<500 m²)
   └─ Use: H3 Res 13-15 | DIGIPIN Level 9-10
```

---

## Relationship-Based Selection

### Scenario 1: Pincode CONTAINS smaller cells

**Goal**: Find all H3/DIGIPIN cells that fit INSIDE a pincode

```
Pincode Area: 5 km²
Desired Coverage: Multiple cells inside

Recommendations:
✅ H3 Resolution 9 → ~50 hexagons (each 0.1 km²)
✅ H3 Resolution 10 → ~350 hexagons (each 0.015 km²)
✅ DIGIPIN Level 7 → ~2,000 cells (each 0.0025 km²)
✅ DIGIPIN Level 8 → ~50,000 cells (each 0.0001 km²)

API Example:
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&resolution=9
```

### Scenario 2: Larger cell CONTAINS pincode

**Goal**: Find large H3/DIGIPIN cell that encompasses entire pincode

```
Pincode Area: 2 km²
Desired Coverage: Single cell that contains it

Recommendations:
✅ H3 Resolution 6 → Cell area 36 km² (contains pincode)
✅ H3 Resolution 7 → Cell area 5 km² (may contain pincode)
❌ H3 Resolution 9 → Cell area 0.1 km² (too small)

✅ DIGIPIN Level 4 → Cell area ~25 km² (contains pincode)
✅ DIGIPIN Level 5 → Cell area ~1 km² (may not contain)
❌ DIGIPIN Level 6 → Cell area ~0.04 km² (too small)

API Example:
GET /api/v1/convert/pincode-to-h3/110001?relationship=contained_by&resolution=6
```

### Scenario 3: Boundary detection (OVERLAPS)

**Goal**: Find cells that partially overlap with pincode boundary

```
Use Case: Detect edge cases, border zones

Recommendations:
✅ H3 Resolution 9 → Good for pincode-level boundaries
✅ DIGIPIN Level 6-7 → Comparable precision

API Example:
GET /api/v1/convert/pincode-to-h3/110001?relationship=overlaps&resolution=9
```

---

## Performance Considerations

### Number of Cells Generated

| Area | H3-9 | H3-10 | H3-11 | DIGIPIN-6 | DIGIPIN-7 | DIGIPIN-8 |
|------|------|-------|-------|-----------|-----------|-----------|
| 1 km² | ~10 | ~70 | ~500 | ~25 | ~400 | ~10,000 |
| 5 km² | ~50 | ~350 | ~2,500 | ~125 | ~2,000 | ~50,000 |
| 10 km² | ~100 | ~700 | ~5,000 | ~250 | ~4,000 | ~100,000 |

**Recommendation**: 
- For API responses: Keep total cells < 1,000 for performance
- Use H3-9 or DIGIPIN-6/7 for most pincode operations
- Use higher resolutions only when precision is critical

---

## Real-World Examples

### Example 1: Delhi Pincode 110001 (Parliament Area)

**Pincode Area**: ~5.2 km²

| System | Resolution/Level | Cells Generated | Coverage % | Use Case |
|--------|------------------|-----------------|------------|----------|
| H3 | 9 | ~50 | 98% | ✅ Default, balanced |
| H3 | 10 | ~350 | 99% | Detailed mapping |
| H3 | 8 | ~7 | 85% | Broad coverage |
| DIGIPIN | 6 | ~130 | 95% | ✅ Default, balanced |
| DIGIPIN | 7 | ~2,080 | 98% | Detailed mapping |
| DIGIPIN | 5 | ~5 | 75% | Broad coverage |

**Recommendation**: H3-9 or DIGIPIN-6

### Example 2: Mumbai Pincode 400001 (Fort Area)

**Pincode Area**: ~2.8 km²

| System | Resolution/Level | Cells Generated | Coverage % | Use Case |
|--------|------------------|-----------------|------------|----------|
| H3 | 9 | ~27 | 97% | ✅ Default |
| H3 | 10 | ~190 | 99% | Detailed |
| DIGIPIN | 6 | ~70 | 95% | ✅ Default |
| DIGIPIN | 7 | ~1,120 | 98% | Detailed |

**Recommendation**: H3-9 or DIGIPIN-6

### Example 3: Small Rural Pincode (0.5 km²)

**Pincode Area**: ~0.5 km²

| System | Resolution/Level | Cells Generated | Coverage % | Use Case |
|--------|------------------|-----------------|------------|----------|
| H3 | 9 | ~5 | 95% | ✅ Good balance |
| H3 | 10 | ~35 | 98% | Very detailed |
| H3 | 8 | ~1 | 70% | Too coarse |
| DIGIPIN | 6 | ~12 | 92% | ✅ Good balance |
| DIGIPIN | 7 | ~200 | 97% | Very detailed |

**Recommendation**: H3-9 or DIGIPIN-6

---

## Conversion Recommendations

### Pincode → H3

```typescript
// Default (balanced)
GET /api/v1/convert/pincode-to-h3/110001?resolution=9

// More detailed (use for small pincodes)
GET /api/v1/convert/pincode-to-h3/110001?resolution=10

// Broader coverage (use for large pincodes)
GET /api/v1/convert/pincode-to-h3/110001?resolution=8

// With relationship filter
GET /api/v1/convert/pincode-to-h3/110001?resolution=9&relationship=contains
```

### Pincode → DIGIPIN

```typescript
// Default (balanced)
GET /api/v1/convert/pincode-to-digipin/110001?level=6

// More detailed
GET /api/v1/convert/pincode-to-digipin/110001?level=7

// Broader coverage
GET /api/v1/convert/pincode-to-digipin/110001?level=5
```

### H3 → DIGIPIN

```typescript
// H3-9 → DIGIPIN-6 (comparable)
GET /api/v1/convert/h3-to-digipin/89283082803ffff?level=6

// H3-9 → DIGIPIN-7 (finer)
GET /api/v1/convert/h3-to-digipin/89283082803ffff?level=7

// H3-8 → DIGIPIN-6 (comparable)
GET /api/v1/convert/h3-to-digipin/8828308a403ffff?level=6
```

---

## Common Mistakes to Avoid

### ❌ Using too high resolution for large areas
```typescript
// BAD: Will generate 100,000+ cells
GET /api/v1/convert/pincode-to-h3/110001?resolution=12

// GOOD: Balanced granularity
GET /api/v1/convert/pincode-to-h3/110001?resolution=9
```

### ❌ Using too low resolution for precision tasks
```typescript
// BAD: Only 1-2 cells, not useful
GET /api/v1/convert/pincode-to-h3/110001?resolution=6

// GOOD: Adequate coverage
GET /api/v1/convert/pincode-to-h3/110001?resolution=9
```

### ❌ Mismatching relationship with resolution
```typescript
// BAD: relationship=contains with resolution=6
// (H3-6 cells are 36 km², larger than most pincodes)
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&resolution=6

// GOOD: Use higher resolution for contains
GET /api/v1/convert/pincode-to-h3/110001?relationship=contains&resolution=9
```

---

## Summary Table

| Use Case | H3 Resolution | DIGIPIN Level | Expected Cells | Response Time |
|----------|---------------|---------------|----------------|---------------|
| Quick overview | 8 | 5 | 5-20 | Fast (~50ms) |
| **Default mapping** | **9** | **6** | **20-100** | **Fast (~100ms)** |
| Detailed analysis | 10 | 7 | 100-500 | Medium (~200ms) |
| Precision mapping | 11 | 8 | 500-5000 | Slow (~500ms) |
| Indoor/Ultra-precise | 12-15 | 9-10 | 5000+ | Very Slow (>1s) |

**Recommendation**: Stick with H3-9 and DIGIPIN-6 for 90% of use cases.

