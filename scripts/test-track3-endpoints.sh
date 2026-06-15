#!/bin/bash

# Test Track 3: H3 Endpoints
# Usage: ./scripts/test-track3-endpoints.sh <API_KEY>

set -e

API_KEY="${1}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-track3-endpoints.sh <API_KEY>"
  exit 1
fi

echo "🔶 Testing Track 3: H3 Solo Operations"
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

# Test 1: Encode - Delhi coordinates to H3
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 1: POST /h3/encode (Coordinates → H3)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Encode Delhi coordinates to H3" "POST" "/api/v1/h3/encode" \
  '{
    "coordinates": [
      {"latitude": 28.6139, "longitude": 77.2090},
      {"latitude": 19.0760, "longitude": 72.8777}
    ],
    "resolution": 9
  }'

# Test 2: Decode - H3 to coordinates
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 2: POST /h3/decode (H3 → Coordinates)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# First, get an H3 index from encode
echo "Getting an H3 index first..."
h3_response=$(curl -s \
  -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"coordinates": [{"latitude": 28.6139, "longitude": 77.2090}], "resolution": 9}' \
  "$BASE_URL/api/v1/h3/encode")

h3_index=$(echo "$h3_response" | jq -r '.results[0].h3Index')
echo "Got H3 index: $h3_index"
echo ""

test_endpoint "Decode H3 to coordinates" "POST" "/api/v1/h3/decode" \
  "{\"h3Indices\": [\"$h3_index\"]}"

# Test 3: Get Cell Details
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 3: GET /h3/:h3Index (Cell Details)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get cell details for $h3_index" "GET" "/api/v1/h3/$h3_index"

# Test 4: Get Neighbors
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 4: GET /h3/neighbors/:h3Index (6 Neighbors)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get neighbors of $h3_index" "GET" "/api/v1/h3/neighbors/$h3_index"

# Test 5: Get Nearby Cells
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 5: GET /h3/nearby (Cells Within Radius)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "Get nearby cells (Delhi, 5km radius)" "GET" \
  "/api/v1/h3/nearby?lat=28.6139&lng=77.2090&radius=5&resolution=9"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Track 3 Testing Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
