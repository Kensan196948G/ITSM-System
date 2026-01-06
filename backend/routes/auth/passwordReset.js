/**
 * Password Reset Routes
 * パスワードリセット機能のAPIエンドポイント
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { db } = require('../../db');
const { authLimiter } = require('../../middleware/rateLimiter');
const { sendPasswordResetEmail } = require('../../services/emailService');
const {
  authValidation,
  validate
} = require('../../middleware/validation');
const {
  createPasswordResetToken,
  validatePasswordResetToken,
  markTokenAsUsed,
  invalidateUserTokens
} = require('../../services/tokenService');

const router = express.Router();

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: パスワードリセット要求
 *     description: メールアドレスを入力し、パスワードリセット用のリンクをメールで送信します。
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: 要求受け入れ成功（メールが送信されたか、ユーザーが存在しない場合でも同じメッセージを返します）
 *       400:
 *         description: バリデーションエラー
 */
router.post('/forgot-password', authLimiter, authValidation.forgotPassword, validate, async (req, res) => {
    const { email } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    try {
      // ユーザーの存在確認
      const sql = 'SELECT id, username, email, is_active FROM users WHERE email = ?';

      db.get(sql, [email], async (err, user) => {
        if (err) {
          console.error('[PasswordReset] Database error:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        // セキュリティ上、ユーザーが存在しない場合でも同じレスポンスを返す
        if (!user) {
          console.warn(`[PasswordReset] Password reset requested for non-existent email: ${email}`);
          // タイミング攻撃対策: 同じレスポンスを返す
          return res.json({
            message:
              'パスワードリセットのリンクを送信しました。メールをご確認ください。（メールアドレスが登録されている場合）'
          });
        }

        // アカウントが無効化されている場合
        if (!user.is_active) {
          console.warn(`[PasswordReset] Password reset requested for inactive user: ${user.id}`);
          return res.json({
            message:
              'パスワードリセットのリンクを送信しました。メールをご確認ください。（メールアドレスが登録されている場合）'
          });
        }

        // 既存の未使用トークンを無効化
        await invalidateUserTokens(user.id);

        // 新しいトークンを生成
        const tokenInfo = await createPasswordResetToken(user.id, user.email, ipAddress);

        console.log(`[PasswordReset] Reset token created for user ${user.id} (${user.email})`);

        // メール送信
        try {
          await sendPasswordResetEmail(user.email, user.username, tokenInfo.token);
        } catch (mailErr) {
          console.error('[PasswordReset] Failed to send reset email:', mailErr);
          // メール送信に失敗しても、セキュリティ上は「送信しました」と返すのが一般的
          // ただし、内部的にはエラーログを残す
        }

        // 開発環境では、トークンをログに出力（本番環境では削除すること）
        if (process.env.NODE_ENV === 'development') {
          console.log(`[PasswordReset] Development mode: Reset token = ${tokenInfo.token}`);
          console.log(
            `[PasswordReset] Reset URL: https://192.168.0.187:5050/reset-password?token=${tokenInfo.token}`
          );
        }

        res.json({
          message:
            'パスワードリセットのリンクを送信しました。メールをご確認ください。（メールアドレスが登録されている場合）'
        });
      });
    } catch (error) {
      console.error('[PasswordReset] Error:', error);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: パスワードリセット実行
 *     description: 有効なトークンを使用して新しいパスワードを設定します。
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - new_password
 *             properties:
 *               token:
 *                 type: string
 *                 description: リセットトークン
 *               new_password:
 *                 type: string
 *                 description: 新しいパスワード
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: パスワードリセット成功
 *       400:
 *         description: トークンが無効またはパスワードポリシー違反
 *       500:
 *         description: 内部サーバーエラー
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('トークンが必要です'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('パスワードは8文字以上である必要があります')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, new_password } = req.body;

    try {
      // トークンの検証
      const tokenInfo = await validatePasswordResetToken(token);

      if (!tokenInfo) {
        return res.status(400).json({
          error: 'トークンが無効、期限切れ、または既に使用されています'
        });
      }

      // パスワードのハッシュ化
      const passwordHash = await bcrypt.hash(new_password, 10);

      // パスワードを更新
      const updateSql = 'UPDATE users SET password_hash = ? WHERE id = ?';

      db.run(updateSql, [passwordHash, tokenInfo.user_id], async (err) => {
        if (err) {
          console.error('[PasswordReset] Error updating password:', err);
          return res.status(500).json({ error: '内部サーバーエラー' });
        }

        // トークンを使用済みにマーク
        await markTokenAsUsed(token);

        console.log(`[PasswordReset] Password reset successful for user ${tokenInfo.user_id}`);

        // 監査ログに記録
        const auditSql = `INSERT INTO audit_logs (
          user_id, action, resource_type, resource_id,
          ip_address, is_security_action
        ) VALUES (?, ?, ?, ?, ?, ?)`;

        const ipAddress = req.ip || req.connection.remoteAddress;

        db.run(
          auditSql,
          [tokenInfo.user_id, 'password_reset', 'users', tokenInfo.user_id, ipAddress, 1],
          (auditErr) => {
            if (auditErr) {
              console.error('[PasswordReset] Error logging audit:', auditErr);
            }
          }
        );

        res.json({
          message: 'パスワードが正常にリセットされました。新しいパスワードでログインしてください。'
        });
      });
    } catch (error) {
      console.error('[PasswordReset] Error:', error);
      return res.status(500).json({ error: '内部サーバーエラー' });
    }
  }
);

/**
 * @swagger
 * /auth/verify-reset-token/{token}:
 *   get:
 *     summary: トークンの有効性確認
 *     description: パスワードリセットトークンが有効かどうかを確認します（検証のみ）。
 *     tags: [Authentication]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: 検証するトークン
 *     responses:
 *       200:
 *         description: トークン有効
 *       400:
 *         description: トークン無効または期限切れ
 *       500:
 *         description: 内部サーバーエラー
 */
router.get('/verify-reset-token/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const tokenInfo = await validatePasswordResetToken(token);

    if (!tokenInfo) {
      return res.status(400).json({
        valid: false,
        error: 'トークンが無効、期限切れ、または既に使用されています'
      });
    }

    res.json({
      valid: true,
      email: tokenInfo.email,
      expires_at: tokenInfo.expires_at
    });
  } catch (error) {
    console.error('[PasswordReset] Error verifying token:', error);
    return res.status(500).json({ error: '内部サーバーエラー' });
  }
});

module.exports = router;
