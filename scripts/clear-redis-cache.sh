#!/bin/bash

# Clear Redis cache for DIGIPIN conversion endpoints

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗑️  Clearing Redis Cache for DIGIPIN Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if REDIS_URL is set
if [ -z "$REDIS_URL" ]; then
  echo "❌ REDIS_URL not set. Run via Railway CLI:"
  echo "   railway run bash pynpoint/scripts/clear-redis-cache.sh"
  exit 1
fi

echo "🔍 Checking cache keys matching 'conversion:*'..."
redis-cli --raw -u "$REDIS_URL" KEYS "conversion:*" | head -20

echo ""
echo "🗑️  Deleting all conversion cache keys..."
redis-cli -u "$REDIS_URL" EVAL "return redis.call('del', unpack(redis.call('keys', 'conversion:*')))" 0

echo ""
echo "✅ Cache cleared!"
echo ""
echo "🧪 Test again:"
echo "   API_KEY=your-key ./pynpoint/scripts/test-api-endpoints.sh"
echo ""
