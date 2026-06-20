#!/bin/bash

# Test DIGIPIN migration locally before deploying to Railway

set -e  # Exit on error

echo ""
echo "🧪 Testing DIGIPIN Migration Locally"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  echo "   Set it with: export DATABASE_URL=<your-db-url>"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Change to pynpoint directory if not already there
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "📁 Working directory: $(pwd)"
echo ""

# Build project
echo "📦 Building project..."
npm run build
echo "✅ Build complete"
echo ""

# Run migrations
echo "🚀 Running migrations..."
npm run migration:run
echo "✅ Migrations complete"
echo ""

# Test 1: Check functions exist
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 1: Verify functions exist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FUNCTIONS=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*)
  FROM pg_proc 
  WHERE proname IN ('digipin_calc_indices', 'digipin_grid_char', 'encode_digipin_level6', 'polygon_to_digipin_cells_level6')
")

if [ "$FUNCTIONS" -ge "4" ]; then
  echo "✅ All DIGIPIN functions exist ($FUNCTIONS found)"
else
  echo "❌ ERROR: Not all functions found (expected 4+, found $FUNCTIONS)"
  exit 1
fi
echo ""

# Test 2: Check column exists
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 2: Verify column exists"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

COLUMN=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_name = 'pincodes' AND column_name = 'digipin_cells'
")

if [ "$COLUMN" -eq "1" ]; then
  echo "✅ digipin_cells column exists"
else
  echo "❌ ERROR: digipin_cells column not found"
  exit 1
fi
echo ""

# Test 3: Check index exists
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 3: Verify GIN index exists"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

INDEX=$(psql $DATABASE_URL -t -c "
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE tablename = 'pincodes' AND indexname = 'idx_pincodes_digipin_cells_gin'
")

if [ "$INDEX" -eq "1" ]; then
  echo "✅ GIN index exists"
else
  echo "❌ ERROR: GIN index not found"
  exit 1
fi
echo ""

# Test 4: Test encode function
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 4: Test encode_digipin_level6 function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DELHI_CODE=$(psql $DATABASE_URL -t -c "SELECT encode_digipin_level6(28.6139, 77.209)" | xargs)

if [ "$DELHI_CODE" = "39J438" ]; then
  echo "✅ Delhi encodes correctly: $DELHI_CODE"
else
  echo "❌ ERROR: Delhi encoding incorrect (expected 39J438, got $DELHI_CODE)"
  exit 1
fi
echo ""

# Test 5: Test polygon function
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Test 5: Test polygon_to_digipin_cells_level6 function"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CELLS=$(psql $DATABASE_URL -t -c "
  SELECT cardinality(polygon_to_digipin_cells_level6(boundary, 200.0))
  FROM pincodes
  WHERE pincode = '110001'
" | xargs)

if [ "$CELLS" -gt "0" ]; then
  echo "✅ Polygon function works: Generated $CELLS cells for Delhi 110001"
else
  echo "⚠️  WARNING: No cells generated (pincode may not have boundary)"
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ All tests passed!"
echo ""
echo "Migration is ready for Railway deployment."
echo ""
echo "Next steps:"
echo "  1. git add src/database/migrations/178170*.ts"
echo "  2. git commit -m 'Add DIGIPIN migrations'"
echo "  3. git push"
echo "  4. After deployment, run: railway run psql \$DATABASE_URL -f pynpoint/scripts/populate-digipin-cells.sql"
echo ""
