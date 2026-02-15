/**
 * Two-Factor Authentication (2FA) Routes
 * TOTP-based 2FA implementation with QR codes and backup codes
 */

const crypto = require('crypto');
const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcryptjs');
const logger = require('../../utils/logger');
const { db } = require('../../db');
const { authenticateJWT } = require('../../middleware/auth');
const { twoFactorLimiter } = require('../../middleware/rateLimiter');
const { hashBackupCodes } = require('../../utils/2fa');
const { encrypt, decrypt } = require('../../utils/encryption');

const router = express.Router();

/**
 * Generate backup codes
 * Creates 10 random backup codes for emergency access
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i += 1) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

/**
 * @swagger
 * /auth/2fa/setup:
 *   post:
 *     summary: 2FA設定の開始
 *     description: TOTP秘密鍵とQRコードを生成します。
 *     tags: [Security]
 *     responses:
 *       200:
 *         description: QRコード生成成功
 *       500:
 *         description: サーバーエラー
 */
router.post('/setup', authenticateJWT, twoFactorLimiter, async (req, res) => {
  try {
    const { username } = req.user;

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `ITSM-Sec Nexus (${username})`,
      issuer: 'ITSM-Sec Nexus',
      length: 32
    });

    // Encrypt TOTP secret before storage
    const { encrypted, iv, authTag } = encrypt(secret.base32);

    // Store encrypted secret with IV and auth tag
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET totp_secret = ?, totp_secret_iv = ?, totp_secret_auth_tag = ? WHERE username = ?',
        [encrypted, iv, authTag, username],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Generate QR code
    const dataUrl = await new Promise((resolve, reject) => {
      QRCode.toDataURL(secret.otpauth_url, (qrErr, url) => {
        if (qrErr) reject(qrErr);
        else resolve(url);
      });
    });

    res.json({
      message: '2FA設定用のQRコードを生成しました',
      qrCode: dataUrl,
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      instructions:
        'Google AuthenticatorまたはAuthyアプリでQRコードをスキャンしてください。その後、/verifyエンドポイントでトークンを検証して2FAを有効化してください。'
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

/**
 * @swagger
 * /auth/2fa/verify:
 *   post:
 *     summary: 2FAの検証と有効化
 *     description: TOTPトークンを確認し、2FAを正式に有効化します。
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: アプリに表示された6桁のコード
 *     responses:
 *       200:
 *         description: 2FA有効化成功。バックアップコードが返されます。
 *       400:
 *         description: 無効なトークン
 */
router.post('/verify', authenticateJWT, twoFactorLimiter, async (req, res) => {
  const { token } = req.body;
  const { username } = req.user;

  if (!token) {
    return res.status(400).json({ error: 'トークンは必須です' });
  }

  try {
    // Get user's TOTP secret (encrypted)
    const row = await new Promise((resolve, reject) => {
      db.get(
        'SELECT totp_secret, totp_secret_iv, totp_secret_auth_tag FROM users WHERE username = ?',
        [username],
        (err, r) => {
          if (err) reject(err);
          else resolve(r);
        }
      );
    });

    if (!row || !row.totp_secret) {
      return res
        .status(400)
        .json({ error: '2FA設定が見つかりません。先に/setupエンドポイントを呼び出してください' });
    }

    // Decrypt TOTP secret (backward compatible: if iv is null, treat as plaintext)
    let totpSecret = row.totp_secret;
    if (row.totp_secret_iv && row.totp_secret_auth_tag) {
      totpSecret = decrypt(row.totp_secret, row.totp_secret_iv, row.totp_secret_auth_tag);
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: totpSecret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after for clock drift
    });

    if (!verified) {
      return res.status(400).json({ error: '無効なトークンです' });
    }

    // Generate backup codes and hash them before storage
    const backupCodes = generateBackupCodes();
    const hashedCodes = await hashBackupCodes(backupCodes);

    // Enable 2FA with hashed backup codes
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET totp_enabled = 1, backup_codes = ? WHERE username = ?',
        [JSON.stringify(hashedCodes), username],
        (updateErr) => {
          if (updateErr) reject(updateErr);
          else resolve();
        }
      );
    });

    logger.info(`[SECURITY] 2FA enabled for user: ${username}`);

    // Return plaintext codes to user (only time they see them)
    res.json({
      message: '2FAが正常に有効化されました',
      backupCodes,
      warning:
        'バックアップコードを安全な場所に保存してください。デバイスを紛失した場合、これらのコードでログインできます。'
    });
  } catch (error) {
    logger.error('2FA verify error:', error);
    res.status(500).json({ error: 'データベースエラー' });
  }
});

/**
 * @swagger
 * /auth/2fa/disable:
 *   post:
 *     summary: 2FAの無効化
 *     description: パスワード（および有効な場合はトークン）を確認し、2FAを無効化します。
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *               token:
 *                 type: string
 *                 description: 2FAが有効な場合は必須
 *     responses:
 *       200:
 *         description: 2FA無効化成功
 *       401:
 *         description: パスワード不正
 */
