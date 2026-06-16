# H3 vs DIGIPIN Equivalence Table

## Overview
This table compares the approximate area coverage of H3 hexagons at different resolutions (0-15) with DIGIPIN grid cells at different precision levels (1-10).

---

## Area Coverage Comparison

| H3 Res | Avg Hexagon Area | Edge Length | DIGIPIN Level | Avg Cell Area | Cell Size | Equivalent Mapping |
|--------|------------------|-------------|---------------|---------------|-----------|-------------------|
| 0 | 4,250,547 km² | 1,107 km | - | - | - | - |
| 1 | 607,221 km² | 418 km | - | - | - | - |
| 2 | 86,745 km² | 158 km | 1 | ~625,000 km² | ~25° × 25° | H3-2 ≈ DIGIPIN-1.5 |
| 3 | 12,392 km² | 59.8 km | 2 | ~2,500 km² | ~2.5° × 2.5° | H3-3 ≈ DIGIPIN-2.5 |
| 4 | 1,770 km² | 22.6 km | 3 | ~100 km² | ~0.25° × 0.25° | H3-4.5 ≈ DIGIPIN-3 |
| 5 | 252.9 km² | 8.54 km | 4 | ~25 km² | ~0.025° × 0.025° (~150" × 150") | **H3-5 ≈ DIGIPIN-4** |
| 6 | 36.1 km² | 3.23 km | 5 | ~1 km² | ~0.0025° × 0.0025° (~15" × 15") | H3-6.5 ≈ DIGIPIN-5 |
| 7 | 5.16 km² | 1.22 km | 6 | ~0.04 km² (~50m × 50m) | ~0.00025° × 0.00025° (~1.5" × 1.5") | H3-7.5 ≈ DIGIPIN-6 |
| 8 | 0.737 km² | 461 m | 7 | ~0.0025 km² (~50m × 50m) | ~0.000025° × 0.000025° | **H3-8 ≈ DIGIPIN-7** |
| 9 | 0.105 km² | 174 m | 8 | ~0.0001 km² (~10m × 10m) | ~0.0000025° × 0.0000025° | **H3-9 ≈ DIGIPIN-8** (Default) |
| 10 | 0.015 km² | 66 m | 9 | ~0.000004 km² (~2m × 2m) | ~0.00000025° × 0.00000025° | H3-10 ≈ DIGIPIN-9 |
| 11 | 0.0021 km² | 25 m | 10 | ~0.0000001 km² (~0.3m × 0.3m) | ~0.000000025° × 0.000025° | H3-11.5 ≈ DIGIPIN-10 |
| 12 | 0.0003 km² | 9.4 m | - | - | - | - |
| 13 | 0.000043 km² | 3.5 m | - | - | - | - |
| 14 | 0.0000061 km² | 1.3 m | - | - | - | - |
| 15 | 0.00000087 km² | 0.5 m | - | - | - | - |

---

## Detailed Breakdown

### H3 Hexagon Areas (All 16 Resolutions)

| Resolution | Avg Area (km²) | Avg Area (m²) | Edge Length | Human Scale |
|------------|----------------|---------------|-------------|-------------|
| 0 | 4,250,547 | 4.25 × 10¹² | 1,107 km | Continent-sized |
| 1 | 607,221 | 6.07 × 10¹¹ | 418 km | Multi-country |
| 2 | 86,745 | 8.67 × 10¹⁰ | 158 km | Large state/province |
| 3 | 12,392 | 1.24 × 10¹⁰ | 59.8 km | County/district |
| 4 | 1,770 | 1.77 × 10⁹ | 22.6 km | City-sized |
| 5 | 252.9 | 2.53 × 10⁸ | 8.54 km | Town/suburb |
| 6 | 36.1 | 3.61 × 10⁷ | 3.23 km | Neighborhood |
| 7 | 5.16 | 5.16 × 10⁶ | 1.22 km | Village/locality |
| 8 | 0.737 | 7.37 × 10⁵ | 461 m | Large campus |
| **9** | **0.105** | **1.05 × 10⁵** | **174 m** | **City block** (Default for pincodes) |
| 10 | 0.015 | 1.5 × 10⁴ | 66 m | Building cluster |
| 11 | 0.0021 | 2.1 × 10³ | 25 m | Large building |
| 12 | 0.0003 | 300 | 9.4 m | House |
| 13 | 0.000043 | 43 | 3.5 m | Room |
| 14 | 0.0000061 | 6.1 | 1.3 m | Desk |
| 15 | 0.00000087 | 0.87 | 0.5 m | Book |

### DIGIPIN Cell Areas (All 10 Levels)

