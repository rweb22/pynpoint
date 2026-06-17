#!/bin/bash

# Check Database Capabilities Script
# This script checks PostgreSQL version, extensions, and H3 support
# Run this on Railway or with proper DATABASE_URL

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  echo "   Run this script on Railway or set DATABASE_URL environment variable"
  exit 1
fi

echo "==================================================================="
echo "  PostgreSQL & PostGIS Capability Check for H3 Migration"
echo "==================================================================="
echo ""

# Extract connection details from DATABASE_URL
echo "✅ Connected to database"
echo ""

# 1. PostgreSQL version
echo "📊 PostgreSQL Version:"
psql "$DATABASE_URL" -t -c "SELECT version();" | head -1
echo ""

# 2. PostGIS version
echo "🗺️  PostGIS Status:"
if psql "$DATABASE_URL" -t -c "SELECT PostGIS_Version();" 2>/dev/null; then
  echo "✅ PostGIS is installed"
  psql "$DATABASE_URL" -t -c "SELECT PostGIS_Full_Version();" | head -5
else
  echo "❌ PostGIS is NOT installed"
fi
echo ""

# 3. List installed extensions
echo "🔌 Installed Extensions:"
psql "$DATABASE_URL" -t -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;"
echo ""

# 4. Check available extensions
echo "📦 Available Extensions (H3 and PostGIS related):"
psql "$DATABASE_URL" -t -c "SELECT name, default_version, comment FROM pg_available_extensions WHERE name LIKE '%h3%' OR name LIKE '%postgis%' ORDER BY name;"
echo ""

# 5. Check if h3 functions exist
echo "🔍 Checking H3 Function Availability:"
H3_FUNCS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'h3_%';" | tr -d ' ')
if [ "$H3_FUNCS" -gt 0 ]; then
  echo "✅ Found $H3_FUNCS H3 functions"
  echo "   Sample functions:"
  psql "$DATABASE_URL" -t -c "SELECT proname FROM pg_proc WHERE proname LIKE 'h3_%' LIMIT 10;"
else
  echo "❌ No H3 functions found"
fi
echo ""

# 6. Database size
echo "📈 Database Statistics:"
psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database())) as size;"
echo ""

# 7. Check pincodes table
echo "🏷️  Pincodes Table:"
PINCODE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pincodes;" | tr -d ' ')
echo "   Total pincodes: $PINCODE_COUNT"

BOUNDARY_TYPE=$(psql "$DATABASE_URL" -t -c "SELECT udt_name FROM information_schema.columns WHERE table_name = 'pincodes' AND column_name = 'boundary';" | tr -d ' ')
echo "   Boundary type: $BOUNDARY_TYPE"

# Check for spatial index
GIST_INDEX=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'pincodes' AND indexdef LIKE '%GIST%';" | tr -d ' ')
if [ "$GIST_INDEX" -gt 0 ]; then
  echo "   ✅ GIST spatial index exists"
else
  echo "   ❌ No GIST spatial index (should create one!)"
fi
echo ""

# 8. Test PostGIS functionality
echo "🧪 Testing PostGIS Functionality:"
if psql "$DATABASE_URL" -t -c "SELECT ST_AsText(ST_MakePoint(77.2090, 28.6139));" >/dev/null 2>&1; then
  echo "   ✅ PostGIS functions working"
else
  echo "   ❌ PostGIS functions NOT working"
fi
echo ""

echo "==================================================================="
echo "📋 ASSESSMENT SUMMARY"
echo "==================================================================="
echo ""

# Summary and recommendations
if [ "$H3_FUNCS" -gt 0 ]; then
  echo "✅ H3 EXTENSION IS AVAILABLE!"
  echo "   We can proceed with PostGIS-based H3 index generation."
  echo ""
  echo "Next steps:"
  echo "   1. No installation needed - H3 is already available"
  echo "   2. Proceed to clear old Redis index"
  echo "   3. Implement PostGIS-based index generation"
else
  echo "❌ H3 EXTENSION NOT AVAILABLE"
  echo ""
  echo "Options:"
  echo "   A) Check if h3 can be installed:"
  echo "      CREATE EXTENSION IF NOT EXISTS h3;"
  echo ""
  echo "   B) Use pure PostGIS ST_Intersects (no h3 extension needed)"
  echo "      - Generate H3 cells in JavaScript"
  echo "      - Validate intersection with PostGIS"
  echo ""
  echo "   C) Request Railway support for h3 extension"
fi
echo ""
