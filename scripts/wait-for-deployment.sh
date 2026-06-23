#!/bin/bash

# Wait for Railway deployment to complete
# Usage: ./scripts/wait-for-deployment.sh

BASE_URL="${BASE_URL:-https://pynpoint-production.up.railway.app}"
MAX_WAIT=300  # 5 minutes
INTERVAL=10   # Check every 10 seconds

echo "🔄 Waiting for deployment to complete..."
echo "URL: $BASE_URL/health"
echo "Max wait: ${MAX_WAIT}s"
echo ""

elapsed=0
while [ $elapsed -lt $MAX_WAIT ]; do
  echo -n "Attempt $((elapsed / INTERVAL + 1)): "
  
  # Try to hit the health endpoint
  response=$(curl -s --max-time 5 "$BASE_URL/health" 2>&1)
  exit_code=$?
  
  if [ $exit_code -eq 0 ] && echo "$response" | jq . >/dev/null 2>&1; then
    echo "✅ Service is UP!"
    echo ""
    echo "Health response:"
    echo "$response" | jq .
    exit 0
  else
    echo "⏳ Not ready yet (waited ${elapsed}s)..."
    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  fi
done

echo ""
echo "❌ Deployment did not complete within ${MAX_WAIT}s"
echo "Last response: $response"
exit 1