router.post('/disable', authenticateJWT, twoFactorLimiter, (req, res) => {
  const { password, token } = req.body;
  const { username } = req.user;

  if (!password) {
    return res.status(400).json({ error: 'パスワードは必須です' });
  }

  // Get user info
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      logger.error('Database error:', err);
      return res.status(500).json({ error: 'データベースエラー' });
    }

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'パスワードが間違っています' });
    }

    // If 2FA is enabled, verify token
    if (user.totp_enabled && user.totp_secret) {
      if (!token) {
        return res.status(400).json({ error: '2FA無効化には現在のトークンが必要です' });
      }

      // Decrypt TOTP secret (backward compatible)
      let totpSecret = user.totp_secret;
      if (user.totp_secret_iv && user.totp_secret_auth_tag) {
        totpSecret = decrypt(user.totp_secret, user.totp_secret_iv, user.totp_secret_auth_tag);
      }

      const verified = speakeasy.totp.verify({
        secret: totpSecret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!verified) {
        return res.status(400).json({ error: '無効なトークンです' });
      }
    }

    // Disable 2FA (clear all 2FA-related columns including encryption metadata)
    db.run(
      'UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_secret_iv = NULL, totp_secret_auth_tag = NULL, backup_codes = NULL WHERE username = ?',
      [username],
      (updateErr) => {
        if (updateErr) {
          logger.error('Database error:', updateErr);
          return res.status(500).json({ error: 'データベースエラー' });
        }

        logger.info(`[SECURITY] 2FA disabled for user: ${username}`);

        res.json({
          message: '2FAが正常に無効化されました'
        });
      }
    );
  });
});

/**
 * @swagger
 * /auth/2fa/status:
 *   get:
 *     summary: 2FAステータスの取得
 *     description: 現在のユーザーの2FA有効化状態を取得します。
 *     tags: [Security]
 *     responses:
 *       200:
 *         description: ステータス取得成功
 */
router.get('/status', authenticateJWT, (req, res) => {
  const { username } = req.user;

  db.get(
    'SELECT totp_enabled, totp_secret, backup_codes FROM users WHERE username = ?',
    [username],
    (err, row) => {
      if (err) {
        logger.error('Database error:', err);
        return res.status(500).json({ error: 'データベースエラー' });
      }

      let backupCodesRemaining = 0;
      if (row && row.backup_codes) {
        try {
          const codes = JSON.parse(row.backup_codes);
          backupCodesRemaining = codes.length;
        } catch (e) {
          backupCodesRemaining = 0;
        }
      }

      res.json({
        enabled: Boolean(row && row.totp_enabled),
        configured: Boolean(row && row.totp_secret),
        backupCodesRemaining
      });
    }
  );
});

/**
 * @swagger
 * /auth/2fa/backup-codes:
 *   post:
 *     summary: バックアップコード再生成
 *     description: 新しいバックアップコードを生成します。既存のコードは無効になります。
 *     tags: [Security]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *               - token
 *             properties:
 *               password:
 *                 type: string
 *                 description: 現在のパスワード
 *               token:
 *                 type: string
 *                 description: 現在の2FAトークン
 *     responses:
 *       200:
 *         description: バックアップコード再生成成功
 *       400:
 *         description: 2FAが有効になっていません
 *       401:
 *         description: パスワードまたはトークンが無効
 */
router.post('/backup-codes', authenticateJWT, twoFactorLimiter, async (req, res) => {
  const { password, token } = req.body;
  const { username } = req.user;

  if (!password) {
    return res.status(400).json({ error: 'パスワードは必須です' });
  }

  if (!token) {
    return res.status(400).json({ error: '2FAトークンは必須です' });
  }

  try {
    // Get user info
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    if (!user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: '2FAが有効になっていません' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'パスワードが間違っています' });
    }

    // Decrypt TOTP secret (backward compatible)
    let totpSecret = user.totp_secret;
    if (user.totp_secret_iv && user.totp_secret_auth_tag) {
      totpSecret = decrypt(user.totp_secret, user.totp_secret_iv, user.totp_secret_auth_tag);
    }

    // Verify TOTP token
    const verified = speakeasy.totp.verify({
      secret: totpSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ error: '無効な2FAトークンです' });
    }

    // Generate new backup codes and hash them
    const backupCodes = generateBackupCodes();
    const hashedCodes = await hashBackupCodes(backupCodes);

    // Update database with hashed codes
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET backup_codes = ? WHERE username = ?',
        [JSON.stringify(hashedCodes), username],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info(`[SECURITY] Backup codes regenerated for user: ${username}`);

    // Return plaintext codes to user (only time they see them)
    res.json({
      message: 'バックアップコードが再生成されました',
      backupCodes,
      warning:
        'これらの新しいバックアップコードを安全な場所に保存してください。以前のコードは無効になりました。'
    });
  } catch (error) {
    logger.error('Backup codes regeneration error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

module.exports = router;
