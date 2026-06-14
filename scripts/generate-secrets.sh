#!/bin/bash

# Generate Secrets for PinPoint API
# 
# This script generates cryptographically secure random secrets
# for use in production deployment.
#
# Usage:
#   chmod +x scripts/generate-secrets.sh
#   ./scripts/generate-secrets.sh
#
# Output: Copy-paste ready environment variables for Railway

set -e

echo "🔐 Generating Secrets for PinPoint API"
echo "========================================"
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo "❌ Error: openssl is not installed"
    echo "   Install it with: brew install openssl (macOS) or apt-get install openssl (Linux)"
    exit 1
fi

echo "✅ Generating ADMIN_API_SECRET (32 bytes)..."
ADMIN_SECRET=$(openssl rand -base64 32)

echo "✅ Generating JWT_SECRET (32 bytes)..."
JWT_SECRET=$(openssl rand -base64 32)

echo "✅ Generating API_KEY_SALT (16 bytes)..."
API_KEY_SALT=$(openssl rand -base64 16)

echo ""
echo "✅ Secrets generated successfully!"
echo ""
echo "========================================"
echo "Copy these to your Railway environment variables:"
echo "========================================"
echo ""
echo "ADMIN_API_SECRET=$ADMIN_SECRET"
echo "JWT_SECRET=$JWT_SECRET"
echo "API_KEY_SALT=$API_KEY_SALT"
echo ""
echo "========================================"
echo "⚠️  SECURITY WARNINGS:"
echo "========================================"
echo "1. ❌ NEVER commit these secrets to git"
echo "2. ❌ NEVER share these secrets publicly"
echo "3. ✅ Mark as 'secret' in Railway dashboard"
echo "4. ✅ Rotate every 90 days"
echo "5. ✅ Use different secrets for dev/staging/prod"
echo ""
echo "📝 For local development, copy to .env file"
echo "📝 For Railway, paste into Environment Variables section"
echo ""
