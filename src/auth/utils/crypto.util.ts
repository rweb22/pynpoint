import * as crypto from 'crypto';

/**
 * Crypto Utilities for API Key Management
 * 
 * Provides cryptographic functions for:
 * - SHA-256 hashing (one-way, irreversible)
 * - Luhn checksum (fast client-side validation)
 * - Secure random generation
 */

/**
 * Generate SHA-256 hash of a string
 * Used for storing API keys securely (never store plaintext)
 * 
 * @param input - The string to hash (e.g., API key)
 * @returns 64-character hex string
 * 
 * Example:
 *   hashSHA256('ppk_live_sk_abc123') → 'a1b2c3d4e5f6...' (64 chars)
 */
export function hashSHA256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate cryptographically secure random string
 * Uses Node.js crypto.randomBytes for true randomness
 * 
 * @param length - Number of random bytes to generate
 * @returns Hex string (2x length characters)
 * 
 * Example:
 *   generateRandomString(12) → 'a8f2c1d4e5f6g7h8i9j0k1l2' (24 chars)
 */
export function generateRandomString(length: number): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Calculate Luhn checksum for a string
 * 
 * The Luhn algorithm (mod 10) is used for:
 * - Credit card validation
 * - Fast client-side validation (before hitting database)
 * - Catching typos in API keys
 * 
 * Algorithm:
 * 1. Convert string to digits (a=10, b=11, ..., z=35)
 * 2. Starting from right, double every 2nd digit
 * 3. If doubled digit > 9, subtract 9
 * 4. Sum all digits
 * 5. Checksum = (10 - (sum % 10)) % 10
 * 
 * @param input - String to calculate checksum for
 * @returns Single digit checksum (0-9)
 * 
 * Example:
 *   luhnChecksum('abc123') → 7
 */
export function luhnChecksum(input: string): number {
  const digits = input
    .toLowerCase()
    .split('')
    .map((char) => {
      // Convert alphanumeric to digits
      // 0-9 → 0-9
      // a-z → 10-35
      const code = char.charCodeAt(0);
      if (code >= 48 && code <= 57) {
        // 0-9
        return code - 48;
      } else if (code >= 97 && code <= 122) {
        // a-z
        return code - 87; // 'a' = 10, 'b' = 11, etc.
      }
      return 0; // Ignore other characters
    });

  let sum = 0;
  let shouldDouble = false;

  // Process digits from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Validate Luhn checksum
 * 
 * @param input - String without checksum
 * @param checksum - Expected checksum digit
 * @returns true if checksum is valid
 * 
 * Example:
 *   validateLuhnChecksum('abc123', 7) → true
 *   validateLuhnChecksum('abc123', 5) → false
 */
export function validateLuhnChecksum(input: string, checksum: number): boolean {
  return luhnChecksum(input) === checksum;
}

/**
 * Generate API key with Luhn checksum
 * 
 * Format: ppk_{env}_{type}_{random}_{checksum}
 * - ppk: Prefix for leak detection (GitHub secret scanning)
 * - env: live | test
 * - type: sk (secret key) | pk (public key)
 * - random: 24 random hex chars
 * - checksum: Single digit Luhn checksum
 * 
 * @param environment - 'live' or 'test'
 * @param type - 'sk' (secret key) or 'pk' (public key)
 * @returns Object with full key and prefix
 * 
 * Example:
 *   generateApiKey('live', 'sk') → {
 *     key: 'ppk_live_sk_a8f2c1d4e5f6g7h8i9j0k1l2_7',
 *     prefix: 'ppk_live_sk_a8f'
 *   }
 */
export function generateApiKey(
  environment: 'live' | 'test',
  type: 'sk' | 'pk' = 'sk',
): { key: string; prefix: string } {
  // Generate 24 random hex characters
  const random = generateRandomString(12); // 12 bytes = 24 hex chars

  // Build key without checksum
  const keyWithoutChecksum = `ppk_${environment}_${type}_${random}`;

  // Calculate Luhn checksum
  const checksum = luhnChecksum(keyWithoutChecksum);

  // Full key with checksum
  const key = `${keyWithoutChecksum}_${checksum}`;

  // Prefix for display (first 15 chars)
  const prefix = key.substring(0, 15);

  return { key, prefix };
}

/**
 * Validate API key format and checksum
 * 
 * @param key - Full API key
 * @returns true if format and checksum are valid
 * 
 * Example:
 *   validateApiKeyFormat('ppk_live_sk_abc123_7') → true/false
 */
export function validateApiKeyFormat(key: string): boolean {
  // Format: ppk_{env}_{type}_{random}_{checksum}
  const parts = key.split('_');

  if (parts.length !== 5) return false;
  if (parts[0] !== 'ppk') return false;
  if (!['live', 'test'].includes(parts[1])) return false;
  if (!['sk', 'pk'].includes(parts[2])) return false;
  if (parts[3].length !== 24) return false; // Random part
  if (!/^\d$/.test(parts[4])) return false; // Checksum must be single digit

  // Validate Luhn checksum
  const keyWithoutChecksum = parts.slice(0, 4).join('_');
  const checksum = parseInt(parts[4], 10);

  return validateLuhnChecksum(keyWithoutChecksum, checksum);
}
