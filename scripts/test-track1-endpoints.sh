#!/bin/bash

# Test Track 1 Endpoints with Latency Measurements
# Usage: ./scripts/test-track1-endpoints.sh <API_KEY>

set -e

API_KEY="${1}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/test-track1-endpoints.sh <API_KEY>"
  echo ""
  echo "To generate an API key, run:"
  echo "curl -X POST $BASE_URL/admin/api-keys \\"
  echo "  -H 'X-Admin-Secret: \$ADMIN_API_SECRET' \\"
  echo "  -H 'Content-Type: application/json' \\"
  echo "  -d '{\"externalCustomerId\":\"test-user-001\",\"tier\":\"free\"}'"
  exit 1
fi

echo "🚀 Testing Track 1: Pincode Solo Operations"
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

# Test 0: Root endpoint (no auth required)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 0: Root Endpoint (Public)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
response=$(curl -s -w "\n__TIME__:%{time_total}\n__STATUS__:%{http_code}" "$BASE_URL/" 2>&1)
time=$(echo "$response" | grep "__TIME__:" | cut -d: -f2)
status=$(echo "$response" | grep "__STATUS__:" | cut -d: -f2)
body=$(echo "$response" | grep -v "__TIME__:" | grep -v "__STATUS__:")
time_ms=$(echo "$time * 1000" | bc)
echo -e "Status: ${GREEN}$status${NC}"
echo -e "Latency: ${GREEN}${time_ms}ms${NC}"
echo "Response:"
echo "$body" | jq . 2>/dev/null || echo "$body"
echo ""

# Test 1: Single Pincode Lookup
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 1: Single Pincode Lookup${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "GET /api/v1/pincodes/110001" "GET" "/api/v1/pincodes/110001"

# Test 2: Search Pincodes by State
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 2: Search Pincodes by State${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "GET /api/v1/pincodes?state=Delhi&limit=5" "GET" "/api/v1/pincodes?state=Delhi&limit=5"

# Test 3: Bulk Pincode Lookup
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 3: Bulk Pincode Lookup${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "POST /api/v1/pincodes/bulk/lookup" "POST" "/api/v1/pincodes/bulk/lookup" \
  '{"pincodes":["110001","400001","560001"]}'

# Test 4: List All States
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 4: List All States${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "GET /api/v1/administrative/states" "GET" "/api/v1/administrative/states"

# Test 5: Get State Details
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 5: Get State Details (Delhi)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "GET /api/v1/administrative/states/DL" "GET" "/api/v1/administrative/states/DL"

# Test 6: List Districts
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Test 6: List Districts (Delhi)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_endpoint "GET /api/v1/administrative/districts?state=Delhi&limit=10" "GET" "/api/v1/administrative/districts?state=Delhi&limit=10"

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

# Negative Test 1: Invalid Pincode Format (non-numeric)
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N1: Invalid Pincode Format (Non-numeric)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "GET /api/v1/pincodes/ABC123" "GET" "/api/v1/pincodes/ABC123" "" "400"

# Negative Test 2: Non-existent Pincode
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N2: Non-existent Pincode${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "GET /api/v1/pincodes/999999" "GET" "/api/v1/pincodes/999999" "" "404"

# Negative Test 3: Invalid Pincode Length
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N3: Invalid Pincode Length (Too Short)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "GET /api/v1/pincodes/123" "GET" "/api/v1/pincodes/123" "" "400"

# Negative Test 4: Missing API Key
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N4: Missing API Key (Unauthorized)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}━━━ GET /api/v1/pincodes/110001 (No Auth) ━━━${NC}"
echo "Expected Status: 401"
response=$(curl -s -w "\n__STATUS__:%{http_code}" "$BASE_URL/api/v1/pincodes/110001" 2>&1)
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

# Negative Test 5: Bulk Lookup with Invalid Data Type
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N5: Bulk Lookup - Invalid Data Type${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/pincodes/bulk/lookup (string instead of array)" "POST" \
  "/api/v1/pincodes/bulk/lookup" '{"pincodes":"not-an-array"}' "400"

# Negative Test 6: Reverse Geocode with Invalid Coordinates
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N6: Reverse Geocode - Invalid Coordinates (Out of Range)${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "POST /api/v1/pincodes/reverse-geocode (lat > 90)" "POST" \
  "/api/v1/pincodes/reverse-geocode" '{"latitude":200,"longitude":400}' "400"

# Negative Test 7: Invalid State Code
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}N7: Administrative - Invalid State Code${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
test_error_endpoint "GET /api/v1/administrative/states/INVALID" "GET" "/api/v1/administrative/states/INVALID" "" "404"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Track 1 Testing Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Summary:${NC}"
echo "  Positive Tests: 6 tests"
echo "  Negative Tests: 7 tests"
echo "  Total: 13 tests"
echo ""
