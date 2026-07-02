#!/bin/bash

# Set Unlimited Rate Limits for Load Testing
#
# Usage: ./scripts/set-unlimited-rate-limit.sh <API_KEY_ID>
#
# This script updates an API key's rate limit overrides to allow
# unlimited requests for load testing purposes.

set -e

API_KEY_ID="${1}"
ADMIN_SECRET="${ADMIN_API_SECRET:-ggcFKkg++qyJj586LxEGuDrh8xDSZtJp+VmQtI2YVJs=}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$API_KEY_ID" ]; then
  echo "❌ Error: API key ID required"
  echo "Usage: ./scripts/set-unlimited-rate-limit.sh <API_KEY_ID>"
  echo ""
  echo "To find your API key ID:"
  echo "  curl -H \"X-Admin-Secret: \$ADMIN_API_SECRET\" $BASE_URL/api/v1/admin/api-keys | jq"
  exit 1
fi

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 Setting Unlimited Rate Limits for Load Testing${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Base URL: $BASE_URL"
echo "API Key ID: $API_KEY_ID"
echo ""

# Update rate limits
echo -e "${YELLOW}Updating rate limits...${NC}"
response=$(curl -s -X PUT \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tier": "enterprise",
    "rateLimitOverrides": {
      "requests_per_minute": 100000,
      "requests_per_day": 10000000
    }
  }' \
  "$BASE_URL/api/v1/admin/api-keys/$API_KEY_ID/tier")

echo "$response" | jq .

echo ""
echo -e "${GREEN}✅ Rate limits updated successfully!${NC}"
echo ""
echo -e "${YELLOW}New limits:${NC}"
echo "  - Requests per minute: 100,000"
echo "  - Requests per day:    10,000,000"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
