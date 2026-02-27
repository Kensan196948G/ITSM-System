/**
 * Token Service
 * パスワードリセットトークン、JWTブラックリスト、リフレッシュトークンの管理
 *
 * セキュリティ機能:
 * - パスワードリセットトークン
 * - JWTブラックリスト（ログアウト・パスワード変更時の無効化）
 * - リフレッシュトークン（セッション延長）
 * - トークンローテーション（リプレイ攻撃防止）
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const logger = require('../utils/logger');

/**
 * セキュアなランダムトークンを生成
 * @param {number} length - トークンの長さ（バイト数）
 * @returns {string} ランダムなトークン（16進数文字列）
 */
function generateSecureToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

// hashToken は下部 (L196) で定義済みのため前方参照で利用可能（hoisting不可のため関数宣言を使用）
// → 下部定義のみを使用するため、上部への重複定義は不要

/**
 * トークンのSHA-256ハッシュを生成（DB保存用）
 * プレーンテキストトークンは外部（メール）にのみ送信し、DBにはハッシュのみ保存
 * @param {string} token - 元のトークン
 * @returns {string} SHA-256ハッシュ（hex）
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
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
    const token = generateSecureToken(32); // 64文字の16進数文字列（メール送信用）
    const tokenHash = hashToken(token); // DBにはハッシュのみ保存
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間後

    const sql = `INSERT INTO password_reset_tokens (
      user_id, token, email, expires_at, ip_address
    ) VALUES (?, ?, ?, ?, ?)`;

    db.run(sql, [userId, tokenHash, email, expiresAt.toISOString(), ipAddress], function (err) {
      if (err) {
        logger.error('[TokenService] Error creating reset token:', err);
        return reject(err);
      }

      logger.info(`[TokenService] Password reset token created for user ${userId}`);
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
    const tokenHash = hashToken(token); // DBのハッシュと照合
    const sql = `SELECT
      id, user_id, email, expires_at, used
    FROM password_reset_tokens
    WHERE token = ?`;

    db.get(sql, [tokenHash], (err, row) => {
      if (err) {
        logger.error('[TokenService] Error validating token:', err);
        return reject(err);
      }

      if (!row) {
        logger.warn('[TokenService] Token not found');
        return resolve(null);
      }

      // トークンが既に使用済み
      if (row.used) {
        logger.warn('[TokenService] Token already used');
        return resolve(null);
      }

      // トークンの有効期限チェック
      const expiresAt = new Date(row.expires_at);
      if (expiresAt < new Date()) {
        logger.warn('[TokenService] Token expired');
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
    const tokenHash = hashToken(token); // DBのハッシュで検索
    const sql = `UPDATE password_reset_tokens
      SET used = 1, used_at = ?
      WHERE token = ?`;

    db.run(sql, [new Date().toISOString(), tokenHash], (err) => {
      if (err) {
        logger.error('[TokenService] Error marking token as used:', err);
        return reject(err);
      }

      logger.info('[TokenService] Token marked as used');
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
        logger.error('[TokenService] Error cleaning up expired tokens:', err);
        return reject(err);
      }

      logger.info(`[TokenService] Cleaned up ${this.changes} expired tokens`);
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
        logger.error('[TokenService] Error invalidating user tokens:', err);
        return reject(err);
      }

      logger.info(`[TokenService] Invalidated ${this.changes} tokens for user ${userId}`);
      resolve();
    });
  });
}

// ========================================
// JWT Blacklist Functions
// ========================================

/**
 * JTI（JWT ID）を生成
 * @returns {string} ユニークなJTI
 */
function generateJti() {
  return uuidv4();
}

/**
 * JWTをブラックリストに追加
 * @param {string} jti - JWT ID
 * @param {number} userId - ユーザーID
 * @param {Date|string} expiresAt - 元トークンの有効期限
 * @param {string} reason - ブラックリスト追加理由
 * @param {string} ipAddress - IPアドレス
 * @returns {Promise<void>}
 */
