/* eslint-disable class-methods-use-this */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const tokenService = require('./tokenService');

/**
 * Authentication Service
 * Handles user login, token generation, and 2FA verification
 */
class AuthService {
  /**
   * Authenticate user with username and password
   * @param {string} username
   * @param {string} password
   * @param {string} totpToken (optional)
   * @returns {Promise<Object>} User and token
   */
  async login(username, password, totpToken) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username],
        async (err, user) => {
          if (err) {
            return reject(new Error('Database error'));
          }

          if (!user) {
            return reject(new Error('Invalid username or password'));
          }

          // Compare password
          const isValid = await bcrypt.compare(password, user.password_hash);
          if (!isValid) {
            return reject(new Error('Invalid username or password'));
          }

          // Check if 2FA is enabled
          if (user.totp_enabled && user.totp_secret) {
            if (!totpToken) {
              return resolve({ requires2FA: true });
            }

            // Verify TOTP token
            const verified = speakeasy.totp.verify({
              secret: user.totp_secret,
              encoding: 'base32',
              token: totpToken,
              window: 2
            });

            if (!verified) {
              // Check backup codes
              if (user.backup_codes) {
                const backupCodes = JSON.parse(user.backup_codes);
                const codeIndex = backupCodes.indexOf(totpToken);

                if (codeIndex !== -1) {
                  // Remove used backup code
                  backupCodes.splice(codeIndex, 1);
                  db.run('UPDATE users SET backup_codes = ? WHERE id = ?', [
                    JSON.stringify(backupCodes),
                    user.id
                  ]);
                } else {
                  return reject(new Error('Invalid 2FA token'));
                }
              } else {
                return reject(new Error('Invalid 2FA token'));
              }
            }
          }

          // Update last login
          db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

          // Generate JWT token with JTI
          const { token, jti, expiresAt } = this.generateTokenWithJti(user);

          return resolve({
            token,
            jti,
            expiresAt,
            user: {
              id: user.id,
              username: user.username,
              email: user.email,
              role: user.role,
              full_name: user.full_name
            }
          });
        }
      );
    });
  }

  /**
   * Login with refresh token support
   * @param {string} username
   * @param {string} password
   * @param {string} totpToken (optional)
   * @param {string} deviceInfo - デバイス情報
   * @param {string} ipAddress - IPアドレス
   * @returns {Promise<Object>} User, tokens
   */
  async loginWithRefreshToken(username, password, totpToken, deviceInfo = null, ipAddress = null) {
    const loginResult = await this.login(username, password, totpToken);

    // 2FA required の場合はそのまま返す
    if (loginResult.requires2FA) {
      return loginResult;
    }

    // リフレッシュトークンを生成・保存
    const refreshToken = tokenService.generateRefreshToken();
    const familyId = uuidv4();

    await tokenService.saveRefreshToken(
      loginResult.user.id,
      refreshToken,
      familyId,
      deviceInfo,
      ipAddress
    );

    return {
      ...loginResult,
      refreshToken,
      familyId
    };
  }

  /**
   * Register a new user
   * @param {Object} userData
   * @returns {Promise<Object>} Created user
   */
  async register(userData) {
    const { username, email, password, role = 'viewer', full_name } = userData;

    return new Promise((resolve, reject) => {
      // Check if user already exists
      db.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email],
        async (err, existingUser) => {
          if (err) {
            return reject(new Error('Database error'));
          }

          if (existingUser) {
            return reject(new Error('Username or email already exists'));
          }

          // Hash password
          const passwordHash = await bcrypt.hash(password, 10);

          // Create user
          const sql =
            'INSERT INTO users (username, email, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?)';
          db.run(sql, [username, email, passwordHash, role, full_name], function (dbErr) {
            if (dbErr) {
              return reject(new Error('Database error'));
            }

            return resolve({
              id: this.lastID,
              username,
              email,
              role,
              full_name
            });
          });
        }
      );
    });
  }

  /**
   * Generate JWT token for user (legacy - without JTI)
   * @param {Object} user
   * @returns {string} JWT token
   * @deprecated Use generateTokenWithJti instead
   */
  generateToken(user) {
    if (!user) return null;
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
  }

  /**
   * Generate JWT token with JTI for secure logout
   * @param {Object} user
   * @returns {{token: string, jti: string, expiresAt: Date}} Token info
   */
  generateTokenWithJti(user) {
    if (!user) return null;

    const jti = tokenService.generateJti();
    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    // Calculate expiration time
    const expiresInMs = this.parseExpiresIn(expiresIn);
    const expiresAt = new Date(Date.now() + expiresInMs);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        jti // JWT ID for blacklisting
      },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    return { token, jti, expiresAt };
  }

  /**
   * Parse expires in string to milliseconds
   * @param {string} expiresIn - e.g., '1h', '30m', '7d'
   * @returns {number} milliseconds
   */
  parseExpiresIn(expiresIn) {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000; // default 1 hour
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken
   * @param {string} deviceInfo
   * @param {string} ipAddress
   * @returns {Promise<Object|null>} New tokens or null
   */
  async refreshAccessToken(refreshToken, deviceInfo = null, ipAddress = null) {
    const rotationResult = await tokenService.rotateRefreshToken(refreshToken, deviceInfo, ipAddress);
    if (!rotationResult) return null;

    const { newToken: newRefreshToken, user } = rotationResult;
    const { token, jti, expiresAt } = this.generateTokenWithJti(user);

    return {
      token,
      jti,
      expiresAt,
      refreshToken: newRefreshToken,
      user
    };
  }

  /**
   * Logout - blacklist token and revoke refresh tokens
   * @param {string} jti - JWT ID
   * @param {number} userId
   * @param {Date} expiresAt - Token expiration
   * @param {string} ipAddress
   * @param {boolean} revokeAllSessions - Revoke all refresh tokens
   * @returns {Promise<void>}
   */
  async logout(jti, userId, expiresAt, ipAddress = null, revokeAllSessions = false) {
    // Add token to blacklist
    await tokenService.blacklistToken(jti, userId, expiresAt, 'logout', ipAddress);

    // Optionally revoke all refresh tokens (logout from all devices)
    if (revokeAllSessions) {
      await tokenService.revokeAllUserRefreshTokens(userId, 'logout_all');
    }
  }
}

module.exports = new AuthService();
