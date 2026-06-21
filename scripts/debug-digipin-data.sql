-- Debug: Check what's actually in the database

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 Debugging DIGIPIN Data Mismatch'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''

\echo '1️⃣  What is stored in database for 110001?'
SELECT 
  pincode,
  array_length(digipin_cells, 1) as cell_count,
  digipin_cells[1:5] as first_5_cells,
  digipin_cells
FROM pincodes
WHERE pincode = '110001';

\echo ''
\echo '2️⃣  Check character set of stored cells:'
SELECT 
  DISTINCT unnest(string_to_array(digipin_cells[1], NULL)) as char
FROM pincodes
WHERE pincode = '110001'
ORDER BY char;

\echo ''
\echo '3️⃣  Sample 10 cells from database:'
SELECT cell
FROM pincodes,
     LATERAL unnest(digipin_cells) as cell
WHERE pincode = '110001'
LIMIT 10;

\echo ''
\echo '4️⃣  Check if 39J438 exists in database:'
SELECT 
  pincode,
  '39J438' = ANY(digipin_cells) as contains_39J438,
  'TTNGTX' = ANY(digipin_cells) as contains_TTNGTX
FROM pincodes
WHERE pincode = '110001';

\echo ''
\echo '5️⃣  Check encode_digipin_level6 function output:'
SELECT encode_digipin_level6(28.6139, 77.2090) as encoded_cell;

\echo ''
\echo '6️⃣  Compare character sets:'
WITH db_chars AS (
  SELECT DISTINCT substring(cell from 1 for 1) as char
  FROM pincodes,
       LATERAL unnest(digipin_cells) as cell
  WHERE pincode = '110001'
)
SELECT 
  string_agg(char, ',' ORDER BY char) as characters_in_db_cells
FROM db_chars;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
