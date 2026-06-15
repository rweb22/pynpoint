#!/bin/bash

# Test Track 4: Conversion & Hybrid Operations
# Usage: ./scripts/test-track4-endpoints.sh <API_KEY>

set -e

API_KEY="${1}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-track4-endpoints.sh <API_KEY>"
  exit 1
fi

echo "🔀 Testing Track 4: Hybrid & Conversion Operations"
echo "═══════════════════════════════════════════════════════════════════════════════════"
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
  
  echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
  echo -e "${BLUE}$name${NC}"
  echo -e "${BLUE}───────────────────────────────────────────────────────────────────────────────────${NC}"
  
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

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}STACK 1: PINCODE-CENTRIC CONVERSIONS (4 endpoints)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 1: Pincode → H3
echo -e "${YELLOW}Test 1: GET /convert/pincode-to-h3/:pincode${NC}"
test_endpoint "Convert Pincode 110001 to H3 cells (resolution 9)" "GET" \
  "/api/v1/convert/pincode-to-h3/110001?resolution=9"

# Test 2: H3 → Pincode
echo -e "${YELLOW}Test 2: GET /convert/h3-to-pincode/:h3Index${NC}"
echo "First, get an H3 index from the previous response..."
h3_response=$(curl -s \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/v1/convert/pincode-to-h3/110001?resolution=9")

h3_index=$(echo "$h3_response" | jq -r '.primaryHexagon')
echo "Using H3 index: $h3_index"
echo ""

test_endpoint "Convert H3 $h3_index to pincode(s)" "GET" \
  "/api/v1/convert/h3-to-pincode/$h3_index"

# Test 3: Pincode → DIGIPIN
echo -e "${YELLOW}Test 3: GET /convert/pincode-to-digipin/:pincode${NC}"
test_endpoint "Convert Pincode 110001 to DIGIPIN cells (level 6)" "GET" \
  "/api/v1/convert/pincode-to-digipin/110001?level=6"

# Test 4: DIGIPIN → Pincode
echo -e "${YELLOW}Test 4: GET /convert/digipin-to-pincode/:digipinCode${NC}"
echo "First, get a DIGIPIN code from the previous response..."
digipin_response=$(curl -s \
  -H "Authorization: Bearer $API_KEY" \
  "$BASE_URL/api/v1/convert/pincode-to-digipin/110001?level=6")

digipin_code=$(echo "$digipin_response" | jq -r '.primaryDigipin')
echo "Using DIGIPIN code: $digipin_code"
echo ""

test_endpoint "Convert DIGIPIN $digipin_code to pincode(s)" "GET" \
  "/api/v1/convert/digipin-to-pincode/$digipin_code"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}STACK 2: DIGIPIN-H3 BRIDGE (2 endpoints)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 5: H3 → DIGIPIN
echo -e "${YELLOW}Test 5: GET /convert/h3-to-digipin/:h3Index${NC}"
test_endpoint "Convert H3 $h3_index to DIGIPIN (level 6)" "GET" \
  "/api/v1/convert/h3-to-digipin/$h3_index?level=6"

# Test 6: DIGIPIN → H3
echo -e "${YELLOW}Test 6: GET /convert/digipin-to-h3/:digipinCode${NC}"
test_endpoint "Convert DIGIPIN $digipin_code to H3 cells (resolution 9)" "GET" \
  "/api/v1/convert/digipin-to-h3/$digipin_code?resolution=9"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}STACK 3: ADVANCED/BULK OPERATIONS (4 endpoints)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo ""

# Test 7: Bulk Pincode → H3
echo -e "${YELLOW}Test 7: POST /convert/bulk/pincode-to-h3${NC}"
test_endpoint "Bulk convert 3 pincodes to H3" "POST" "/api/v1/convert/bulk/pincode-to-h3" \
  '{"pincodes": ["110001", "400001", "560001"], "resolution": 9}'

# Test 8: Bulk H3 → Pincode
echo -e "${YELLOW}Test 8: POST /convert/bulk/h3-to-pincode${NC}"
echo "Getting multiple H3 indexes..."
h3_list=$(echo "$h3_response" | jq -r '.h3Indexes[0:3] | @json')
echo "Using H3 indexes: $h3_list"
echo ""

test_endpoint "Bulk convert 3 H3 cells to pincodes" "POST" "/api/v1/convert/bulk/h3-to-pincode" \
  "{\"h3Indexes\": $h3_list}"

# Test 9: Spatial Intersection
echo -e "${YELLOW}Test 9: GET /spatial/intersection${NC}"
test_endpoint "Check if coordinate (28.6139, 77.2090) is inside 110001" "GET" \
  "/api/v1/spatial/intersection?pincode=110001&lat=28.6139&lng=77.2090"

# Test 10: Polygon Search
echo -e "${YELLOW}Test 10: POST /spatial/polygon-search${NC}"
test_endpoint "Find pincodes in custom polygon (Delhi area)" "POST" "/api/v1/spatial/polygon-search" \
  '{
    "polygon": {
      "type": "Polygon",
      "coordinates": [
        [[77.1, 28.5], [77.3, 28.5], [77.3, 28.7], [77.1, 28.7], [77.1, 28.5]]
      ]
    },
    "includeH3": true,
    "includeDigipin": true,
    "h3Resolution": 9,
    "digipinLevel": 6
  }'

echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Track 4 Testing Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════════════${NC}"
