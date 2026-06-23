#!/bin/bash

# Test Track 3: Distance Operations
# Usage: ./scripts/test-track3-endpoints.sh <API_KEY>

set -e

API_KEY="${1}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-track3-endpoints.sh <API_KEY>"
  exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📏 Testing Track 3: Distance Operations${NC}"
echo "═══════════════════════════════════════════════════════════════════════════════════"
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:20}..."
echo ""

# Test 1: Pincode to Pincode
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}Test 1: POST /distance/calculate (Pincode to Pincode)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Calculate distance: Delhi (110001) → Mumbai (400001)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" \
  -X POST "$BASE_URL/api/v1/distance/calculate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"pincode": "110001"},
    "to": {"pincode": "400001"},
    "unit": "km"
  }')

STATUS=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
LATENCY=$(echo "$RESPONSE" | tail -n 1 | awk '{printf "%.6fms", $1*1000}')
BODY=$(echo "$RESPONSE" | sed '$d' | sed '$d')

if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  echo -e "Status: ${GREEN}$STATUS${NC}"
else
  echo -e "Status: ${RED}$STATUS${NC}"
fi
echo -e "Latency: ${RED}$LATENCY${NC}"
echo "Response:"
echo "$BODY" | jq '.'
echo ""

# Test 2: DIGIPIN to DIGIPIN
echo -e "${YELLOW}Test 2: POST /distance/calculate (DIGIPIN to DIGIPIN)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Calculate distance between two DIGIPIN cells${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" \
  -X POST "$BASE_URL/api/v1/distance/calculate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"digipin": "M32M7L"},
    "to": {"digipin": "M3CHC9"},
    "unit": "km"
  }')

STATUS=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
LATENCY=$(echo "$RESPONSE" | tail -n 1 | awk '{printf "%.6fms", $1*1000}')
BODY=$(echo "$RESPONSE" | sed '$d' | sed '$d')

if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  echo -e "Status: ${GREEN}$STATUS${NC}"
else
  echo -e "Status: ${RED}$STATUS${NC}"
fi
echo -e "Latency: ${RED}$LATENCY${NC}"
echo "Response:"
echo "$BODY" | jq '.'
echo ""

# Test 3: H3 to H3 with grid distance
echo -e "${YELLOW}Test 3: POST /distance/calculate (H3 to H3 with grid distance)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Calculate distance between H3 hexagons with grid distance${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" \
  -X POST "$BASE_URL/api/v1/distance/calculate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"h3": "893da11401bffff"},
    "to": {"h3": "893da114003ffff"},
    "unit": "km",
    "includeGridDistance": true
  }')

STATUS=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
LATENCY=$(echo "$RESPONSE" | tail -n 1 | awk '{printf "%.6fms", $1*1000}')
BODY=$(echo "$RESPONSE" | sed '$d' | sed '$d')

if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  echo -e "Status: ${GREEN}$STATUS${NC}"
else
  echo -e "Status: ${RED}$STATUS${NC}"
fi
echo -e "Latency: ${RED}$LATENCY${NC}"
echo "Response:"
echo "$BODY" | jq '.'
echo ""

# Test 4: Coordinate to Pincode
echo -e "${YELLOW}Test 4: POST /distance/calculate (Coordinate to Pincode)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Calculate distance from coordinates to pincode${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" \
  -X POST "$BASE_URL/api/v1/distance/calculate" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "from": {"coordinate": {"lat": 28.6139, "lng": 77.2090}},
    "to": {"pincode": "560001"},
    "unit": "km"
  }')

STATUS=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
LATENCY=$(echo "$RESPONSE" | tail -n 1 | awk '{printf "%.6fms", $1*1000}')
BODY=$(echo "$RESPONSE" | sed '$d' | sed '$d')

if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  echo -e "Status: ${GREEN}$STATUS${NC}"
else
  echo -e "Status: ${RED}$STATUS${NC}"
fi
echo -e "Latency: ${RED}$LATENCY${NC}"
echo "Response:"
echo "$BODY" | jq '.'
echo ""

# Test 5: Batch distance calculation
echo -e "${YELLOW}Test 5: POST /distance/batch${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}Calculate distances for multiple pairs at once${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" \
  -X POST "$BASE_URL/api/v1/distance/batch" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pairs": [
      {"from": {"pincode": "110001"}, "to": {"pincode": "400001"}},
      {"from": {"pincode": "110001"}, "to": {"pincode": "560001"}},
      {"from": {"digipin": "M32M7L"}, "to": {"digipin": "M3CHC9"}}
    ],
    "unit": "km"
  }')

STATUS=$(echo "$RESPONSE" | tail -n 2 | head -n 1)
LATENCY=$(echo "$RESPONSE" | tail -n 1 | awk '{printf "%.6fms", $1*1000}')
BODY=$(echo "$RESPONSE" | sed '$d' | sed '$d')

if [ "$STATUS" = "201" ] || [ "$STATUS" = "200" ]; then
  echo -e "Status: ${GREEN}$STATUS${NC}"
else
  echo -e "Status: ${RED}$STATUS${NC}"
fi
echo -e "Latency: ${RED}$LATENCY${NC}"
echo "Response:"
echo "$BODY" | jq '.'
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Track 5 Testing Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════════${NC}"