function blacklistToken(jti, userId, expiresAt, reason = 'logout', ipAddress = null) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO token_blacklist (jti, user_id, expires_at, reason, ip_address)
      VALUES (?, ?, ?, ?, ?)
    `;
    const expiresAtStr = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
    db.run(sql, [jti, userId, expiresAtStr, reason, ipAddress], function (err) {
      if (err) {
        // 重複エラーは無視（既にブラックリスト済み）
        if (err.message && err.message.includes('UNIQUE constraint')) {
          logger.info(`[TokenService] Token ${jti} already blacklisted`);
          return resolve();
        }
        logger.error('[TokenService] Error blacklisting token:', err);
        return reject(err);
      }
      logger.info(`[TokenService] Token ${jti} blacklisted (reason: ${reason})`);
      resolve();
    });
  });
}

/**
 * JWTがブラックリストに存在するか確認
 * @param {string} jti - JWT ID
 * @returns {Promise<boolean>} ブラックリスト済みならtrue
 */
function isTokenBlacklisted(jti) {
  return new Promise((resolve, reject) => {
    db.get('SELECT id FROM token_blacklist WHERE jti = ?', [jti], (err, row) => {
      if (err) {
        logger.error('[TokenService] Error checking blacklist:', err);
        return reject(err);
      }
      resolve(!!row);
    });
  });
}

/**
 * ユーザーの全リフレッシュトークンを無効化（パスワード変更時など）
 * @param {number} userId - ユーザーID
 * @param {string} reason - 無効化理由
 * @returns {Promise<number>} 無効化されたトークン数
 */
function revokeAllUserRefreshTokens(userId, reason = 'password_change') {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE refresh_tokens
      SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP, revoke_reason = ?
      WHERE user_id = ? AND is_revoked = 0
    `;
    db.run(sql, [reason, userId], function (err) {
      if (err) {
        logger.error('[TokenService] Error revoking refresh tokens:', err);
        return reject(err);
      }
      logger.info(`[TokenService] Revoked ${this.changes} refresh tokens for user ${userId}`);
      resolve(this.changes);
    });
  });
}

// ========================================
// Refresh Token Functions
// ========================================

/**
 * リフレッシュトークンを生成
 * @returns {string} 64バイトのランダムトークン
 */
function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * リフレッシュトークンを保存
 * @param {number} userId - ユーザーID
 * @param {string} refreshToken - リフレッシュトークン（プレーンテキスト）
 * @param {string} familyId - トークンファミリーID
 * @param {string} deviceInfo - デバイス情報
 * @param {string} ipAddress - IPアドレス
 * @param {number} expiresInDays - 有効期限（日数）
 * @returns {Promise<void>}
 */
function saveRefreshToken(
  userId,
  refreshToken,
  familyId,
  deviceInfo = null,
  ipAddress = null,
  expiresInDays = 7
) {
  return new Promise((resolve, reject) => {
    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const sql = `
      INSERT INTO refresh_tokens (user_id, token_hash, family_id, device_info, ip_address, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    db.run(
      sql,
      [userId, tokenHash, familyId, deviceInfo, ipAddress, expiresAt.toISOString()],
      function (err) {
        if (err) {
          logger.error('[TokenService] Error saving refresh token:', err);
          return reject(err);
        }
        logger.info(`[TokenService] Refresh token saved for user ${userId} (family: ${familyId})`);
        resolve();
      }
    );
  });
}

/**
 * リフレッシュトークンを検証
 * @param {string} refreshToken - リフレッシュトークン（プレーンテキスト）
 * @returns {Promise<Object|null>} トークン情報またはnull
 */
function validateRefreshToken(refreshToken) {
  return new Promise((resolve, reject) => {
    const tokenHash = hashToken(refreshToken);

    const sql = `
      SELECT rt.*, u.username, u.email, u.role, u.is_active, u.full_name
      FROM refresh_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = ?
        AND rt.is_revoked = 0
        AND rt.expires_at > CURRENT_TIMESTAMP
        AND u.is_active = 1
    `;
    db.get(sql, [tokenHash], (err, row) => {
      if (err) {
        logger.error('[TokenService] Error validating refresh token:', err);
        return reject(err);
      }
      if (!row) {
        logger.warn('[TokenService] Invalid or expired refresh token');
        return resolve(null);
      }

      // 最終使用日時を更新
      db.run('UPDATE refresh_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);

      resolve(row);
    });
  });
}

/**
 * リフレッシュトークンをローテーション（新しいトークンを発行し、古いトークンを無効化）
 * @param {string} oldRefreshToken - 古いリフレッシュトークン
 * @param {string} deviceInfo - デバイス情報
 * @param {string} ipAddress - IPアドレス
 * @returns {Promise<{newToken: string, user: Object}|null>}
 */
async function rotateRefreshToken(oldRefreshToken, deviceInfo = null, ipAddress = null) {
  const tokenData = await validateRefreshToken(oldRefreshToken);
  if (!tokenData) return null;

  const oldTokenHash = hashToken(oldRefreshToken);
  const newRefreshToken = generateRefreshToken();

  // 古いトークンを無効化
  await new Promise((resolve, reject) => {
    db.run(
      `UPDATE refresh_tokens
       SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'rotation'
       WHERE token_hash = ?`,
      [oldTokenHash],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });

  // 新しいトークンを保存（同じファミリーID）
  await saveRefreshToken(
    tokenData.user_id,
    newRefreshToken,
    tokenData.family_id,
    deviceInfo,
    ipAddress
  );

  logger.info(`[TokenService] Refresh token rotated for user ${tokenData.user_id}`);

  return {
    newToken: newRefreshToken,
    user: {
      id: tokenData.user_id,
      username: tokenData.username,
      email: tokenData.email,
      role: tokenData.role,
      full_name: tokenData.full_name
    }
  };
}

/**
 * トークンファミリー全体を無効化（リプレイ攻撃検出時）
 * @param {string} familyId - トークンファミリーID
 * @param {string} reason - 無効化理由
 * @returns {Promise<number>} 無効化されたトークン数
 */
function revokeTokenFamily(familyId, reason = 'security_concern') {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE refresh_tokens
       SET is_revoked = 1, revoked_at = CURRENT_TIMESTAMP, revoke_reason = ?
       WHERE family_id = ?`,
      [reason, familyId],
      function (err) {
        if (err) {
          logger.error('[TokenService] Error revoking token family:', err);
          return reject(err);
        }
        logger.warn(`[TokenService] Token family ${familyId} revoked (reason: ${reason})`);
        resolve(this.changes);
      }
    );
  });
}

