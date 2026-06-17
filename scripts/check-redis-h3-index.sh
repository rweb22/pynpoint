#!/bin/bash

# Check Redis H3 Index Status
# This script checks the current H3 index in Redis
# Run this on Railway or with proper REDIS_URL

set -e

if [ -z "$REDIS_URL" ]; then
  echo "❌ ERROR: REDIS_URL not set"
  echo "   Run this script on Railway or set REDIS_URL environment variable"
  exit 1
fi

echo "==================================================================="
echo "  Redis H3 Index Status Check"
echo "==================================================================="
echo ""

# Extract Redis connection details
REDIS_HOST=$(echo "$REDIS_URL" | sed -E 's|redis://([^:]+):.*|\1|')
REDIS_PORT=$(echo "$REDIS_URL" | sed -E 's|redis://[^:]+:([0-9]+).*|\1|')
REDIS_PASS=$(echo "$REDIS_URL" | sed -E 's|redis://[^:]+:[0-9]+/(.*)|\1|' | cut -d'@' -f1)

echo "✅ Connected to Redis"
echo ""

# Helper function to run redis-cli commands
redis_cmd() {
  if [ -n "$REDIS_PASS" ]; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASS" --no-auth-warning "$@"
  else
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" "$@"
  fi
}

# 1. Redis server info
echo "📊 Redis Server Info:"
redis_cmd INFO server | grep -E "redis_version|redis_mode|os" | sed 's/^/   /'
echo ""

# 2. Memory usage
echo "💾 Memory Usage:"
redis_cmd INFO memory | grep -E "used_memory_human|used_memory_peak_human|mem_fragmentation_ratio" | sed 's/^/   /'
echo ""

# 3. Persistence info
echo "💿 Persistence Configuration:"
redis_cmd INFO persistence | grep -E "rdb_last_save_time|aof_enabled" | sed 's/^/   /'
echo ""

# 4. Count H3 keys
echo "🔷 H3 Index Statistics:"
echo "   Counting h3:* keys (this will take a moment)..."

# Count total keys
TOTAL_KEYS=$(redis_cmd DBSIZE | tr -d '\r')
echo "   Total keys in database: $TOTAL_KEYS"

# Sample count of h3: keys (using SCAN)
# Note: Full count would take too long, so we estimate
SAMPLE_SCAN=$(redis_cmd SCAN 0 MATCH "h3:8*" COUNT 10000 | tail -n +2)
SAMPLE_COUNT=$(echo "$SAMPLE_SCAN" | wc -l)
echo "   Sample h3:8* keys found: $SAMPLE_COUNT"

# Get metadata keys
echo ""
echo "📋 H3 Index Metadata:"
LAST_BUILT=$(redis_cmd GET "h3:stats:last_built")
RESOLUTION=$(redis_cmd GET "h3:stats:resolution")
TOTAL_PINCODES=$(redis_cmd GET "h3:stats:total_pincodes")
TOTAL_HEXAGONS=$(redis_cmd GET "h3:stats:total_hexagons")
AVG_PER_PINCODE=$(redis_cmd GET "h3:stats:avg_hexagons_per_pincode")

echo "   Last built: ${LAST_BUILT:-N/A}"
echo "   Resolution: ${RESOLUTION:-N/A}"
echo "   Total pincodes indexed: ${TOTAL_PINCODES:-N/A}"
echo "   Total hexagons: ${TOTAL_HEXAGONS:-N/A}"
echo "   Avg hexagons per pincode: ${AVG_PER_PINCODE:-N/A}"
echo ""

# 5. Sample data
echo "🔍 Sample H3 Index Data:"
SAMPLE_KEYS=$(redis_cmd SCAN 0 MATCH "h3:89*" COUNT 3 | tail -n +2 | head -3)
for KEY in $SAMPLE_KEYS; do
  if [ -n "$KEY" ]; then
    PINCODES=$(redis_cmd SMEMBERS "$KEY" | tr '\n' ', ' | sed 's/,$//')
    PINCODE_COUNT=$(redis_cmd SCARD "$KEY")
    H3_INDEX=${KEY#h3:}
    echo "   $H3_INDEX → [$PINCODES] ($PINCODE_COUNT pincodes)"
  fi
done
echo ""

echo "==================================================================="
echo "📋 SUMMARY"
echo "==================================================================="
echo ""
echo "Total Redis keys: $TOTAL_KEYS"
echo "Memory used: $(redis_cmd INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')"
echo ""

if [ "$TOTAL_KEYS" -gt 1000000 ]; then
  echo "⚠️  Large H3 index detected ($TOTAL_KEYS keys)"
  echo ""
  echo "To clear this index:"
  echo "   1. Backup current index (if needed)"
  echo "   2. Delete all h3:* keys"
  echo "   3. Clear AOF file"
  echo "   4. Restart Redis"
  echo ""
  echo "Estimated time to clear: 5-10 minutes"
  echo "Memory to be freed: $(redis_cmd INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')"
fi
echo ""
