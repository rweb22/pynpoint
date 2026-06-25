#!/bin/bash

# Load Testing Script for PinPoint India API
# Tests concurrent request handling capacity
#
# Usage: ./scripts/load-test.sh <API_KEY> [tool]
#
# Supported tools:
#   - ab (ApacheBench) - Default, simple HTTP benchmarking
#   - hey - Modern HTTP load generator
#   - wrk - Modern HTTP benchmarking tool
#   - autocannon - Node.js based load testing

set -e

API_KEY="${1}"
TOOL="${2:-ab}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./scripts/load-test.sh <API_KEY> [tool]"
  echo ""
  echo "Available tools: ab, hey, wrk, autocannon"
  exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔥 PinPoint India - Load Testing${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Base URL: $BASE_URL"
echo "Tool: $TOOL"
echo "API Key: ${API_KEY:0:20}..."
echo ""

# Test endpoint
ENDPOINT="/api/v1/pincodes/110001"
FULL_URL="$BASE_URL$ENDPOINT"

# Create temp file for headers
HEADER_FILE=$(mktemp)
echo "Authorization: Bearer $API_KEY" > "$HEADER_FILE"

case "$TOOL" in
  ab)
    echo -e "${YELLOW}Testing with ApacheBench (ab)${NC}"
    echo ""
    
    if ! command -v ab &> /dev/null; then
      echo -e "${RED}❌ ApacheBench (ab) not found${NC}"
      echo "Install: sudo apt-get install apache2-utils  # Ubuntu/Debian"
      echo "         brew install httpd                   # macOS"
      exit 1
    fi
    
    echo -e "${GREEN}Test 1: Warm-up (10 requests, 1 concurrent)${NC}"
    ab -n 10 -c 1 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 2: Light Load (100 requests, 10 concurrent)${NC}"
    ab -n 100 -c 10 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 3: Medium Load (500 requests, 50 concurrent)${NC}"
    ab -n 500 -c 50 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 4: Heavy Load (1000 requests, 100 concurrent)${NC}"
    ab -n 1000 -c 100 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 5: Stress Test (2000 requests, 200 concurrent)${NC}"
    ab -n 2000 -c 200 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    ;;
    
  hey)
    echo -e "${YELLOW}Testing with hey${NC}"
    echo ""
    
    if ! command -v hey &> /dev/null; then
      echo -e "${RED}❌ hey not found${NC}"
      echo "Install: go install github.com/rakyll/hey@latest"
      exit 1
    fi
    
    echo -e "${GREEN}Test 1: Warm-up (10 requests, 1 worker)${NC}"
    hey -n 10 -c 1 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 2: Light Load (100 requests, 10 workers)${NC}"
    hey -n 100 -c 10 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 3: Medium Load (500 requests, 50 workers)${NC}"
    hey -n 500 -c 50 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 4: Heavy Load (1000 requests, 100 workers)${NC}"
    hey -n 1000 -c 100 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 5: Stress Test (2000 requests, 200 workers)${NC}"
    hey -n 2000 -c 200 -H "Authorization: Bearer $API_KEY" "$FULL_URL"
    ;;
    
  wrk)
    echo -e "${YELLOW}Testing with wrk${NC}"
    echo ""
    
    if ! command -v wrk &> /dev/null; then
      echo -e "${RED}❌ wrk not found${NC}"
      echo "Install: sudo apt-get install wrk           # Ubuntu/Debian"
      echo "         brew install wrk                    # macOS"
      exit 1
    fi
    
    # Create Lua script for wrk
    WRK_SCRIPT=$(mktemp)
    cat > "$WRK_SCRIPT" << EOF
wrk.method = "GET"
wrk.headers["Authorization"] = "Bearer $API_KEY"
EOF
    
    echo -e "${GREEN}Test 1: Light Load (10s duration, 10 connections, 2 threads)${NC}"
    wrk -t2 -c10 -d10s -s "$WRK_SCRIPT" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 2: Medium Load (30s duration, 50 connections, 4 threads)${NC}"
    wrk -t4 -c50 -d30s -s "$WRK_SCRIPT" "$FULL_URL"
    
    echo ""
    echo -e "${GREEN}Test 3: Heavy Load (30s duration, 100 connections, 8 threads)${NC}"
    wrk -t8 -c100 -d30s -s "$WRK_SCRIPT" "$FULL_URL"
    
    rm -f "$WRK_SCRIPT"
    ;;
    
  *)
    echo -e "${RED}❌ Unknown tool: $TOOL${NC}"
    echo "Available tools: ab, hey, wrk"
    exit 1
    ;;
esac

# Cleanup
rm -f "$HEADER_FILE"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Load Testing Complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
