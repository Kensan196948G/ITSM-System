/**
 * Token Service Tests
 * トークンサービスのユニットテスト
 */

jest.mock('../../../db', () => ({
  db: {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn()
  },
  initDb: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const {
  generateSecureToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  cleanupExpiredTokens,
  invalidateUserTokens,
  generateJti,
  hashToken,
  blacklistToken,
  isTokenBlacklisted,
  revokeAllUserRefreshTokens,
  generateRefreshToken,
  saveRefreshToken,
  validateRefreshToken,
  revokeTokenFamily,
  getUserSessions,
  cleanupAllExpiredTokens
} = require('../../../services/tokenService');

const { db } = require('../../../db');

describe('Token Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSecureToken', () => {
    it('should generate a hex string token', () => {
      const token = generateSecureToken();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate token of default length (64 hex chars = 32 bytes)', () => {
      const token = generateSecureToken();
      expect(token.length).toBe(64);
    });

    it('should generate token with custom length', () => {
      const token = generateSecureToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });

    it('should generate unique tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateJti', () => {
    it('should return a UUID string', () => {
      const jti = generateJti();
      expect(typeof jti).toBe('string');
      expect(jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique JTIs', () => {
      const jti1 = generateJti();
      const jti2 = generateJti();
      expect(jti1).not.toBe(jti2);
    });
  });

  describe('hashToken', () => {
    it('should return a SHA-256 hash string', () => {
      const hash = hashToken('test-token');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 = 64 hex chars
    });

    it('should produce consistent hash for same input', () => {
      const hash1 = hashToken('same-token');
      const hash2 = hashToken('same-token');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a hex string', () => {
      const token = generateRefreshToken();
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('should generate 128 hex chars (64 bytes)', () => {
      const token = generateRefreshToken();
      expect(token.length).toBe(128);
    });
  });

  describe('createPasswordResetToken', () => {
    it('should create token successfully', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 42 }, null);
      });

      const result = await createPasswordResetToken(1, 'test@example.com', '127.0.0.1');
      expect(result.token).toBeDefined();
      expect(result.token.length).toBe(64);
      expect(result.expires_at).toBeInstanceOf(Date);
      expect(result.token_id).toBe(42);
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('DB insert error'));
      });

      await expect(createPasswordResetToken(1, 'test@example.com', '127.0.0.1')).rejects.toThrow(
        'DB insert error'
      );
    });
  });

  describe('validatePasswordResetToken', () => {
    it('should return null when token not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await validatePasswordResetToken('nonexistent');
      expect(result).toBeNull();
    });

    it('should return null when token is already used', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, user_id: 1, used: 1, expires_at: '2099-12-31T00:00:00Z' });
      });

      const result = await validatePasswordResetToken('used-token');
      expect(result).toBeNull();
    });

    it('should return null when token is expired', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, user_id: 1, used: 0, expires_at: '2020-01-01T00:00:00Z' });
      });

      const result = await validatePasswordResetToken('expired-token');
      expect(result).toBeNull();
    });

    it('should return token data when valid', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          id: 1,
          user_id: 5,
          email: 'test@example.com',
          used: 0,
          expires_at: futureDate
        });
      });

      const result = await validatePasswordResetToken('valid-token');
      expect(result).not.toBeNull();
      expect(result.user_id).toBe(5);
    });

    it('should reject on database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      await expect(validatePasswordResetToken('any-token')).rejects.toThrow('DB error');
    });
  });

  describe('markTokenAsUsed', () => {
    it('should mark token as used successfully', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(null);
      });

      await expect(markTokenAsUsed('some-token')).resolves.toBeUndefined();
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Update failed'));
      });

      await expect(markTokenAsUsed('some-token')).rejects.toThrow('Update failed');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should return number of deleted tokens', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 5 }, null);
      });

      const result = await cleanupExpiredTokens();
      expect(result).toBe(5);
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Cleanup failed'));
      });

      await expect(cleanupExpiredTokens()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('invalidateUserTokens', () => {
    it('should invalidate tokens for user', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 3 }, null);
      });

      await expect(invalidateUserTokens(1)).resolves.toBeUndefined();
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Invalidate failed'));
      });

      await expect(invalidateUserTokens(1)).rejects.toThrow('Invalidate failed');
    });
  });

  describe('blacklistToken', () => {
    it('should blacklist token successfully', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      await expect(
        blacklistToken('jti-123', 1, new Date(), 'logout', '127.0.0.1')
      ).resolves.toBeUndefined();
    });

    it('should handle UNIQUE constraint error silently', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('UNIQUE constraint failed'));
      });

      // Should resolve (not reject) for duplicate
      await expect(blacklistToken('jti-123', 1, '2099-01-01T00:00:00Z')).resolves.toBeUndefined();
    });

    it('should reject on other database errors', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Connection lost'));
      });

      await expect(blacklistToken('jti-123', 1, new Date())).rejects.toThrow('Connection lost');
    });

    it('should handle Date object for expiresAt', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      await expect(blacklistToken('jti-456', 2, new Date('2099-01-01'))).resolves.toBeUndefined();

      const callParams = db.run.mock.calls[0][1];
      // expiresAt should be ISO string
      expect(typeof callParams[2]).toBe('string');
    });

    it('should handle string expiresAt', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      await expect(blacklistToken('jti-789', 3, '2099-12-31T23:59:59Z')).resolves.toBeUndefined();

      const callParams = db.run.mock.calls[0][1];
      expect(callParams[2]).toBe('2099-12-31T23:59:59Z');
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true when token is blacklisted', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1 });
      });

      const result = await isTokenBlacklisted('jti-123');
      expect(result).toBe(true);
    });

    it('should return false when token is not blacklisted', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await isTokenBlacklisted('jti-not-found');
      expect(result).toBe(false);
    });

    it('should reject on database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Query error'));
      });

      await expect(isTokenBlacklisted('jti-123')).rejects.toThrow('Query error');
    });
  });

  describe('revokeAllUserRefreshTokens', () => {
    it('should revoke all tokens and return count', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 4 }, null);
      });

      const result = await revokeAllUserRefreshTokens(1, 'password_change');
      expect(result).toBe(4);
    });

    it('should use default reason', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      await revokeAllUserRefreshTokens(1);
      const callParams = db.run.mock.calls[0][1];
      expect(callParams[0]).toBe('password_change');
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Revoke failed'));
      });

      await expect(revokeAllUserRefreshTokens(1)).rejects.toThrow('Revoke failed');
    });
  });

  describe('saveRefreshToken', () => {
    it('should save refresh token successfully', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 10 }, null);
      });

      await expect(
        saveRefreshToken(1, 'token-data', 'family-1', 'Chrome', '127.0.0.1', 7)
      ).resolves.toBeUndefined();
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Save failed'));
      });

      await expect(saveRefreshToken(1, 'token-data', 'family-1')).rejects.toThrow('Save failed');
    });
  });

  describe('validateRefreshToken', () => {
    it('should return null for invalid token', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await validateRefreshToken('invalid-token');
      expect(result).toBeNull();
    });

    it('should return user data for valid token', async () => {
      const mockRow = {
        id: 1,
        user_id: 5,
        username: 'testuser',
        email: 'test@example.com',
        role: 'admin',
        is_active: 1,
        full_name: 'Test User'
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockRow);
      });
      // last_used_at update
      db.run.mockImplementation(() => {});

      const result = await validateRefreshToken('valid-token');
      expect(result).not.toBeNull();
      expect(result.username).toBe('testuser');
    });

    it('should reject on database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Validation error'));
      });

      await expect(validateRefreshToken('any-token')).rejects.toThrow('Validation error');
    });
  });

  describe('revokeTokenFamily', () => {
    it('should revoke all tokens in family', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 3 }, null);
      });

      const result = await revokeTokenFamily('family-1', 'security_concern');
      expect(result).toBe(3);
    });

    it('should use default reason', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      await revokeTokenFamily('family-1');
      const callParams = db.run.mock.calls[0][1];
      expect(callParams[0]).toBe('security_concern');
    });

    it('should reject on database error', async () => {
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Revoke family failed'));
      });

      await expect(revokeTokenFamily('family-1')).rejects.toThrow('Revoke family failed');
    });
  });

  describe('getUserSessions', () => {
    it('should return sessions for user', async () => {
      const mockSessions = [
        { family_id: 'f1', device_info: 'Chrome', ip_address: '1.2.3.4' },
        { family_id: 'f2', device_info: 'Firefox', ip_address: '5.6.7.8' }
      ];
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockSessions);
      });

      const result = await getUserSessions(1);
      expect(result).toHaveLength(2);
      expect(result[0].family_id).toBe('f1');
    });

    it('should return empty array when no sessions', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const result = await getUserSessions(1);
      expect(result).toEqual([]);
    });

    it('should reject on database error', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('Sessions error'));
      });

      await expect(getUserSessions(1)).rejects.toThrow('Sessions error');
    });
  });

  describe('cleanupAllExpiredTokens', () => {
    it('should cleanup all token types', async () => {
      // 3回のdb.runが順番に呼ばれる
      let callCount = 0;
      db.run.mockImplementation(function (sql, params, callback) {
        callCount++;
        let changes;
        if (callCount === 1) {
          changes = 2;
        } else if (callCount === 2) {
          changes = 3;
        } else {
          changes = 1;
        }
        callback.call({ changes }, null);
      });

      const result = await cleanupAllExpiredTokens();
      expect(result.passwordReset).toBe(2);
      expect(result.blacklist).toBe(3);
      expect(result.refreshTokens).toBe(1);
    });

    it('should reject if any cleanup fails', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Cleanup error'));
      });

      await expect(cleanupAllExpiredTokens()).rejects.toThrow('Cleanup error');
    });
  });
});
