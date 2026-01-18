const express = require('express');
const authService = require('../../services/authService');
const tokenService = require('../../services/tokenService');
const { authLimiter } = require('../../middleware/rateLimiter');
const { validate, authValidation } = require('../../middleware/validation');
const { trackLogin } = require('../../middleware/userActivity');
const { authenticateJWT } = require('../../middleware/auth');

const router = express.Router();

// Cookie設定の共通関数
const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 60 * 60 * 1000 // 1 hour (matches JWT_EXPIRES_IN default)
});

const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/auth', // Only send to auth endpoints
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

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
  const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
  const ipAddress = req.ip;

  try {
    const result = await authService.loginWithRefreshToken(
      username,
      password,
      totpToken,
      deviceInfo,
      ipAddress
    );

    if (result.requires2FA) {
      return res.status(400).json({
        error: '2FAトークンが必要です',
        requires2FA: true
      });
    }

    // Track successful login
    trackLogin(result.user.id, ipAddress, deviceInfo, true).catch((err) => {
      console.error('[Login] Failed to track login:', err.message);
    });

    // Set access token in HttpOnly cookie
    res.cookie('token', result.token, getAccessTokenCookieOptions());

    // Set refresh token in HttpOnly cookie (restricted path)
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());

    return res.json({
      message: 'ログインに成功しました',
      token: result.token,
      user: result.user,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    // Track failed login
    trackLogin(null, ipAddress, deviceInfo, false, error.message).catch((err) => {
      console.error('[Login] Failed to track login:', err.message);
    });

    return res.status(401).json({
      error: 'ユーザー名またはパスワードが間違っています'
    });
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: アクセストークンを更新
 *     description: リフレッシュトークンを使用して新しいアクセストークンを取得します
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: トークン更新成功
 *       401:
 *         description: リフレッシュトークンが無効
 */
router.post('/refresh', async (req, res) => {
  // Get refresh token from cookie or body
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
  const ipAddress = req.ip;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'リフレッシュトークンがありません',
      message: 'Refresh token is required'
    });
  }

  try {
    const result = await authService.refreshAccessToken(refreshToken, deviceInfo, ipAddress);

    if (!result) {
      // Clear cookies on invalid refresh token
      res.clearCookie('token');
      res.clearCookie('refreshToken', { path: '/auth' });

      return res.status(401).json({
        error: 'リフレッシュトークンが無効または期限切れです',
        message: 'Invalid or expired refresh token. Please login again.'
      });
    }

    // Set new access token
    res.cookie('token', result.token, getAccessTokenCookieOptions());

    // Set new refresh token (rotated)
    res.cookie('refreshToken', result.refreshToken, getRefreshTokenCookieOptions());

    return res.json({
      message: 'トークンを更新しました',
      token: result.token,
      user: result.user,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('[Refresh] Token refresh error:', error);
    return res.status(500).json({
      error: 'トークン更新中にエラーが発生しました'
    });
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: ログアウト
 *     description: JWT トークンをブラックリストに追加し、クッキーをクリアします
 *     tags: [Authentication]
 *     parameters:
 *       - in: query
 *         name: allDevices
 *         schema:
 *           type: boolean
 *         description: 全デバイスからログアウトする場合はtrue
 *     responses:
 *       200:
 *         description: ログアウト成功
 */
router.post('/logout', authenticateJWT, async (req, res) => {
  const revokeAllSessions = req.query.allDevices === 'true';
  const ipAddress = req.ip;

  try {
    // If token has JTI, blacklist it
    if (req.user && req.user.jti) {
      const expiresAt = new Date(req.user.exp * 1000); // JWT exp is in seconds
      await authService.logout(req.user.jti, req.user.id, expiresAt, ipAddress, revokeAllSessions);
    } else if (req.user && revokeAllSessions) {
      // Even without JTI, revoke all refresh tokens if requested
      await tokenService.revokeAllUserRefreshTokens(req.user.id, 'logout_all');
    }

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken', { path: '/auth' });

    res.json({
      message: revokeAllSessions ? '全デバイスからログアウトしました' : 'ログアウトしました'
    });
  } catch (error) {
    console.error('[Logout] Error:', error);
    // Clear cookies anyway
    res.clearCookie('token');
    res.clearCookie('refreshToken', { path: '/auth' });
    res.json({ message: 'ログアウトしました' });
  }
});

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: アクティブセッション一覧を取得
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: セッション一覧
 */
router.get('/sessions', authenticateJWT, async (req, res) => {
  try {
    const sessions = await tokenService.getUserSessions(req.user.id);
    res.json({
      sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('[Sessions] Error:', error);
    res.status(500).json({
      error: 'セッション一覧の取得に失敗しました'
    });
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: 現在のユーザー情報を取得
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ユーザー情報
 *       401:
 *         description: 認証エラー
 */
router.get('/me', authenticateJWT, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    full_name: req.user.full_name || req.user.username
  });
});

module.exports = router;
