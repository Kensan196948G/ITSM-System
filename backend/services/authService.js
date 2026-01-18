/* eslint-disable class-methods-use-this */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const { db } = require('../db');

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

          // Generate JWT token
          const token = this.generateToken(user);

          return resolve({
            token,
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
   * Generate JWT token for user
   * @param {Object} user
   * @returns {string} JWT token
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
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
  }
}

module.exports = new AuthService();
