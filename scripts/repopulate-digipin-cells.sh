#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 DIGIPIN Cell Repopulation (Official Algorithm)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  1. Clear existing DIGIPIN cells (old geohash codes)"
echo "  2. Repopulate with official India Post DIGIPIN codes"
echo "  3. Use PostgreSQL function (which is already correct)"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  exit 1
fi

# Show what we're clearing
echo "📊 Current state:"
psql $DATABASE_URL -tA << 'EOF'
SELECT 
  '   Total pincodes: ' || COUNT(*) ||
  E'\n   With DIGIPIN cells: ' || COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') ||
  E'\n   Sample old codes: ' || COALESCE(array_to_string(digipin_cells[1:3], ', '), 'none')
FROM pincodes
WHERE boundary IS NOT NULL
LIMIT 1;
EOF

echo ""
read -p "⚠️  Continue with repopulation? This will clear all existing cells. (y/N): " confirm

if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""
echo "🧹 Step 1: Clearing old DIGIPIN cells..."
psql $DATABASE_URL -c "UPDATE pincodes SET digipin_cells = '{}' WHERE digipin_cells IS NOT NULL;"

echo "✅ Old cells cleared"
echo ""
echo "🚀 Step 2: Starting repopulation with official DIGIPIN codes..."
echo ""

# Run the standard population script
bash pynpoint/scripts/populate-digipin-cells.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Repopulation Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Verification: Checking Delhi (110001)..."
psql $DATABASE_URL << 'EOF'
SELECT 
  pincode,
  cardinality(digipin_cells) as num_cells,
  digipin_cells[1:5] as sample_codes
FROM pincodes 
WHERE pincode = '110001';
EOF

echo ""
echo "Expected: Sample codes should start with 3, 4, 5, etc. (NOT T, M, etc.)"
echo ""
