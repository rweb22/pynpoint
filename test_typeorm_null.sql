-- Check what values the boundary field has for pincodes without boundaries

SELECT 
    pincode,
    boundary,
    boundary IS NULL as is_null,
    boundary IS NOT NULL as is_not_null,
    pg_typeof(boundary) as type
FROM pincodes
WHERE pincode IN ('141013', '141010', '322021', '247552', '500955')
ORDER BY pincode;
