#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 DIGIPIN Cell Population with Auto-Commit"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  exit 1
fi

# Get initial counts
echo "📊 Checking initial status..."
psql $DATABASE_URL -tA << 'EOF'
SELECT 
  '   Total pincodes: ' || COUNT(*) ||
  E'\n   Already populated: ' || COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') ||
  E'\n   Remaining: ' || COUNT(*) FILTER (WHERE digipin_cells = '{}')
FROM pincodes
WHERE boundary IS NOT NULL;
EOF

echo ""
echo "💾 Auto-commit: Each batch is a separate transaction"
echo "⚡ Batch size: 100 pincodes"
echo "🔄 Resumable: Can be interrupted and restarted safely"
echo ""
echo "Starting population..."
echo ""

batch_num=0

while true; do
  batch_num=$((batch_num + 1))
  
  # Get remaining count
  remaining=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM pincodes WHERE boundary IS NOT NULL AND (digipin_cells IS NULL OR digipin_cells = '{}')")
  
  if [ "$remaining" -eq 0 ]; then
    echo ""
    echo "✅ Population complete! All pincodes processed."
    break
  fi
  
  echo "🔄 Batch $batch_num: Processing next 100 pincodes ($remaining remaining)..."
  
  start_time=$(date +%s)
  
  # Process one batch (this is a separate transaction that auto-commits)
  processed=$(psql $DATABASE_URL -tAc "
    WITH batch AS (
      SELECT pincode, boundary
      FROM pincodes
      WHERE boundary IS NOT NULL
        AND (digipin_cells IS NULL OR digipin_cells = '{}')
      ORDER BY pincode
      LIMIT 100
    )
    UPDATE pincodes p
    SET digipin_cells = polygon_to_digipin_cells_level6(b.boundary, 200.0)
    FROM batch b
    WHERE p.pincode = b.pincode
    RETURNING 1;
  " | wc -l)
  
  end_time=$(date +%s)
  duration=$((end_time - start_time))
  
  # Get total cells generated so far
  total_cells=$(psql $DATABASE_URL -tAc "SELECT COALESCE(SUM(cardinality(digipin_cells)), 0) FROM pincodes WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}'")
  
  echo "   ✓ Batch $batch_num complete: $processed pincodes in ${duration}s | Total cells: $total_cells"
  
  # Exit if nothing was processed
  if [ "$processed" -eq 0 ]; then
    break
  fi
  
  # Show progress every 10 batches
  if [ $((batch_num % 10)) -eq 0 ]; then
    populated=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM pincodes WHERE boundary IS NOT NULL AND digipin_cells IS NOT NULL AND digipin_cells != '{}'")
    total=$(psql $DATABASE_URL -tAc "SELECT COUNT(*) FROM pincodes WHERE boundary IS NOT NULL")
    percent=$(awk "BEGIN {printf \"%.1f\", ($populated / $total) * 100}")
    echo ""
    echo "   📊 Progress: $populated/$total pincodes ($percent% complete)"
    echo ""
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Final Statistics"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

psql $DATABASE_URL << 'EOF'
SELECT 
  COUNT(*) AS total_pincodes,
  COUNT(*) FILTER (WHERE digipin_cells IS NOT NULL AND digipin_cells != '{}') AS populated,
  SUM(cardinality(digipin_cells)) AS total_cells,
  ROUND(AVG(cardinality(digipin_cells)) FILTER (WHERE digipin_cells != '{}')::numeric, 2) AS avg_cells_per_pincode,
  MAX(cardinality(digipin_cells)) AS max_cells
FROM pincodes
WHERE boundary IS NOT NULL;
EOF

echo ""
echo "✅ DIGIPIN population complete!"
echo ""
