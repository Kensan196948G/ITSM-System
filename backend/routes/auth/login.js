const express = require('express');
const authService = require('../../services/authService');
const { authLimiter } = require('../../middleware/rateLimiter');
const { validate, authValidation } = require('../../middleware/validation');
const { trackLogin } = require('../../middleware/userActivity');

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: ユーザーログイン
 *     description: ユーザー名とパスワードでログインし、JWT トークンを HttpOnly クッキーに設定します
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               totpToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: ログイン成功
 *       401:
 *         description: 認証失敗
 */
router.post('/login', authLimiter, authValidation.login, validate, async (req, res) => {
  const { username, password, totpToken } = req.body;

  try {
    const result = await authService.login(username, password, totpToken);

    if (result.requires2FA) {
      return res.status(400).json({
        error: '2FAトークンが必要です',
        requires2FA: true
      });
    }

    // Track successful login
    trackLogin(result.user.id, req.ip, req.headers['user-agent'], true).catch((err) => {
      console.error('[Login] Failed to track login:', err.message);
    });

    // Set JWT in HttpOnly cookie
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    return res.json({
      message: 'ログインに成功しました',
      user: result.user
    });
  } catch (error) {
    // Track failed login
    trackLogin(null, req.ip, req.headers['user-agent'], false, error.message).catch((err) => {
      console.error('[Login] Failed to track login:', err.message);
    });

    return res.status(401).json({
      error: 'ユーザー名またはパスワードが間違っています'
    });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: ログアウト
 *     description: JWT クッキーをクリアします
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: ログアウト成功
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'ログアウトしました' });
});

module.exports = router;
