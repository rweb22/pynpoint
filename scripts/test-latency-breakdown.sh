#!/bin/bash

# Test latency breakdown to see where time is spent
# Usage: ./scripts/test-latency-breakdown.sh <API_KEY>

API_KEY="${1}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-latency-breakdown.sh <API_KEY>"
  exit 1
fi

echo "🔍 Testing Latency Breakdown"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base URL: $BASE_URL"
echo ""

for i in {1..5}; do
  echo "Request $i:"
  curl -w "  DNS Lookup:    %{time_namelookup}s\n  TCP Connect:   %{time_connect}s\n  TLS Handshake: %{time_appconnect}s\n  Server Process:%{time_starttransfer}s\n  Total Time:    %{time_total}s\n" \
    -H "Authorization: Bearer $API_KEY" \
    -s -o /dev/null \
    "$BASE_URL/api/v1/pincodes/110001"
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Latency Breakdown Explanation:"
echo ""
echo "  DNS Lookup:    Time to resolve hostname to IP"
echo "  TCP Connect:   Time to establish TCP connection"
echo "  TLS Handshake: Time to complete SSL/TLS handshake"
echo "  Server Process:Time until first byte received (includes server processing)"
echo "  Total Time:    Complete request time"
echo ""
echo "🎯 What We Expect:"
echo "  - DNS Lookup:    0-50ms (cached after first request)"
echo "  - TCP Connect:   50-200ms (depends on geographic distance)"
echo "  - TLS Handshake: 100-300ms (only first request, then reused)"
echo "  - Server Process:1-10ms (should be very fast with cache!)"
echo "  - Total Time:    200-500ms first request, 1-10ms cached"
echo ""
