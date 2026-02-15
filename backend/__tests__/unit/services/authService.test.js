/**
 * AuthService Tests
 * 認証サービスのユニットテスト
 */

jest.mock('../../../db', () => ({
  db: {
    get: jest.fn(),
    run: jest.fn()
  },
  initDb: jest.fn()
}));

jest.mock('../../../services/tokenService', () => ({
  generateRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  saveRefreshToken: jest.fn().mockResolvedValue(),
  generateJti: jest.fn().mockReturnValue('mock-jti-123'),
  rotateRefreshToken: jest.fn(),
  blacklistToken: jest.fn().mockResolvedValue(),
  revokeAllUserRefreshTokens: jest.fn().mockResolvedValue()
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed_password')
}));

jest.mock('../../../utils/2fa', () => ({
  verifyBackupCode: jest.fn(),
  isHashedCodes: jest.fn()
}));

jest.mock('speakeasy', () => ({
  totp: {
    verify: jest.fn()
  }
}));

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-family')
}));

process.env.JWT_SECRET = 'test-secret-key-for-auth-service';
process.env.JWT_EXPIRES_IN = '1h';

const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const authService = require('../../../services/authService');
const { db } = require('../../../db');
const tokenService = require('../../../services/tokenService');
const { verifyBackupCode, isHashedCodes } = require('../../../utils/2fa');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    bcrypt.compare.mockResolvedValue(true);
  });

  describe('login', () => {
    const mockUser = {
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      password_hash: 'hashed',
      role: 'admin',
      full_name: 'Admin User',
      totp_enabled: 0,
      totp_secret: null,
      backup_codes: null
    };

    it('should login successfully with valid credentials', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockUser);
      });

      const result = await authService.login('admin', 'password123');

      expect(result.token).toBeDefined();
      expect(result.user.username).toBe('admin');
      expect(result.user.email).toBe('admin@test.com');
      expect(result.jti).toBe('mock-jti-123');
    });

    it('should reject on database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      await expect(authService.login('admin', 'pass')).rejects.toThrow('Database error');
    });

    it('should reject when user not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      await expect(authService.login('nonexistent', 'pass')).rejects.toThrow(
        'Invalid username or password'
      );
    });

    it('should reject when password is wrong', async () => {
      bcrypt.compare.mockResolvedValue(false);
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockUser);
      });

      await expect(authService.login('admin', 'wrong')).rejects.toThrow(
        'Invalid username or password'
      );
    });

    it('should return requires2FA when 2FA enabled and no token provided', async () => {
      const user2fa = { ...mockUser, totp_enabled: 1, totp_secret: 'secret123' };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });

      const result = await authService.login('admin', 'password123');

      expect(result.requires2FA).toBe(true);
    });

    it('should verify TOTP token and login when 2FA enabled', async () => {
      const user2fa = { ...mockUser, totp_enabled: 1, totp_secret: 'secret123' };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });
      speakeasy.totp.verify.mockReturnValue(true);

      const result = await authService.login('admin', 'password123', '123456');

      expect(result.token).toBeDefined();
      expect(result.user.username).toBe('admin');
    });

    it('should reject with invalid 2FA token when no backup codes', async () => {
      const user2fa = {
        ...mockUser,
        totp_enabled: 1,
        totp_secret: 'secret123',
        backup_codes: null
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });
      speakeasy.totp.verify.mockReturnValue(false);

      await expect(authService.login('admin', 'pass', 'wrong')).rejects.toThrow(
        'Invalid 2FA token'
      );
    });

    it('should accept valid legacy plaintext backup code when TOTP fails', async () => {
      const user2fa = {
        ...mockUser,
        totp_enabled: 1,
        totp_secret: 'secret123',
        backup_codes: JSON.stringify(['backup1', 'backup2', 'backup3'])
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });
      db.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
      });
      speakeasy.totp.verify.mockReturnValue(false);
      isHashedCodes.mockReturnValue(false);

      const result = await authService.login('admin', 'pass', 'backup2');

      expect(result.token).toBeDefined();
      expect(isHashedCodes).toHaveBeenCalled();
      // Should have updated backup_codes without the used code
      expect(db.run).toHaveBeenCalledWith('UPDATE users SET backup_codes = ? WHERE id = ?', [
        JSON.stringify(['backup1', 'backup3']),
        1
      ]);
    });

    it('should accept valid bcrypt hashed backup code when TOTP fails', async () => {
      const hashedCodes = [
        '$2a$10$hashedcode1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        '$2a$10$hashedcode2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        '$2a$10$hashedcode3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      ];
      const user2fa = {
        ...mockUser,
        totp_enabled: 1,
        totp_secret: 'secret123',
        backup_codes: JSON.stringify(hashedCodes)
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });
      db.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
      });
      speakeasy.totp.verify.mockReturnValue(false);
      isHashedCodes.mockReturnValue(true);
      verifyBackupCode.mockResolvedValue(1); // Match at index 1

      const result = await authService.login('admin', 'pass', 'PLAINTEXT_CODE');

      expect(result.token).toBeDefined();
      expect(isHashedCodes).toHaveBeenCalled();
      expect(verifyBackupCode).toHaveBeenCalled();
      // Should have removed the used hashed code at index 1
      expect(db.run).toHaveBeenCalledWith('UPDATE users SET backup_codes = ? WHERE id = ?', [
        JSON.stringify([hashedCodes[0], hashedCodes[2]]),
        1
      ]);
    });

    it('should reject invalid bcrypt hashed backup code', async () => {
      const hashedCodes = [
        '$2a$10$hashedcode1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        '$2a$10$hashedcode2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      ];
      const user2fa = {
        ...mockUser,
        totp_enabled: 1,
        totp_secret: 'secret123',
        backup_codes: JSON.stringify(hashedCodes)
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });
      speakeasy.totp.verify.mockReturnValue(false);
      isHashedCodes.mockReturnValue(true);
      verifyBackupCode.mockResolvedValue(-1); // No match

      await expect(authService.login('admin', 'pass', 'WRONG_CODE')).rejects.toThrow(
        'Invalid 2FA token'
      );
    });

    it('should reject invalid legacy plaintext backup code', async () => {
      const user2fa = {
        ...mockUser,
        totp_enabled: 1,
        totp_secret: 'secret123',
        backup_codes: JSON.stringify(['backup1', 'backup2'])
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });
      speakeasy.totp.verify.mockReturnValue(false);
      isHashedCodes.mockReturnValue(false);

      await expect(authService.login('admin', 'pass', 'invalid-backup')).rejects.toThrow(
        'Invalid 2FA token'
      );
    });
  });

  describe('loginWithRefreshToken', () => {
    it('should return login result with refresh token', async () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: 'hashed',
        role: 'admin',
        full_name: 'Admin',
        totp_enabled: 0,
        totp_secret: null,
        backup_codes: null
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockUser);
      });
      db.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(null);
      });

      const result = await authService.loginWithRefreshToken(
        'admin',
        'pass',
        null,
        'Chrome',
        '1.2.3.4'
      );

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBe('mock-refresh-token');
      expect(result.familyId).toBe('mock-uuid-family');
      expect(tokenService.saveRefreshToken).toHaveBeenCalledWith(
        1,
        'mock-refresh-token',
        'mock-uuid-family',
        'Chrome',
        '1.2.3.4'
      );
    });

    it('should return requires2FA without generating refresh token', async () => {
      const user2fa = {
        id: 1,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: 'hashed',
        role: 'admin',
        full_name: 'Admin',
        totp_enabled: 1,
        totp_secret: 'secret',
        backup_codes: null
      };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, user2fa);
      });

      const result = await authService.loginWithRefreshToken('admin', 'pass');

      expect(result.requires2FA).toBe(true);
      expect(tokenService.saveRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null); // No existing user
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 5 }, null);
      });

      const result = await authService.register({
        username: 'newuser',
        email: 'new@test.com',
        password: 'password123',
        role: 'viewer',
        full_name: 'New User'
      });

      expect(result.id).toBe(5);
      expect(result.username).toBe('newuser');
      expect(result.role).toBe('viewer');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should use default viewer role', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 6 }, null);
      });

      const result = await authService.register({
        username: 'user',
        email: 'user@test.com',
        password: 'pass'
      });

      expect(result.role).toBe('viewer');
    });

    it('should reject when user already exists', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1 }); // Existing user found
      });

      await expect(
        authService.register({
          username: 'existing',
          email: 'exists@test.com',
          password: 'pass'
        })
      ).rejects.toThrow('Username or email already exists');
    });

    it('should reject on SELECT database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      await expect(
        authService.register({
          username: 'user',
          email: 'user@test.com',
          password: 'pass'
        })
      ).rejects.toThrow('Database error');
    });

    it('should reject on INSERT database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Insert error'));
      });

      await expect(
        authService.register({
          username: 'user',
          email: 'user@test.com',
          password: 'pass'
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('generateToken', () => {
    it('should generate JWT token for user', () => {
      const token = authService.generateToken({
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@test.com'
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should return null for null user', () => {
      const token = authService.generateToken(null);
      expect(token).toBeNull();
    });
  });

  describe('generateTokenWithJti', () => {
    it('should generate token with JTI', () => {
      const result = authService.generateTokenWithJti({
        id: 1,
        username: 'admin',
        role: 'admin',
        email: 'admin@test.com'
      });

      expect(result.token).toBeDefined();
      expect(result.jti).toBe('mock-jti-123');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should return null for null user', () => {
      const result = authService.generateTokenWithJti(null);
      expect(result).toBeNull();
    });
  });

  describe('parseExpiresIn', () => {
    it('should parse seconds', () => {
      expect(authService.parseExpiresIn('30s')).toBe(30000);
    });

    it('should parse minutes', () => {
      expect(authService.parseExpiresIn('15m')).toBe(900000);
    });

    it('should parse hours', () => {
      expect(authService.parseExpiresIn('1h')).toBe(3600000);
    });

    it('should parse days', () => {
      expect(authService.parseExpiresIn('7d')).toBe(604800000);
    });

    it('should return default 1 hour for unknown unit', () => {
      expect(authService.parseExpiresIn('100x')).toBe(3600000);
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new tokens on successful rotation', async () => {
      tokenService.rotateRefreshToken.mockResolvedValue({
        newToken: 'new-refresh-token',
        user: { id: 1, username: 'admin', role: 'admin', email: 'admin@test.com' }
      });

      const result = await authService.refreshAccessToken('old-refresh-token', 'Chrome', '1.2.3.4');

      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBe('new-refresh-token');
      expect(result.jti).toBe('mock-jti-123');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should return null when rotation fails', async () => {
      tokenService.rotateRefreshToken.mockResolvedValue(null);

      const result = await authService.refreshAccessToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should blacklist token', async () => {
      const expiresAt = new Date();

      await authService.logout('jti-123', 1, expiresAt, '1.2.3.4');

      expect(tokenService.blacklistToken).toHaveBeenCalledWith(
        'jti-123',
        1,
        expiresAt,
        'logout',
        '1.2.3.4'
      );
      expect(tokenService.revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    });

    it('should revoke all sessions when revokeAllSessions is true', async () => {
      const expiresAt = new Date();

      await authService.logout('jti-123', 1, expiresAt, '1.2.3.4', true);

      expect(tokenService.blacklistToken).toHaveBeenCalled();
      expect(tokenService.revokeAllUserRefreshTokens).toHaveBeenCalledWith(1, 'logout_all');
    });

    it('should not revoke all sessions by default', async () => {
      const expiresAt = new Date();

      await authService.logout('jti-123', 1, expiresAt);

      expect(tokenService.revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    });
  });
});
