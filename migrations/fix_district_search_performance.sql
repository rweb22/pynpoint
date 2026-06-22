-- Migration: Fix District Search Performance
-- Purpose: Add composite index on (state, district) to eliminate timeouts
-- Issue: Queries like ?state=Karnataka&district=Bangalore Urban timeout
-- Expected impact: Query time from 30s+ → <50ms

-- Create composite index for state + district queries
-- This supports queries with both state and district filters
CREATE INDEX IF NOT EXISTS idx_pincode_state_district_lower 
ON pincodes (LOWER(state), LOWER(district));

-- Add comment
COMMENT ON INDEX idx_pincode_state_district_lower IS 
'Composite index for state+district queries. Supports case-insensitive searches using LOWER().
Expected to reduce query time from 30s+ to <50ms for queries like:
SELECT * FROM pincodes WHERE LOWER(state) = LOWER(''Karnataka'') AND LOWER(district) = LOWER(''Bangalore Urban'')';

-- Verification query
-- Expected: Uses idx_pincode_state_district_lower index
-- EXPLAIN ANALYZE SELECT * FROM pincodes WHERE LOWER(state) = LOWER('Karnataka') AND LOWER(district) = LOWER('Bangalore Urban') LIMIT 5;
