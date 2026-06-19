#!/bin/bash

# ============================================================
# H3 Index Accuracy Verification Runner
# ============================================================
# Run this script to verify the accuracy of H3→Pincode mappings
# ============================================================

echo ""
echo "============================================================"
echo "🔍 H3 Index Accuracy Verification"
echo "============================================================"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo ""
    echo "Set it with:"
    echo "  export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
    echo ""
    exit 1
fi

echo "✅ Database URL found"
echo ""

# Run SQL verification tests
echo "📊 Running SQL verification tests..."
echo ""
psql $DATABASE_URL -f verify_h3_accuracy.sql

echo ""
echo "============================================================"
echo "✅ Verification Complete"
echo "============================================================"
echo ""
echo "Next steps:"
echo "1. Review the test results above"
echo "2. If accuracy < 99%, investigate failures"
echo "3. Run manual spot checks (see manual_verification.md)"
echo ""
