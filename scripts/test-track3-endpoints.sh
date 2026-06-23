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

# NEGATIVE TESTS - Error Handling
echo ""
echo -e "${RED}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${RED}NEGATIVE TESTS - Error Handling Validation${NC}"
echo -e "${RED}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Function to test error endpoints
test_error_endpoint() {
  local name="$1"
  local data="$2"
  local expected_status="$3"

  echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
  echo -e "${BLUE}$name${NC}"
  echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
  echo "Expected Status: $expected_status"

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$BASE_URL/api/v1/distance/calculate" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$data")

  STATUS=$(echo "$RESPONSE" | tail -n 1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$STATUS" = "$expected_status" ]; then
    echo -e "Status: ${GREEN}$STATUS ✅ PASS${NC}"
  else
    echo -e "Status: ${RED}$STATUS ❌ FAIL (expected $expected_status)${NC}"
  fi

  echo "Response:"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  echo ""
}

# Negative Test 1: Missing "from" field
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N1: Missing Required Field (from)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
test_error_endpoint "POST /distance/calculate (missing from)" \
  '{"to": {"pincode": "400001"}, "unit": "km"}' \
  "400"

# Negative Test 2: Missing "to" field
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N2: Missing Required Field (to)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
test_error_endpoint "POST /distance/calculate (missing to)" \
  '{"from": {"pincode": "110001"}, "unit": "km"}' \
  "400"

# Negative Test 3: Invalid point type
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N3: Invalid Point Type${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
test_error_endpoint "POST /distance/calculate (invalid type)" \
  '{"from": {"invalid": "type"}, "to": {"pincode": "400001"}, "unit": "km"}' \
  "400"

# Negative Test 4: Invalid unit
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N4: Invalid Distance Unit${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
test_error_endpoint "POST /distance/calculate (invalid unit)" \
  '{"from": {"pincode": "110001"}, "to": {"pincode": "400001"}, "unit": "invalid"}' \
  "400"

# Negative Test 5: Non-existent pincode
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N5: Non-existent Pincode${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
test_error_endpoint "POST /distance/calculate (non-existent pincode)" \
  '{"from": {"pincode": "999999"}, "to": {"pincode": "400001"}, "unit": "km"}' \
  "404"

# Negative Test 6: Invalid coordinate (latitude > 90)
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N6: Invalid Coordinates (Latitude > 90)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
test_error_endpoint "POST /distance/calculate (lat > 90)" \
  '{"from": {"latitude": 200, "longitude": 77.2090}, "to": {"pincode": "400001"}, "unit": "km"}' \
  "400"

# Negative Test 7: Empty batch array
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N7: Batch Calculate - Empty Array${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}POST /distance/batch (empty pairs)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo "Expected Status: 400"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/v1/distance/batch" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pairs": [], "unit": "km"}')
STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$STATUS" = "400" ]; then
  echo -e "Status: ${GREEN}$STATUS ✅ PASS${NC}"
else
  echo -e "Status: ${RED}$STATUS ❌ FAIL (expected 400)${NC}"
fi
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

# Negative Test 8: Missing API Key
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}N8: Missing API Key (Unauthorized)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo -e "${BLUE}POST /distance/calculate (No Auth)${NC}"
echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
echo "Expected Status: 401"
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "$BASE_URL/api/v1/distance/calculate" \
  -H "Content-Type: application/json" \
  -d '{"from": {"pincode": "110001"}, "to": {"pincode": "400001"}, "unit": "km"}')
STATUS=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')
if [ "$STATUS" = "401" ]; then
  echo -e "Status: ${GREEN}$STATUS ✅ PASS${NC}"
else
  echo -e "Status: ${RED}$STATUS ❌ FAIL (expected 401)${NC}"
fi
echo "Response:"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Track 3 Testing Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Positive Tests: 6 tests"
echo "  Negative Tests: 8 tests"
echo "  Total: 14 tests"
echo ""
