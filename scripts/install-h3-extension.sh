#!/bin/bash

# Install H3 PostgreSQL Extension
# Run this on Railway or with DATABASE_URL set

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  echo "   Run this script on Railway or set DATABASE_URL environment variable"
  exit 1
fi

echo "========================================================================="
echo "  Installing H3 PostgreSQL Extensions"
echo "========================================================================="
echo ""

# 1. Try to install h3 extension
echo "Step 1: Installing h3 extension..."
if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS h3;" 2>&1 | tee /tmp/h3-install.log; then
  echo "✅ h3 extension installed successfully"
else
  echo "❌ Failed to install h3 extension"
  echo ""
  echo "Error details:"
  cat /tmp/h3-install.log
  echo ""
  echo "This might be a permissions issue. Try:"
  echo "  1. Contact Railway support to enable h3 extension"
  echo "  2. Use hybrid approach (Option B) instead"
  exit 1
fi
echo ""

# 2. Try to install h3_postgis extension
echo "Step 2: Installing h3_postgis extension..."
if psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS h3_postgis;" 2>&1 | tee /tmp/h3-postgis-install.log; then
  echo "✅ h3_postgis extension installed successfully"
else
  echo "⚠️  h3_postgis extension installation failed (optional)"
  echo "    h3 extension alone is sufficient for our needs"
fi
echo ""

# 3. Verify installation
echo "Step 3: Verifying H3 installation..."
echo ""

echo "📦 Installed Extensions:"
psql "$DATABASE_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname LIKE '%h3%' ORDER BY extname;"
echo ""

echo "🔍 H3 Functions Available:"
H3_FUNC_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'h3_%';" | tr -d ' ')
echo "   Found $H3_FUNC_COUNT H3 functions"
echo ""

if [ "$H3_FUNC_COUNT" -gt 0 ]; then
  echo "   Sample functions:"
  psql "$DATABASE_URL" -t -c "SELECT proname FROM pg_proc WHERE proname LIKE 'h3_%' ORDER BY proname LIMIT 10;"
fi
echo ""

# 4. Test H3 functionality
echo "🧪 Testing H3 Functionality:"
echo ""

echo "Test 1: h3_lat_lng_to_cell (point to H3 cell)"
psql "$DATABASE_URL" -c "SELECT h3_lat_lng_to_cell(POINT(77.2090, 28.6139), 9) as h3_cell;"
echo ""

echo "Test 2: h3_cell_to_lat_lng (H3 cell to point)"
psql "$DATABASE_URL" -c "SELECT h3_cell_to_lat_lng('89283082803ffff') as center_point;"
echo ""

echo "Test 3: h3_cell_to_boundary (get cell polygon)"
psql "$DATABASE_URL" -c "SELECT ST_AsText(h3_cell_to_boundary('89283082803ffff')) as boundary;"
echo ""

echo "========================================================================="
echo "✅ H3 Extension Installation Complete!"
echo "========================================================================="
echo ""
echo "Next steps:"
echo "  1. Create GIST spatial index on pincodes table"
echo "  2. Implement PostGIS-based H3 index generation"
echo "  3. Rebuild H3 index using native functions"
echo ""
echo "For implementation, see:"
echo "  - H3_INDEX_NATIVE_IMPLEMENTATION.md (to be created)"
echo "  - pynpoint/MIGRATION_H3_POSTGIS.md (Option A)"
echo ""
