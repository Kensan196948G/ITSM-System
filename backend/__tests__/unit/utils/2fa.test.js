/**
 * 2FA Utility Functions Tests
 * バックアップコードのハッシュ化・検証ヘルパーのテスト
 */

const bcrypt = require('bcryptjs');
const {
  hashBackupCodes,
  verifyBackupCode,
  isHashedCodes,
  BCRYPT_ROUNDS
} = require('../../../utils/2fa');

describe('2FA Utility Functions', () => {
  describe('hashBackupCodes', () => {
    it('should hash all backup codes', async () => {
      const codes = ['CODE1', 'CODE2', 'CODE3'];
      const hashed = await hashBackupCodes(codes);

      expect(hashed).toHaveLength(3);
      // All hashed codes should start with $2 (bcrypt prefix)
      hashed.forEach((hash) => {
        expect(hash).toMatch(/^\$2[aby]\$/);
      });
    });

    it('should produce unique hashes for each code', async () => {
      const codes = ['AAAA', 'BBBB'];
      const hashed = await hashBackupCodes(codes);

      expect(hashed[0]).not.toBe(hashed[1]);
    });

    it('should handle empty array', async () => {
      const hashed = await hashBackupCodes([]);
      expect(hashed).toEqual([]);
    });

    it('should use correct bcrypt rounds', () => {
      expect(BCRYPT_ROUNDS).toBe(10);
    });
  });

  describe('verifyBackupCode', () => {
    let hashedCodes;
    const plaintextCodes = ['ABC123', 'DEF456', 'GHI789'];

    beforeAll(async () => {
      hashedCodes = await Promise.all(plaintextCodes.map((code) => bcrypt.hash(code, 10)));
    });

    it('should return correct index for matching code', async () => {
      const index = await verifyBackupCode('DEF456', hashedCodes);
      expect(index).toBe(1);
    });

    it('should return 0 for first code match', async () => {
      const index = await verifyBackupCode('ABC123', hashedCodes);
      expect(index).toBe(0);
    });

    it('should return last index for last code match', async () => {
      const index = await verifyBackupCode('GHI789', hashedCodes);
      expect(index).toBe(2);
    });

    it('should return -1 for non-matching code', async () => {
      const index = await verifyBackupCode('WRONG', hashedCodes);
      expect(index).toBe(-1);
    });

    it('should return -1 for empty hashed codes array', async () => {
      const index = await verifyBackupCode('ABC123', []);
      expect(index).toBe(-1);
    });

    it('should be case-sensitive', async () => {
      const index = await verifyBackupCode('abc123', hashedCodes);
      expect(index).toBe(-1);
    });
  });

  describe('isHashedCodes', () => {
    it('should return true for bcrypt hashed codes', () => {
      const hashed = [
        '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01',
        '$2a$10$xyzxyzxyzxyzxyzxyzxyzuuABCDEFGHIJKLMNOPQRSTUVWXYZ01'
      ];
      expect(isHashedCodes(hashed)).toBe(true);
    });

    it('should return true for $2b$ prefix', () => {
      const hashed = ['$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01'];
      expect(isHashedCodes(hashed)).toBe(true);
    });

    it('should return false for plaintext codes', () => {
      const plain = ['ABCD1234', 'EFGH5678'];
      expect(isHashedCodes(plain)).toBe(false);
    });

    it('should return false for empty array', () => {
      expect(isHashedCodes([])).toBe(false);
    });

    it('should return false for null', () => {
      expect(isHashedCodes(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isHashedCodes(undefined)).toBe(false);
    });
  });

  describe('Integration: hash then verify', () => {
    it('should successfully verify codes after hashing', async () => {
      const codes = ['BACKUP01', 'BACKUP02', 'BACKUP03'];
      const hashed = await hashBackupCodes(codes);

      // Each original code should match its hashed version
      for (let i = 0; i < codes.length; i += 1) {
        const index = await verifyBackupCode(codes[i], hashed);
        expect(index).toBe(i);
      }
    });

    it('should correctly identify hashed codes with isHashedCodes', async () => {
      const codes = ['TEST1', 'TEST2'];
      const hashed = await hashBackupCodes(codes);

      expect(isHashedCodes(hashed)).toBe(true);
      expect(isHashedCodes(codes)).toBe(false);
    });
  });
});
