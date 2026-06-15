#!/bin/bash

# Test API latency from your location vs public speed test
# This helps determine if it's your network or the API

API_KEY="${1}"
BASE_URL="https://pynpoint-production.up.railway.app"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-from-multiple-locations.sh <API_KEY>"
  exit 1
fi

echo "🌍 Network Latency Comparison Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Your location
echo "📍 Test 1: Your Location"
curl -s https://ipinfo.io/json | jq '{location: .city, region: .region, country: .country}'
echo ""

# Test 2: Ping to Railway (TCP, not ICMP)
echo "🏓 Test 2: TCP Ping to Railway (3 requests)"
for i in {1..3}; do
  time curl -s -o /dev/null -w "Request $i: %{time_total}s\n" "$BASE_URL/"
done
echo ""

# Test 3: Ping to a well-known fast CDN (Cloudflare)
echo "☁️  Test 3: TCP Ping to Cloudflare CDN (for comparison)"
for i in {1..3}; do
  time curl -s -o /dev/null -w "Request $i: %{time_total}s\n" "https://1.1.1.1/"
done
echo ""

# Test 4: Ping to Google (for comparison)
echo "🔍 Test 4: TCP Ping to Google (for comparison)"
for i in {1..3}; do
  time curl -s -o /dev/null -w "Request $i: %{time_total}s\n" "https://www.google.com/"
done
echo ""

# Test 5: Your API with cache hits
echo "🚀 Test 5: Your API (should be fast with cache)"
for i in {1..3}; do
  time curl -s -o /dev/null -w "Request $i: %{time_total}s\n" \
    -H "Authorization: Bearer $API_KEY" \
    "$BASE_URL/api/v1/pincodes/110001"
done
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Analysis:"
echo ""
echo "If ALL tests show high latency (>500ms):"
echo "  → Your network/internet connection is slow"
echo "  → Not a PinPoint API issue"
echo ""
echo "If ONLY Railway shows high latency:"
echo "  → Railway might be far from you"
echo "  → Or Railway routing issue"
echo ""
echo "If Cloudflare/Google are fast (<100ms) but Railway is slow:"
echo "  → Railway Singapore deployment might not be working"
echo "  → Or you're very far from Railway's Singapore region"
echo ""
