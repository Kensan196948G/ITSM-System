/**
 * Encryption Utility Tests
 * AES-256-GCM 暗号化・復号のテスト
 */

const crypto = require('crypto');

// Generate a test key (32 bytes for AES-256)
const TEST_KEY = crypto.randomBytes(32);
const TEST_KEY_BASE64 = TEST_KEY.toString('base64');

describe('Encryption Utility (AES-256-GCM)', () => {
  let encrypt;
  let decrypt;
  let getEncryptionKey;

  beforeEach(() => {
    // Set env var before requiring the module
    process.env.TOTP_ENCRYPTION_KEY = TEST_KEY_BASE64;
    // Clear module cache to pick up fresh env
    jest.resetModules();
    const encryption = require('../../../utils/encryption');
    encrypt = encryption.encrypt;
    decrypt = encryption.decrypt;
    getEncryptionKey = encryption.getEncryptionKey;
  });

  afterEach(() => {
    delete process.env.TOTP_ENCRYPTION_KEY;
  });

  describe('getEncryptionKey', () => {
    it('should return a 32-byte Buffer from base64 env var', () => {
      const key = getEncryptionKey();
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    it('should throw if TOTP_ENCRYPTION_KEY is not set', () => {
      delete process.env.TOTP_ENCRYPTION_KEY;
      jest.resetModules();
      const { getEncryptionKey: getKey } = require('../../../utils/encryption');
      expect(() => getKey()).toThrow('TOTP_ENCRYPTION_KEY environment variable is not set');
    });

    it('should throw if key is not 32 bytes', () => {
      process.env.TOTP_ENCRYPTION_KEY = Buffer.from('short').toString('base64');
      jest.resetModules();
      const { getEncryptionKey: getKey } = require('../../../utils/encryption');
      expect(() => getKey()).toThrow('TOTP_ENCRYPTION_KEY must be 32 bytes');
    });
  });

  describe('encrypt', () => {
    it('should return encrypted, iv, and authTag as hex strings', () => {
      const result = encrypt('test-secret', TEST_KEY);
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(typeof result.encrypted).toBe('string');
      expect(typeof result.iv).toBe('string');
      expect(typeof result.authTag).toBe('string');
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const result1 = encrypt('same-secret', TEST_KEY);
      const result2 = encrypt('same-secret', TEST_KEY);
      expect(result1.encrypted).not.toBe(result2.encrypted);
      expect(result1.iv).not.toBe(result2.iv);
    });

    it('should produce a 12-byte IV (24 hex chars)', () => {
      const result = encrypt('test', TEST_KEY);
      // 12 bytes = 24 hex characters
      expect(result.iv.length).toBe(24);
    });

    it('should produce a 16-byte auth tag (32 hex chars)', () => {
      const result = encrypt('test', TEST_KEY);
      // 16 bytes = 32 hex characters
      expect(result.authTag.length).toBe(32);
    });

    it('should use env key when no explicit key provided', () => {
      const result = encrypt('test-secret');
      expect(result).toHaveProperty('encrypted');
      // Should be decryptable with same env key
      const decrypted = decrypt(result.encrypted, result.iv, result.authTag);
      expect(decrypted).toBe('test-secret');
    });
  });

  describe('decrypt', () => {
    it('should correctly decrypt encrypted data', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP';
      const { encrypted, iv, authTag } = encrypt(plaintext, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, authTag, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long TOTP secrets', () => {
      const longSecret = 'A'.repeat(128);
      const { encrypted, iv, authTag } = encrypt(longSecret, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, authTag, TEST_KEY);
      expect(decrypted).toBe(longSecret);
    });

    it('should handle special characters in plaintext', () => {
      const specialChars = 'テスト秘密鍵+/=!@#$%';
      const { encrypted, iv, authTag } = encrypt(specialChars, TEST_KEY);
      const decrypted = decrypt(encrypted, iv, authTag, TEST_KEY);
      expect(decrypted).toBe(specialChars);
    });

    it('should throw on tampered ciphertext', () => {
      const { encrypted, iv, authTag } = encrypt('secret', TEST_KEY);
      // Tamper with the encrypted data
      const tampered = `ff${encrypted.slice(2)}`;
      expect(() => decrypt(tampered, iv, authTag, TEST_KEY)).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const { encrypted, iv, authTag } = encrypt('secret', TEST_KEY);
      // Tamper with the auth tag
      const tamperedTag = `ff${authTag.slice(2)}`;
      expect(() => decrypt(encrypted, iv, tamperedTag, TEST_KEY)).toThrow();
    });

    it('should throw on wrong key', () => {
      const { encrypted, iv, authTag } = encrypt('secret', TEST_KEY);
      const wrongKey = crypto.randomBytes(32);
      expect(() => decrypt(encrypted, iv, authTag, wrongKey)).toThrow();
    });

    it('should use env key when no explicit key provided', () => {
      const { encrypted, iv, authTag } = encrypt('env-key-test', TEST_KEY);
      // decrypt without explicit key should use env
      const decrypted = decrypt(encrypted, iv, authTag);
      expect(decrypted).toBe('env-key-test');
    });
  });

  describe('Integration: encrypt-then-decrypt roundtrip', () => {
    it('should roundtrip a typical TOTP base32 secret', () => {
      const totpSecret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
      const { encrypted, iv, authTag } = encrypt(totpSecret, TEST_KEY);

      // Encrypted should be different from plaintext
      expect(encrypted).not.toBe(totpSecret);

      const decrypted = decrypt(encrypted, iv, authTag, TEST_KEY);
      expect(decrypted).toBe(totpSecret);
    });

    it('should handle multiple encrypt-decrypt cycles', () => {
      const secrets = ['SECRET1', 'ABCDEFGHIJKLMNOP', 'JBSWY3DPEHPK3PXP', '12345678901234567890'];

      secrets.forEach((secret) => {
        const { encrypted, iv, authTag } = encrypt(secret, TEST_KEY);
        const decrypted = decrypt(encrypted, iv, authTag, TEST_KEY);
        expect(decrypted).toBe(secret);
      });
    });
  });
});
