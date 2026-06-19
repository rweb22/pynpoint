-- Check how many pincodes are active vs inactive

SELECT 
    COUNT(*) as total_pincodes,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_pincodes,
    COUNT(CASE WHEN is_active = false OR is_active IS NULL THEN 1 END) as inactive_pincodes,
    COUNT(CASE WHEN is_active = true AND boundary IS NOT NULL THEN 1 END) as active_with_boundary,
    COUNT(CASE WHEN is_active = true AND boundary IS NULL THEN 1 END) as active_without_boundary,
    COUNT(CASE WHEN (is_active = false OR is_active IS NULL) AND boundary IS NULL THEN 1 END) as inactive_without_boundary
FROM pincodes;

-- Check sample of inactive pincodes
\echo ''
\echo 'Sample inactive pincodes:'
SELECT pincode, boundary IS NOT NULL as has_boundary, is_active
FROM pincodes
WHERE is_active = false OR is_active IS NULL
LIMIT 10;

-- Check sample of active pincodes without boundaries
\echo ''
\echo 'Sample active pincodes without boundaries:'
SELECT pincode, boundary IS NOT NULL as has_boundary, is_active
FROM pincodes
WHERE is_active = true AND boundary IS NULL
LIMIT 10;
