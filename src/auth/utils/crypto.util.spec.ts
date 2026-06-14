import {
  hashSHA256,
  generateRandomString,
  luhnChecksum,
  validateLuhnChecksum,
  generateApiKey,
  validateApiKeyFormat,
} from './crypto.util';

describe('Crypto Utilities', () => {
  describe('hashSHA256', () => {
    it('should generate consistent SHA-256 hash', () => {
      const input = 'test-string';
      const hash1 = hashSHA256(input);
      const hash2 = hashSHA256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = hashSHA256('input1');
      const hash2 = hashSHA256('input2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRandomString', () => {
    it('should generate random string of correct length', () => {
      const random = generateRandomString(12);
      expect(random).toHaveLength(24); // 12 bytes = 24 hex chars
    });

    it('should generate different values each time', () => {
      const random1 = generateRandomString(12);
      const random2 = generateRandomString(12);

      expect(random1).not.toBe(random2);
    });
  });

  describe('luhnChecksum', () => {
    it('should calculate valid Luhn checksum', () => {
      const checksum = luhnChecksum('abc123');
      expect(checksum).toBeGreaterThanOrEqual(0);
      expect(checksum).toBeLessThanOrEqual(9);
    });

    it('should be consistent for same input', () => {
      const input = 'test-key-123';
      const checksum1 = luhnChecksum(input);
      const checksum2 = luhnChecksum(input);

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('validateLuhnChecksum', () => {
    it('should validate correct checksum', () => {
      const input = 'abc123';
      const checksum = luhnChecksum(input);

      expect(validateLuhnChecksum(input, checksum)).toBe(true);
    });

    it('should reject incorrect checksum', () => {
      const input = 'abc123';
      const checksum = luhnChecksum(input);
      const wrongChecksum = (checksum + 1) % 10;

      expect(validateLuhnChecksum(input, wrongChecksum)).toBe(false);
    });
  });

  describe('generateApiKey', () => {
    it('should generate valid live secret key', () => {
      const { key, prefix } = generateApiKey('live', 'sk');

      expect(key).toContain('ppk_live_sk_');
      expect(prefix).toBe(key.substring(0, 15));
      expect(validateApiKeyFormat(key)).toBe(true);
    });

    it('should generate valid test secret key', () => {
      const { key, prefix } = generateApiKey('test', 'sk');

      expect(key).toContain('ppk_test_sk_');
      expect(validateApiKeyFormat(key)).toBe(true);
    });

    it('should generate unique keys each time', () => {
      const key1 = generateApiKey('live', 'sk');
      const key2 = generateApiKey('live', 'sk');

      expect(key1.key).not.toBe(key2.key);
    });

    it('should have correct format', () => {
      const { key } = generateApiKey('live', 'sk');
      const parts = key.split('_');

      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe('ppk');
      expect(parts[1]).toBe('live');
      expect(parts[2]).toBe('sk');
      expect(parts[3]).toHaveLength(24); // Random part
      expect(parts[4]).toHaveLength(1); // Checksum
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should validate correctly formatted key', () => {
      const { key } = generateApiKey('live', 'sk');
      expect(validateApiKeyFormat(key)).toBe(true);
    });

    it('should reject key with wrong prefix', () => {
      const badKey = 'xxx_live_sk_a8f2c1d4e5f6g7h8i9j0k1l2_7';
      expect(validateApiKeyFormat(badKey)).toBe(false);
    });

    it('should reject key with wrong environment', () => {
      const badKey = 'ppk_prod_sk_a8f2c1d4e5f6g7h8i9j0k1l2_7';
      expect(validateApiKeyFormat(badKey)).toBe(false);
    });

    it('should reject key with wrong type', () => {
      const badKey = 'ppk_live_xx_a8f2c1d4e5f6g7h8i9j0k1l2_7';
      expect(validateApiKeyFormat(badKey)).toBe(false);
    });

    it('should reject key with wrong length random part', () => {
      const badKey = 'ppk_live_sk_abc123_7';
      expect(validateApiKeyFormat(badKey)).toBe(false);
    });

    it('should reject key with invalid checksum', () => {
      const { key } = generateApiKey('live', 'sk');
      const parts = key.split('_');
      const wrongChecksum = (parseInt(parts[4]) + 1) % 10;
      const badKey = parts.slice(0, 4).join('_') + '_' + wrongChecksum;

      expect(validateApiKeyFormat(badKey)).toBe(false);
    });

    it('should reject key with too few parts', () => {
      const badKey = 'ppk_live_sk_abc';
      expect(validateApiKeyFormat(badKey)).toBe(false);
    });
  });
});
