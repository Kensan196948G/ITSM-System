/**
 * Two-Factor Authentication (2FA) Routes
 * TOTP-based 2FA implementation with QR codes and backup codes
 */

const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { db } = require('../../db');
const { authenticateJWT } = require('../../middleware/auth');

const router = express.Router();

/**
 * Generate backup codes
 * Creates 10 random backup codes for emergency access
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

/**
 * POST /api/v1/auth/2fa/setup
 * Generate TOTP secret and QR code for 2FA setup
 */
router.post('/setup', authenticateJWT, async (req, res) => {
  try {
    const { username } = req.user;

    // Generate TOTP secret
    const secret = speakeasy.generateSecret({
      name: `ITSM-Sec Nexus (${username})`,
      issuer: 'ITSM-Sec Nexus',
      length: 32
    });

    // Store temporary secret (not yet enabled)
    db.run(
      'UPDATE users SET totp_secret = ? WHERE username = ?',
      [secret.base32, username],
      (err) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ error: 'データベースエラー' });
        }

        // Generate QR code
        QRCode.toDataURL(secret.otpauth_url, (qrErr, dataUrl) => {
          if (qrErr) {
            console.error('QR code generation error:', qrErr);
            return res.status(500).json({ error: 'QRコード生成エラー' });
          }

          res.json({
            message: '2FA設定用のQRコードを生成しました',
            qrCode: dataUrl,
            secret: secret.base32,
            otpauthUrl: secret.otpauth_url,
            instructions:
              'Google AuthenticatorまたはAuthyアプリでQRコードをスキャンしてください。その後、/verifyエンドポイントでトークンを検証して2FAを有効化してください。'
          });
        });
      }
    );
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: '内部サーバーエラー' });
  }
});

/**
 * POST /api/v1/auth/2fa/verify
 * Verify TOTP token and enable 2FA
 */
router.post('/verify', authenticateJWT, (req, res) => {
  const { token } = req.body;
  const { username } = req.user;

  if (!token) {
    return res.status(400).json({ error: 'トークンは必須です' });
  }

  // Get user's TOTP secret
  db.get('SELECT totp_secret FROM users WHERE username = ?', [username], (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'データベースエラー' });
    }

    if (!row || !row.totp_secret) {
      return res
        .status(400)
        .json({ error: '2FA設定が見つかりません。先に/setupエンドポイントを呼び出してください' });
    }

    // Verify token
    const verified = speakeasy.totp.verify({
      secret: row.totp_secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after for clock drift
    });

    if (!verified) {
      return res.status(400).json({ error: '無効なトークンです' });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();

    // Enable 2FA
    db.run(
      'UPDATE users SET totp_enabled = 1, backup_codes = ? WHERE username = ?',
      [JSON.stringify(backupCodes), username],
      (updateErr) => {
        if (updateErr) {
          console.error('Database error:', updateErr);
          return res.status(500).json({ error: 'データベースエラー' });
        }

        console.log(`[SECURITY] 2FA enabled for user: ${username}`);

        res.json({
          message: '2FAが正常に有効化されました',
          backupCodes,
          warning:
            'バックアップコードを安全な場所に保存してください。デバイスを紛失した場合、これらのコードでログインできます。'
        });
      }
    );
  });
});

/**
 * POST /api/v1/auth/2fa/disable
 * Disable 2FA for current user
 */
router.post('/disable', authenticateJWT, (req, res) => {
  const { password, token } = req.body;
  const { username } = req.user;

  if (!password) {
    return res.status(400).json({ error: 'パスワードは必須です' });
  }

  // Get user info
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'データベースエラー' });
    }

    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'パスワードが間違っています' });
    }

    // If 2FA is enabled, verify token
    if (user.totp_enabled && user.totp_secret) {
      if (!token) {
        return res.status(400).json({ error: '2FA無効化には現在のトークンが必要です' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (!verified) {
        return res.status(400).json({ error: '無効なトークンです' });
      }
    }

    // Disable 2FA
    db.run(
      'UPDATE users SET totp_enabled = 0, totp_secret = NULL, backup_codes = NULL WHERE username = ?',
      [username],
      (updateErr) => {
        if (updateErr) {
          console.error('Database error:', updateErr);
          return res.status(500).json({ error: 'データベースエラー' });
        }

        console.log(`[SECURITY] 2FA disabled for user: ${username}`);

        res.json({
          message: '2FAが正常に無効化されました'
        });
      }
    );
  });
});

/**
 * GET /api/v1/auth/2fa/status
 * Get 2FA status for current user
 */
router.get('/status', authenticateJWT, (req, res) => {
  const { username } = req.user;

  db.get(
    'SELECT totp_enabled, totp_secret FROM users WHERE username = ?',
    [username],
    (err, row) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'データベースエラー' });
      }

      res.json({
        enabled: Boolean(row && row.totp_enabled),
        configured: Boolean(row && row.totp_secret)
      });
    }
  );
});

module.exports = router;
