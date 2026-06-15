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

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Track 2 Testing Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
