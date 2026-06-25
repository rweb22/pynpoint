#!/bin/bash

# Test Monitoring - Generate traffic to see monitoring logs
# Usage: ./scripts/test-monitoring.sh <API_KEY>

API_KEY=${1:-"ppk_live_sk_8689efc7dc26ba52c54e88c9_5"}
BASE_URL="https://pynpoint-production.up.railway.app/api/v1"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Monitoring - Generating Traffic"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "API Key: ${API_KEY:0:20}..."
echo ""

echo "📊 Sending 20 requests to generate metrics..."
for i in {1..20}; do
  curl -s "$BASE_URL/pincodes/110001" \
    -H "X-API-Key: $API_KEY" > /dev/null &
  echo -n "."
done
wait
echo ""
echo "✅ Done! Wait 60 seconds for next metrics log..."
echo ""
echo "📍 View logs in Railway dashboard:"
echo "   https://railway.app/project/pynpoint-production/deployments"
echo ""
echo "🔍 Look for these log entries:"
echo "   • [PerformanceMonitor] 📊 Metrics | ..."
echo "   • [RequestTrackingInterceptor] 🐌 Slow request: ..."
echo ""
