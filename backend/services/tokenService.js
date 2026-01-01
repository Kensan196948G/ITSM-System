/**
 * Token Service
 * パスワードリセットトークンの生成・検証・管理
 */

const crypto = require('crypto');
const { db } = require('../db');

/**
 * セキュアなランダムトークンを生成
 * @param {number} length - トークンの長さ（バイト数）
 * @returns {string} ランダムなトークン（16進数文字列）
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * パスワードリセットトークンを作成
 * @param {number} userId - ユーザーID
 * @param {string} email - ユーザーのメールアドレス
 * @param {string} ipAddress - リクエスト元IPアドレス
 * @returns {Promise<Object>} トークン情報（token, expires_at）
 */
function createPasswordResetToken(userId, email, ipAddress) {
  return new Promise((resolve, reject) => {
    const token = generateSecureToken(32); // 64文字の16進数文字列
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

    const sql = `INSERT INTO password_reset_tokens (
      user_id, token, email, expires_at, ip_address
    ) VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [userId, token, email, expiresAt.toISOString(), ipAddress], function (err) {
      if (err) {
        console.error('[TokenService] Error creating reset token:', err);
        return reject(err);
      }

      console.log(`[TokenService] Password reset token created for user ${userId}`);
      resolve({
        token,
        expires_at: expiresAt,
        token_id: this.lastID
      });
    });
  });
}

/**
 * パスワードリセットトークンを検証
 * @param {string} token - リセットトークン
 * @returns {Promise<Object|null>} トークン情報（有効な場合）またはnull
 */
function validatePasswordResetToken(token) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT
      id, user_id, email, expires_at, used
    FROM password_reset_tokens
    WHERE token = ?`;

    db.get(sql, [token], (err, row) => {
      if (err) {
        console.error('[TokenService] Error validating token:', err);
        return reject(err);
      }

      if (!row) {
        console.warn('[TokenService] Token not found');
        return resolve(null);
      }

      // トークンが既に使用済み
      if (row.used) {
        console.warn('[TokenService] Token already used');
        return resolve(null);
      }

      // トークンの有効期限チェック
      const expiresAt = new Date(row.expires_at);
      if (expiresAt < new Date()) {
        console.warn('[TokenService] Token expired');
        return resolve(null);
      }

      resolve(row);
    });
  });
}

/**
 * パスワードリセットトークンを使用済みにマーク
 * @param {string} token - リセットトークン
 * @returns {Promise<void>}
 */
function markTokenAsUsed(token) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE password_reset_tokens
      SET used = 1, used_at = ?
      WHERE token = ?`;

    db.run(sql, [new Date().toISOString(), token], (err) => {
      if (err) {
        console.error('[TokenService] Error marking token as used:', err);
        return reject(err);
      }

      console.log('[TokenService] Token marked as used');
      resolve();
    });
  });
}

/**
 * 期限切れトークンをクリーンアップ
 * @returns {Promise<number>} 削除されたトークン数
 */
function cleanupExpiredTokens() {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM password_reset_tokens
      WHERE expires_at < ?`;

    db.run(sql, [new Date().toISOString()], function (err) {
      if (err) {
        console.error('[TokenService] Error cleaning up expired tokens:', err);
        return reject(err);
      }

      console.log(`[TokenService] Cleaned up ${this.changes} expired tokens`);
      resolve(this.changes);
    });
  });
}

/**
 * ユーザーの既存の未使用トークンを無効化
 * @param {number} userId - ユーザーID
 * @returns {Promise<void>}
 */
function invalidateUserTokens(userId) {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE password_reset_tokens
      SET used = 1
      WHERE user_id = ? AND used = 0`;

    db.run(sql, [userId], function (err) {
      if (err) {
        console.error('[TokenService] Error invalidating user tokens:', err);
        return reject(err);
      }

      console.log(`[TokenService] Invalidated ${this.changes} tokens for user ${userId}`);
      resolve();
    });
  });
}

module.exports = {
  generateSecureToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  cleanupExpiredTokens,
  invalidateUserTokens
};
