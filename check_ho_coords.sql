-- Check how many post offices have coordinates
SELECT 
  COUNT(*) as total_post_offices,
  COUNT(latitude) as offices_with_lat,
  COUNT(longitude) as offices_with_lng,
  COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as offices_with_coords
FROM postoffice;

-- Check how many have office_type = 'BO' (Branch Office) vs 'HO' (Head Office)
SELECT 
  office_type,
  COUNT(*) as count,
  COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as with_coords
FROM postoffice
GROUP BY office_type
ORDER BY count DESC;

-- Check a sample of HO offices
SELECT pincode, office_name, office_type, latitude, longitude
FROM postoffice
WHERE office_type = 'HO'
LIMIT 10;
