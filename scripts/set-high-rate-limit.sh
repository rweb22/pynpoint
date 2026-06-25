#!/bin/bash

# Set High Rate Limits for Load Testing
#
# Updates an API key with very high rate limits to allow proper load testing
# without hitting rate limit throttling.
#
# Usage: ./scripts/set-high-rate-limit.sh <API_KEY_ID> <ADMIN_SECRET>
#
# Example:
#   ./scripts/set-high-rate-limit.sh d8fc6825-290b-41a2-9f5b-3a130dabf592 ggcFKkg++...

set -e

API_KEY_ID="${1}"
ADMIN_SECRET="${2}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY_ID" ] || [ -z "$ADMIN_SECRET" ]; then
  echo "❌ Error: API key ID and admin secret required"
  echo "Usage: ./scripts/set-high-rate-limit.sh <API_KEY_ID> <ADMIN_SECRET>"
  echo ""
  echo "To get the API key ID:"
  echo "  1. Create a key with: curl -X POST \$BASE_URL/api/v1/admin/api-keys ..."
  echo "  2. Copy the 'id' field from the response"
  exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔧 Setting High Rate Limits for Load Testing${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Base URL: $BASE_URL"
echo "API Key ID: $API_KEY_ID"
echo ""

echo -e "${YELLOW}Setting rate limits:${NC}"
echo "  - Per Minute: 10,000,000 (10M)"
echo "  - Per Day: 100,000,000 (100M)"
echo ""

# Update the API key with high rate limits
# Keep the current tier, just update the rate limit overrides
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/admin/api-keys/$API_KEY_ID/tier" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "free",
    "rateLimitOverrides": {
      "requests_per_minute": 10000000,
      "requests_per_day": 100000000
    }
  }')

echo -e "${GREEN}✅ Response:${NC}"
echo "$RESPONSE" | jq .

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Rate limits updated successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}You can now run load tests without hitting rate limits:${NC}"
echo "  node scripts/load-test.js <API_KEY>"
echo ""
echo -e "${YELLOW}Note:${NC} The API key itself hasn't changed, only the rate limits."
echo "      Use the same key you were using before."
