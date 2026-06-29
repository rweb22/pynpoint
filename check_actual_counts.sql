-- Get actual counts from database
SELECT 
  'Active Pincodes' as entity,
  COUNT(*) as count
FROM pincodes
WHERE is_active = true

UNION ALL

SELECT 
  'Active Post Offices' as entity,
  COUNT(*) as count
FROM postoffices
WHERE is_active = true

UNION ALL

SELECT 
  'Distinct States' as entity,
  COUNT(DISTINCT state) as count
FROM pincodes
WHERE is_active = true AND state IS NOT NULL AND state != 'na'

UNION ALL

SELECT 
  'Distinct Districts' as entity,
  COUNT(DISTINCT CONCAT(state, ':', district)) as count
FROM pincodes
WHERE is_active = true 
  AND state IS NOT NULL 
  AND district IS NOT NULL
  AND state != 'na' 
  AND district != 'na';
