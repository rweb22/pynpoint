#!/bin/bash

# DNS Fallback Helper
# Usage: source this file before running curl commands
#
# This script resolves the hostname using Google DNS (8.8.8.8) and creates a
# DNS_RESOLVE variable that can be used with curl's --resolve option.
#
# Example:
#   source scripts/dns-fallback.sh
#   curl $DNS_RESOLVE https://example.com/api

if [ -z "$BASE_URL" ]; then
  echo "Error: BASE_URL must be set before sourcing dns-fallback.sh"
  exit 1
fi

# Extract hostname from BASE_URL
HOSTNAME=$(echo "$BASE_URL" | sed 's|https://||' | sed 's|http://||' | cut -d/ -f1)

# Try to resolve using Google DNS
RESOLVED_IP=$(host "$HOSTNAME" 8.8.8.8 2>/dev/null | grep "has address" | head -1 | awk '{print $NF}')

if [ -n "$RESOLVED_IP" ]; then
  echo "✓ Resolved $HOSTNAME to $RESOLVED_IP via Google DNS"
  export DNS_RESOLVE="--resolve $HOSTNAME:443:$RESOLVED_IP"
else
  echo "⚠ Could not resolve hostname via Google DNS, proceeding without manual DNS resolution"
  export DNS_RESOLVE=""
fi
