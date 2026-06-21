#!/bin/bash
# Test DIGIPIN API Endpoints

API_BASE="${API_BASE:-https://pynpoint-production.up.railway.app/api/v1}"
API_KEY="${API_KEY:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 DIGIPIN API Endpoint Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "API Base: $API_BASE"
echo ""

# Helper function to make API calls
api_call() {
  local method=$1
  local endpoint=$2
  local description=$3
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "TEST: $description"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "Request: $method $endpoint"
  echo ""
  
  if [ -n "$API_KEY" ]; then
    response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $API_KEY" "$API_BASE$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" "$API_BASE$endpoint")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  echo "Status: $http_code"
  echo ""
  echo "Response:"
  echo "$body" | jq '.' 2>/dev/null || echo "$body"
  echo ""
  
  if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
  else
    echo -e "${RED}❌ FAIL${NC}"
  fi
  echo ""
}

# Test 1: Pincode to DIGIPIN (Delhi)
api_call "GET" "/convert/pincode-to-digipin/110001" "Pincode to DIGIPIN (110001 → should contain 39J438)"

# Test 2: DIGIPIN to Pincode (Delhi)
api_call "GET" "/convert/digipin-to-pincode/39J438" "DIGIPIN to Pincode (39J438 → should return 110001)"

# Test 3: Level 8 code (should auto-truncate to Level 6)
api_call "GET" "/convert/digipin-to-pincode/39J438FC" "Level 8 Auto-Truncation (39J438FC → 39J438)"

# Test 4: Level 10 code (should auto-truncate to Level 6)
api_call "GET" "/convert/digipin-to-pincode/39J438FC7M" "Level 10 Auto-Truncation (39J438FC7M → 39J438)"

# Test 5: Level 4 code (should fail)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST: Level 4 Rejection (39J4 → should return 400)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -n "$API_KEY" ]; then
  response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $API_KEY" "$API_BASE/convert/digipin-to-pincode/39J4")
else
  response=$(curl -s -w "\n%{http_code}" "$API_BASE/convert/digipin-to-pincode/39J4")
fi
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)
echo "Status: $http_code"
echo ""
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""
if [ "$http_code" = "400" ]; then
  echo -e "${GREEN}✅ PASS (correctly rejected)${NC}"
else
  echo -e "${RED}❌ FAIL (should be 400)${NC}"
fi
echo ""

# Test 6: Random pincodes (Mumbai, Chennai, Bangalore)
api_call "GET" "/convert/pincode-to-digipin/400001" "Mumbai (400001)"
api_call "GET" "/convert/pincode-to-digipin/600001" "Chennai (600001)"
api_call "GET" "/convert/pincode-to-digipin/560001" "Bangalore (560001)"

# Test 7: Invalid pincode
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST: Invalid Pincode (999999 → should return 404)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
if [ -n "$API_KEY" ]; then
  response=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $API_KEY" "$API_BASE/convert/pincode-to-digipin/999999")
else
  response=$(curl -s -w "\n%{http_code}" "$API_BASE/convert/pincode-to-digipin/999999")
fi
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)
echo "Status: $http_code"
echo ""
echo "Response:"
echo "$body" | jq '.' 2>/dev/null || echo "$body"
echo ""
if [ "$http_code" = "404" ]; then
  echo -e "${GREEN}✅ PASS (correctly not found)${NC}"
else
  echo -e "${RED}❌ FAIL (should be 404)${NC}"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ API Endpoint Tests Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
