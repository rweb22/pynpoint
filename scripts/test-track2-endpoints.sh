#!/bin/bash

# Test Track 2: DIGIPIN Endpoints
# Usage: ./scripts/test-track2-endpoints.sh <API_KEY>

set -e

API_KEY="${1}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-track2-endpoints.sh <API_KEY>"
  exit 1
fi

echo "🔷 Testing Track 2: DIGIPIN Solo Operations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base URL: $BASE_URL"
echo "API Key: ${API_KEY:0:20}..."
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to make API call and measure latency
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  
  echo -e "${BLUE}━━━ $name ━━━${NC}"
  
  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n__TIME__:%{time_total}\n__STATUS__:%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint" 2>&1)
  else
    response=$(curl -s -w "\n__TIME__:%{time_total}\n__STATUS__:%{http_code}" \
      -H "Authorization: Bearer $API_KEY" \
      "$BASE_URL$endpoint" 2>&1)
  fi
  
  # Extract time and status
  time=$(echo "$response" | grep "__TIME__:" | cut -d: -f2)
  status=$(echo "$response" | grep "__STATUS__:" | cut -d: -f2)
  body=$(echo "$response" | grep -v "__TIME__:" | grep -v "__STATUS__:")
  
  # Convert to milliseconds
  time_ms=$(echo "$time * 1000" | bc)
  
  # Color based on status
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    status_color=$GREEN
  else
    status_color=$RED
  fi
  
  # Color based on latency
  if (( $(echo "$time_ms < 50" | bc -l) )); then
    latency_color=$GREEN
  elif (( $(echo "$time_ms < 200" | bc -l) )); then
    latency_color=$YELLOW
  else
    latency_color=$RED
  fi
  
  echo -e "Status: ${status_color}$status${NC}"
  echo -e "Latency: ${latency_color}${time_ms}ms${NC}"
  echo "Response:"
  echo "$body" | jq . 2>/dev/null || echo "$body"
  echo ""
}

# Test 1: Encode - Delhi coordinates to DIGIPIN
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 1: POST /digipin/encode (Coordinates → DIGIPIN)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Encode Delhi coordinates" "POST" "/api/v1/digipin/encode" \
  '{
    "coordinates": [
      {"latitude": 28.6139, "longitude": 77.2090},
      {"latitude": 19.0760, "longitude": 72.8777}
    ],
    "level": 6
  }'

# Test 2: Decode - DIGIPIN to coordinates
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 2: POST /digipin/decode (DIGIPIN → Coordinates)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# First, get a DIGIPIN code from encode
echo "Getting a DIGIPIN code first..."
digipin_response=$(curl -s \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"coordinates": [{"latitude": 28.6139, "longitude": 77.2090}], "level": 6}' \
  "$BASE_URL/api/v1/digipin/encode")

digipin_code=$(echo "$digipin_response" | jq -r '.results[0].digipinCode')
echo "Got DIGIPIN code: $digipin_code"
echo ""

test_endpoint "Decode DIGIPIN to coordinates" "POST" "/api/v1/digipin/decode" \
  "{\"digipinCodes\": [\"$digipin_code\"]}"

# Test 3: Get Cell Details
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 3: GET /digipin/:code (Cell Details)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get cell details for $digipin_code" "GET" "/api/v1/digipin/$digipin_code"

# Test 4: Get Neighbors
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 4: GET /digipin/neighbors/:code (8 Neighbors)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get neighbors of $digipin_code" "GET" "/api/v1/digipin/neighbors/$digipin_code"

# Test 5: Get Nearby Cells
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 5: GET /digipin/nearby (Cells Within Radius)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get nearby cells (Delhi, 5km radius)" "GET" \
  "/api/v1/digipin/nearby?lat=28.6139&lng=77.2090&radius=5&level=6"

# Test 6: Get Parent Cell
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 6: GET /digipin/:code/parent (Parent Cell)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get parent of $digipin_code" "GET" "/api/v1/digipin/$digipin_code/parent"

# Test 7: Get Children Cells
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 7: GET /digipin/:code/children (16 Children in 4x4 Grid)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get children of $digipin_code" "GET" "/api/v1/digipin/$digipin_code/children"

# Test 8: Get Ancestors
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 8: GET /digipin/:code/ancestors (Complete Hierarchy)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get ancestors of $digipin_code" "GET" "/api/v1/digipin/$digipin_code/ancestors"

# Test 9: Test with Level 1 Cell (should error on parent)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 9: Edge Case - Parent of Level 1 (Should Error)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
# Get a level 1 code
level1_code=$(echo "$digipin_code" | cut -c1)
test_endpoint "Get parent of level 1 cell: $level1_code (expect error)" "GET" "/api/v1/digipin/$level1_code/parent"

