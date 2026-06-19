#!/bin/bash

# Create GIST Spatial Index on Pincodes Table
# This index is critical for fast spatial queries

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

echo "========================================================================="
echo "  Creating GIST Spatial Index on Pincodes Table"
echo "========================================================================="
echo ""

echo "This will create a spatial index on the 'boundary' column."
echo "Expected time: 1-5 minutes for 150K pincodes"
echo ""
read -p "Press ENTER to continue or Ctrl+C to cancel..."
echo ""

# Check if index already exists
echo "Checking for existing spatial index..."
EXISTING_INDEX=$(psql "$DATABASE_URL" -t -c "SELECT indexname FROM pg_indexes WHERE tablename = 'pincodes' AND indexdef LIKE '%GIST%';" | tr -d ' ')

if [ -n "$EXISTING_INDEX" ]; then
  echo "✅ Spatial index already exists: $EXISTING_INDEX"
  echo ""
  psql "$DATABASE_URL" -c "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'pincodes' AND indexdef LIKE '%GIST%';"
  exit 0
fi

echo "No spatial index found, creating one..."
echo ""

# Create GIST index
echo "Creating index: idx_pincodes_boundary_gist"
START_TIME=$(date +%s)

psql "$DATABASE_URL" -c "
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pincodes_boundary_gist
  ON pincodes USING GIST (boundary);
" 2>&1

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "✅ Index created successfully in ${DURATION} seconds"
echo ""

# Verify index
echo "Verifying index..."
psql "$DATABASE_URL" -c "
  SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
  FROM pg_indexes
  WHERE tablename = 'pincodes' AND indexdef LIKE '%GIST%';
"

echo ""
echo "========================================================================="
echo "✅ Spatial Index Creation Complete!"
echo "========================================================================="
echo ""
echo "This index will significantly speed up spatial queries like:"
echo "  - ST_Intersects(boundary, point)"
echo "  - ST_Contains(boundary, geometry)"
echo "  - Pincode → H3 cell conversions"
echo ""