| Level | Precision | Avg Area (km²) | Avg Area (m²) | Cell Size (degrees) | Human Scale |
|-------|-----------|----------------|---------------|---------------------|-------------|
| 1 | Low | ~625,000 | 6.25 × 10¹¹ | ~25° × 25° | Multi-country |
| 2 | Low | ~2,500 | 2.5 × 10⁹ | ~2.5° × 2.5° | Large region |
| 3 | Low-Med | ~100 | 1 × 10⁸ | ~0.25° × 0.25° (~15' × 15') | District |
| 4 | Medium | ~25 | 2.5 × 10⁷ | ~0.025° × 0.025° (~1.5' × 1.5') | Town |
| 5 | Medium | ~1 | 1 × 10⁶ | ~0.0025° × 0.0025° (~9" × 9") | Neighborhood |
| **6** | **Med-High** | **~0.04** | **~4 × 10⁴** | **~0.00025° × 0.00025° (~1" × 1")** | **Large block** (Default) |
| 7 | High | ~0.0025 | ~2,500 | ~0.000025° × 0.000025° | Small block |
| 8 | High | ~0.0001 | ~100 | ~0.0000025° × 0.0000025° | Building |
| 9 | Very High | ~0.000004 | ~4 | ~0.00000025° × 0.00000025° | Room |
| 10 | Ultra High | ~0.0000001 | ~0.1 | ~0.000000025° × 0.000000025° | Desk |

---

## Key Equivalence Mappings

### Approximate 1:1 Equivalents

| Use Case | H3 Resolution | DIGIPIN Level | Area Coverage | Best For |
|----------|---------------|---------------|---------------|----------|
| **Pincode Coverage** | **9** | **6-7** | **~0.05-0.1 km²** | Default mapping, city blocks |
| Neighborhood | 7 | 5 | ~1-5 km² | Community-level analysis |
| Building | 11 | 8-9 | ~10-100 m² | Asset tracking |
| Room | 13 | 9-10 | ~1-10 m² | Indoor positioning |

### Conversion Recommendations

**For Pincode → H3 Conversion:**
- Use **H3 Resolution 9** (default) - Best balance of granularity and coverage
- Alternative: Resolution 8 for broader coverage, 10 for finer detail

**For Pincode → DIGIPIN Conversion:**
- Use **DIGIPIN Level 6** (default) - Comparable to H3-9
- Alternative: Level 7 for finer detail, Level 5 for broader coverage

**For H3 ↔ DIGIPIN Conversion:**
- H3-8 ≈ DIGIPIN-7 (large block level)
- **H3-9 ≈ DIGIPIN-6/7** (city block level) - **Recommended for most use cases**
- H3-10 ≈ DIGIPIN-8 (building level)
- H3-11 ≈ DIGIPIN-9 (room level)

---

## Spatial Relationship Examples

### Large Pincode (5 km²) Coverage

| System | Resolution/Level | Units Needed | Overlap Behavior |
|--------|------------------|--------------|------------------|
| H3 | 9 | ~50 hexagons | Pincode CONTAINS H3 cells |
| H3 | 7 | ~1-2 hexagons | H3 cell MAY CONTAIN pincode |
| DIGIPIN | 6 | ~125 cells | Pincode CONTAINS DIGIPIN cells |
| DIGIPIN | 4 | ~1-2 cells | DIGIPIN cell MAY CONTAIN pincode |

### Small Pincode (0.5 km²) Coverage

| System | Resolution/Level | Units Needed | Overlap Behavior |
|--------|------------------|--------------|------------------|
| H3 | 9 | ~5 hexagons | Pincode CONTAINS H3 cells |
| H3 | 8 | ~1 hexagon | INTERSECTS, near 1:1 |
| DIGIPIN | 6 | ~12 cells | Pincode CONTAINS DIGIPIN cells |
| DIGIPIN | 5 | ~1 cell | INTERSECTS, near 1:1 |

---

## Usage Guidelines

### When to use different resolutions/levels:

**Broad Coverage (Country/State Level):**
- H3: Resolutions 2-4
- DIGIPIN: Levels 1-3

**City/District Level:**
- H3: Resolutions 5-7
- DIGIPIN: Levels 4-5

**Neighborhood/Block Level (Most Common):**
- H3: **Resolutions 8-9** (Recommended)
- DIGIPIN: **Levels 6-7** (Recommended)

**Building/Asset Level:**
- H3: Resolutions 10-12
- DIGIPIN: Levels 8-9

**Indoor/Precision Level:**
- H3: Resolutions 13-15
- DIGIPIN: Level 10

---

## Notes

1. **H3 hexagons** have ~7× scaling factor between resolutions (each resolution has ~7 times more cells than the previous)
2. **DIGIPIN cells** are grid-based, each level adds one more character to the code
3. **Default settings** in PinPoint API:
   - H3 Resolution: **9** (city block level, ~0.1 km²)
   - DIGIPIN Level: **6** (comparable coverage, ~0.04 km²)
4. For **relationship=contains** queries, use higher resolution/level to find cells INSIDE larger areas
5. For **relationship=contained_by** queries, use lower resolution/level to find areas that CONTAIN smaller cells

