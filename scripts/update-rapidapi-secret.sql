-- Update RapidAPI Proxy Secret
-- 
-- Usage:
--   1. Replace 'YOUR_ACTUAL_SECRET_HERE' with the real secret from RapidAPI dashboard
--   2. Run this SQL in your production database
--   3. Restart the application to load the new secret into memory
--
-- To get your secret:
--   RapidAPI Hub → Your API → Settings → Proxy Configuration → X-RapidAPI-Proxy-Secret

BEGIN;

-- Update the existing RapidAPI configuration
UPDATE marketplace_configs 
SET 
  secret_key = 'YOUR_ACTUAL_SECRET_HERE',  -- ⚠️ REPLACE WITH REAL SECRET
  is_active = true,
  notes = 'RapidAPI proxy secret configured on ' || CURRENT_DATE::text,
  updated_at = CURRENT_TIMESTAMP
WHERE marketplace_id = 'rapidapi';

-- Verify the update
SELECT 
  marketplace_id,
  marketplace_name,
  LEFT(secret_key, 10) || '...' as secret_preview,  -- Shows first 10 chars only
  LENGTH(secret_key) as secret_length,
  is_active,
  header_name,
  user_header_name,
  notes,
  updated_at
FROM marketplace_configs
WHERE marketplace_id = 'rapidapi';

-- If you see the updated data above, commit the transaction:
COMMIT;

-- If something looks wrong, rollback instead:
-- ROLLBACK;