# NEGATIVE TESTS - Error Handling
echo ""
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}NEGATIVE TESTS - Error Handling Validation${NC}"
echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Function to test error endpoints
test_error_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local data="$4"
  local expected_status="$5"

  echo -e "${BLUE}━━━ $name ━━━${NC}"
  echo "Expected Status: $expected_status"

  if [ "$method" = "POST" ]; then
    response=$(curl -s -w "\n__TIME__:%{time_total}\n__STATUS__:%{http_code}" \
      -X POST \
      -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint" 2>&1)
  else
    response=$(curl -s -w "\n__TIME__:%{time_total}\n__STATUS__:%{http_code}" \
      -H "Authorization: Bearer $API_KEY" \
      "$BASE_URL$endpoint" 2>&1)
  fi

  status=$(echo "$response" | grep "__STATUS__:" | cut -d: -f2)
  body=$(echo "$response" | grep -v "__TIME__:" | grep -v "__STATUS__:")

  if [ "$status" = "$expected_status" ]; then
    echo -e "Status: ${GREEN}$status ✅ PASS${NC}"
  else
    echo -e "Status: ${RED}$status ❌ FAIL (expected $expected_status)${NC}"
  fi

  echo "Response:"
  echo "$body" | jq . 2>/dev/null || echo "$body"
  echo ""
}

# Negative Test 1: Encode with Invalid Coordinates (latitude > 90)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N1: Encode - Invalid Coordinates (Latitude > 90)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/encode (lat=200)" "POST" "/api/v1/digipin/encode" \
  '{"coordinates": [{"latitude": 200, "longitude": 77.2090}], "level": 6}' "400"

# Negative Test 2: Encode with Invalid Level (level > 10)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N2: Encode - Invalid Level (Level > 10)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/encode (level=15)" "POST" "/api/v1/digipin/encode" \
  '{"coordinates": [{"latitude": 28.6139, "longitude": 77.2090}], "level": 15}' "400"

# Negative Test 3: Encode with Invalid Level (level = 0)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N3: Encode - Invalid Level (Level = 0)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/encode (level=0)" "POST" "/api/v1/digipin/encode" \
  '{"coordinates": [{"latitude": 28.6139, "longitude": 77.2090}], "level": 0}' "400"

# Negative Test 4: Encode with Missing Coordinates Field
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N4: Encode - Missing Required Field (coordinates)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/encode (no coordinates)" "POST" "/api/v1/digipin/encode" \
  '{"level": 6}' "400"

# Negative Test 5: Encode with Empty Coordinates Array
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N5: Encode - Empty Coordinates Array${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/encode (empty array)" "POST" "/api/v1/digipin/encode" \
  '{"coordinates": [], "level": 6}' "400"

# Negative Test 6: Encode with String Instead of Number for Latitude
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N6: Encode - Invalid Data Type (latitude as string)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/encode (string lat)" "POST" "/api/v1/digipin/encode" \
  '{"coordinates": [{"latitude": "invalid", "longitude": 77.2090}], "level": 6}' "400"

# Negative Test 7: Decode with Invalid DIGIPIN Code
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N7: Decode - Invalid DIGIPIN Code (Invalid Characters)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/decode (invalid code)" "POST" "/api/v1/digipin/decode" \
  '{"digipinCodes": ["INVALID123"]}' "400"

# Negative Test 8: Decode with Empty Array
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N8: Decode - Empty DIGIPIN Codes Array${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/decode (empty array)" "POST" "/api/v1/digipin/decode" \
  '{"digipinCodes": []}' "400"

# Negative Test 9: To-Pincode with Invalid DIGIPIN
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N9: To-Pincode - Invalid DIGIPIN Format${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/digipin/to-pincode (invalid)" "POST" "/api/v1/digipin/to-pincode" \
  '{"digipinCode": "ZZZZZ"}' "400"

# Negative Test 10: Nearby with Invalid Radius (negative)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N10: Nearby - Invalid Radius (Negative Value)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "GET /api/v1/digipin/nearby (negative radius)" "GET" \
  "/api/v1/digipin/nearby?lat=28.6139&lng=77.2090&radius=-5&level=6" "400"

# Negative Test 11: Nearby with Out-of-Range Latitude
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N11: Nearby - Out-of-Range Latitude${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "GET /api/v1/digipin/nearby (lat > 90)" "GET" \
  "/api/v1/digipin/nearby?lat=100&lng=77.2090&radius=5&level=6" "400"

# Negative Test 12: Missing API Key
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N12: Missing API Key (Unauthorized)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}━━━ POST /api/v1/digipin/encode (No Auth) ━━━${NC}"
echo "Expected Status: 401"
response=$(curl -s -w "\n__STATUS__:%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"coordinates": [{"latitude": 28.6139, "longitude": 77.2090}], "level": 6}' \
  "$BASE_URL/api/v1/digipin/encode" 2>&1)
status=$(echo "$response" | grep "__STATUS__:" | cut -d: -f2)
body=$(echo "$response" | grep -v "__STATUS__:")
if [ "$status" = "401" ]; then
  echo -e "Status: ${GREEN}$status ✅ PASS${NC}"
else
  echo -e "Status: ${RED}$status ❌ FAIL (expected 401)${NC}"
fi
echo "Response:"
echo "$body" | jq . 2>/dev/null || echo "$body"
echo ""

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Track 2 Testing Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Positive Tests: 9 tests"
echo "  Negative Tests: 12 tests"
echo "  Total: 21 tests"
echo ""
