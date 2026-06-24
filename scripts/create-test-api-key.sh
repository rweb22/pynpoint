#!/bin/bash

# Create a test API key for Track 1 testing
# Usage: ADMIN_API_SECRET=<secret> ./scripts/create-test-api-key.sh

set -e

ADMIN_SECRET="${ADMIN_API_SECRET}"
BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"

if [ -z "$ADMIN_SECRET" ]; then
  echo "❌ Error: ADMIN_API_SECRET environment variable required"
  echo "Usage: ADMIN_API_SECRET=<secret> ./scripts/create-test-api-key.sh"
  echo ""
  echo "The ADMIN_API_SECRET is configured in Railway's environment variables."
  exit 1
fi

echo "🔑 Creating test API key..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base URL: $BASE_URL"
echo "Admin Secret: ${ADMIN_SECRET:0:10}..."
echo ""

# Create API key
response=$(curl -s -w "\n__STATUS__:%{http_code}" \
  -X POST \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "externalCustomerId": "test-user-track1",
    "tier": "pro",
    "environment": "live"
  }' \
  "$BASE_URL/api/v1/admin/api-keys" 2>&1)

# Extract status
status=$(echo "$response" | grep "__STATUS__:" | cut -d: -f2)
body=$(echo "$response" | grep -v "__STATUS__:")

echo "Status: $status"
echo ""

if [ "$status" = "201" ] || [ "$status" = "200" ]; then
  echo "✅ API Key Created Successfully!"
  echo ""
  echo "$body" | jq .
  echo ""
  
  # Extract and display just the key
  api_key=$(echo "$body" | jq -r '.key')
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔑 Your API Key (store this securely!):"
  echo "$api_key"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "To test Track 1 endpoints, run:"
  echo "./scripts/test-track1-endpoints.sh $api_key"
else
  echo "❌ Failed to create API key"
  echo ""
  echo "$body" | jq . 2>/dev/null || echo "$body"
fi