/**
 * ユーザーのアクティブセッション一覧を取得
 * @param {number} userId - ユーザーID
 * @returns {Promise<Array>} セッション一覧
 */
function getUserSessions(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT family_id, device_info, ip_address, created_at, last_used_at
       FROM refresh_tokens
       WHERE user_id = ? AND is_revoked = 0 AND expires_at > CURRENT_TIMESTAMP
       GROUP BY family_id
       ORDER BY last_used_at DESC`,
      [userId],
      (err, rows) => {
        if (err) {
          logger.error('[TokenService] Error getting user sessions:', err);
          return reject(err);
        }
        resolve(rows || []);
      }
    );
  });
}

/**
 * 期限切れトークンの包括的クリーンアップ
 * @returns {Promise<{passwordReset: number, blacklist: number, refreshTokens: number}>}
 */
async function cleanupAllExpiredTokens() {
  const now = new Date().toISOString();

  // パスワードリセットトークン
  const passwordResetDeleted = await new Promise((resolve, reject) => {
    db.run('DELETE FROM password_reset_tokens WHERE expires_at < ?', [now], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });

  // ブラックリスト
  const blacklistDeleted = await new Promise((resolve, reject) => {
    db.run('DELETE FROM token_blacklist WHERE expires_at < ?', [now], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });

  // リフレッシュトークン
  const refreshDeleted = await new Promise((resolve, reject) => {
    db.run('DELETE FROM refresh_tokens WHERE expires_at < ?', [now], function (err) {
      if (err) return reject(err);
      resolve(this.changes);
    });
  });

  logger.info(
    `[TokenService] Cleanup: ${passwordResetDeleted} password reset, ${blacklistDeleted} blacklist, ${refreshDeleted} refresh tokens`
  );

  return {
    passwordReset: passwordResetDeleted,
    blacklist: blacklistDeleted,
    refreshTokens: refreshDeleted
  };
}

module.exports = {
  // Password Reset Token functions
  generateSecureToken,
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  cleanupExpiredTokens,
  invalidateUserTokens,

  // JWT Blacklist functions
  generateJti,
  hashToken,
  blacklistToken,
  isTokenBlacklisted,
  revokeAllUserRefreshTokens,

  // Refresh Token functions
  generateRefreshToken,
  saveRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeTokenFamily,
  getUserSessions,
  cleanupAllExpiredTokens
};
