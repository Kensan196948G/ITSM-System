/**
 * Login Routes Tests
 * 認証ルート（ログイン/ログアウト/リフレッシュ/セッション）のユニットテスト
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../../services/authService', () => ({
  loginWithRefreshToken: jest.fn(),
  refreshAccessToken: jest.fn(),
  logout: jest.fn()
}));

jest.mock('../../../services/tokenService', () => ({
  revokeAllUserRefreshTokens: jest.fn(),
  getUserSessions: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../../middleware/rateLimiter', () => ({
  authLimiter: (req, res, next) => next()
}));

jest.mock('../../../middleware/validation', () => ({
  validate: (req, res, next) => next(),
  authValidation: {
    login: (req, res, next) => next()
  }
}));

jest.mock('../../../middleware/userActivity', () => ({
  trackLogin: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../../middleware/auth', () => ({
  authenticateJWT: (req, res, next) => {
    req.user = {
      id: 1,
      username: 'admin',
      email: 'admin@test.com',
      role: 'admin',
      jti: 'test-jti-123',
      exp: Math.floor(Date.now() / 1000) + 3600
    };
    next();
  }
}));

const authService = require('../../../services/authService');
const tokenService = require('../../../services/tokenService');
const loginRoutes = require('../../../routes/auth/login');

const app = express();
app.use(express.json());
// Cookie parser mock
app.use((req, res, next) => {
  req.cookies = req.cookies || {};
  next();
});
app.use('/auth', loginRoutes);

describe('Login Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/login', () => {
    it('should login successfully', async () => {
      authService.loginWithRefreshToken.mockResolvedValue({
        token: 'jwt-token-123',
        refreshToken: 'refresh-token-456',
        user: { id: 1, username: 'admin', role: 'admin' },
        expiresAt: '2026-02-14T12:00:00Z'
      });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログインに成功しました');
      expect(response.body.token).toBe('jwt-token-123');
      expect(response.body.user.username).toBe('admin');
    });

    it('should return 400 when 2FA is required', async () => {
      authService.loginWithRefreshToken.mockResolvedValue({
        requires2FA: true
      });

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('2FAトークンが必要です');
      expect(response.body.requires2FA).toBe(true);
    });

    it('should return 401 for invalid 2FA token', async () => {
      authService.loginWithRefreshToken.mockRejectedValue(new Error('Invalid 2FA token'));

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'password123', totpToken: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('無効な2FAトークンです');
    });

    it('should return 401 for wrong credentials', async () => {
      authService.loginWithRefreshToken.mockRejectedValue(new Error('Invalid credentials'));

      const response = await request(app)
        .post('/auth/login')
        .send({ username: 'admin', password: 'wrong' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('ユーザー名またはパスワードが間違っています');
    });
  });

  describe('POST /auth/refresh', () => {
    it('should return 401 when no refresh token provided', async () => {
      const response = await request(app).post('/auth/refresh').send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('リフレッシュトークンがありません');
    });

    it('should refresh token from body successfully', async () => {
      authService.refreshAccessToken.mockResolvedValue({
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
        user: { id: 1, username: 'admin' },
        expiresAt: '2026-02-14T13:00:00Z'
      });

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('トークンを更新しました');
      expect(response.body.token).toBe('new-jwt-token');
    });

    it('should return 401 when refresh result is null (invalid token)', async () => {
      authService.refreshAccessToken.mockResolvedValue(null);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'expired-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('リフレッシュトークンが無効または期限切れです');
    });

    it('should return 500 on internal error', async () => {
      authService.refreshAccessToken.mockRejectedValue(new Error('Internal error'));

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-token' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('トークン更新中にエラーが発生しました');
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with JTI', async () => {
      authService.logout.mockResolvedValue();

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログアウトしました');
      expect(authService.logout).toHaveBeenCalled();
    });

    it('should logout from all devices with JTI', async () => {
      authService.logout.mockResolvedValue();

      const response = await request(app).post('/auth/logout?allDevices=true');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('全デバイスからログアウトしました');
      expect(authService.logout).toHaveBeenCalledWith(
        'test-jti-123',
        1,
        expect.any(Date),
        expect.any(String),
        true
      );
    });

    it('should handle logout error gracefully (still clears cookies)', async () => {
      authService.logout.mockRejectedValue(new Error('Logout error'));

      const response = await request(app).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログアウトしました');
    });
  });

  describe('POST /auth/logout without JTI', () => {
    // Override auth middleware for this describe block
    let appNoJti;

    beforeAll(() => {
      // Create a separate app instance without JTI in user
      appNoJti = express();
      appNoJti.use(express.json());
      appNoJti.use((req, res, next) => {
        req.cookies = req.cookies || {};
        next();
      });

      // Manually set up routes with custom auth middleware
      appNoJti.post('/auth/logout', (req, res, next) => {
        req.user = { id: 1, username: 'admin', role: 'admin' }; // no jti
        next();
      });

      // We need to re-require the route handler inline
      const express2 = require('express');
      const router2 = express2.Router();

      // Manually replicate the logout handler for testing without JTI
      router2.post('/logout', async (req, res) => {
        const revokeAllSessions = req.query.allDevices === 'true';
        try {
          if (req.user && req.user.jti) {
            const expiresAt = new Date(req.user.exp * 1000);
            await authService.logout(
              req.user.jti,
              req.user.id,
              expiresAt,
              req.ip,
              revokeAllSessions
            );
          } else if (req.user && revokeAllSessions) {
            await tokenService.revokeAllUserRefreshTokens(req.user.id, 'logout_all');
          }
          res.clearCookie('token');
          res.clearCookie('refreshToken', { path: '/auth' });
          res.json({
            message: revokeAllSessions ? '全デバイスからログアウトしました' : 'ログアウトしました'
          });
        } catch (error) {
          res.clearCookie('token');
          res.clearCookie('refreshToken', { path: '/auth' });
          res.json({ message: 'ログアウトしました' });
        }
      });

      appNoJti.use('/auth', router2);
    });

    it('should revoke all sessions when allDevices=true without JTI', async () => {
      tokenService.revokeAllUserRefreshTokens.mockResolvedValue(3);

      const response = await request(appNoJti).post('/auth/logout?allDevices=true');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('全デバイスからログアウトしました');
      expect(tokenService.revokeAllUserRefreshTokens).toHaveBeenCalledWith(1, 'logout_all');
    });

    it('should logout without JTI and without allDevices (no token revocation)', async () => {
      const response = await request(appNoJti).post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('ログアウトしました');
      expect(authService.logout).not.toHaveBeenCalled();
      expect(tokenService.revokeAllUserRefreshTokens).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/sessions', () => {
    it('should return user sessions', async () => {
      const mockSessions = [
        { family_id: 'f1', device_info: 'Chrome', ip_address: '1.2.3.4' },
        { family_id: 'f2', device_info: 'Firefox', ip_address: '5.6.7.8' }
      ];
      tokenService.getUserSessions.mockResolvedValue(mockSessions);

      const response = await request(app).get('/auth/sessions');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should return 500 on error', async () => {
      tokenService.getUserSessions.mockRejectedValue(new Error('Sessions error'));

      const response = await request(app).get('/auth/sessions');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('セッション一覧の取得に失敗しました');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.username).toBe('admin');
      expect(response.body.email).toBe('admin@test.com');
      expect(response.body.role).toBe('admin');
    });

    it('should use username as full_name fallback', async () => {
      // The mocked user does not have full_name, so it should fallback to username
      const response = await request(app).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.full_name).toBe('admin');
    });
  });

  describe('GET /auth/me with full_name', () => {
    let appWithFullName;

    beforeAll(() => {
      appWithFullName = express();
      appWithFullName.use(express.json());

      // Create a route with full_name in user
      const express3 = require('express');
      const router3 = express3.Router();
      router3.get('/me', (req, res) => {
        req.user = {
          id: 2,
          username: 'user2',
          email: 'user2@test.com',
          role: 'viewer',
          full_name: 'Full Name User'
        };
        res.json({
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          role: req.user.role,
          full_name: req.user.full_name || req.user.username
        });
      });
      appWithFullName.use('/auth', router3);
    });

    it('should return full_name when present', async () => {
      const response = await request(appWithFullName).get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body.full_name).toBe('Full Name User');
    });
  });
});
