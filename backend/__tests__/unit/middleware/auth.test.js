/**
 * Auth Middleware Tests
 * JWT認証・RBAC・オプショナル認証のユニットテスト
 */

const jwt = require('jsonwebtoken');

// Mock tokenService for blacklist checks
jest.mock('../../../services/tokenService', () => ({
  isTokenBlacklisted: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const tokenService = require('../../../services/tokenService');
const { authenticateJWT, authorize, optionalAuth } = require('../../../middleware/auth');

// Ensure JWT_SECRET is set
process.env.JWT_SECRET = 'test-secret-key';

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tokenService.isTokenBlacklisted.mockResolvedValue(false);
  });

  describe('authenticateJWT', () => {
    it('should authenticate with valid Bearer token', async () => {
      const token = jwt.sign(
        { id: 1, username: 'admin', role: 'admin', jti: 'test-jti' },
        process.env.JWT_SECRET
      );

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);

      // jwt.verify is async callback, so we need to wait
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.username).toBe('admin');
      expect(req.token).toBe(token);
    });

    it('should authenticate with cookie token when no Authorization header', async () => {
      const token = jwt.sign({ id: 2, username: 'user2', role: 'viewer' }, process.env.JWT_SECRET);

      const req = {
        headers: {},
        cookies: { token }
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user.username).toBe('user2');
    });

    it('should return 401 when no token provided', async () => {
      const req = { headers: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: '認証トークンがありません' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is not Bearer format', async () => {
      const req = { headers: { authorization: 'Basic abc123' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 for invalid token', async () => {
      const req = { headers: { authorization: 'Bearer invalid-jwt-token' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'トークンが無効または期限切れです' })
      );
    });

    it('should return 403 for expired token', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '-1h'
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should check blacklist when JTI is present', async () => {
      tokenService.isTokenBlacklisted.mockResolvedValue(false);

      const token = jwt.sign(
        { id: 1, username: 'admin', role: 'admin', jti: 'valid-jti' },
        process.env.JWT_SECRET
      );

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(tokenService.isTokenBlacklisted).toHaveBeenCalledWith('valid-jti');
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when token is blacklisted', async () => {
      tokenService.isTokenBlacklisted.mockResolvedValue(true);

      const token = jwt.sign(
        { id: 1, username: 'admin', role: 'admin', jti: 'blacklisted-jti' },
        process.env.JWT_SECRET
      );

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'トークンは無効化されています' })
      );
    });

    it('should continue on blacklist check error (graceful degradation)', async () => {
      tokenService.isTokenBlacklisted.mockRejectedValue(new Error('DB error'));

      const token = jwt.sign(
        { id: 1, username: 'admin', role: 'admin', jti: 'test-jti' },
        process.env.JWT_SECRET
      );

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      // Should still proceed despite blacklist check error
      expect(next).toHaveBeenCalled();
    });

    it('should skip blacklist check when no JTI in token', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(tokenService.isTokenBlacklisted).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for invalid role', async () => {
      const token = jwt.sign(
        { id: 1, username: 'hacker', role: 'superadmin' },
        process.env.JWT_SECRET
      );

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: '無効なロール' }));
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow valid roles (admin, manager, analyst, viewer)', async () => {
      for (const role of ['admin', 'manager', 'analyst', 'viewer']) {
        jest.clearAllMocks();
        tokenService.isTokenBlacklisted.mockResolvedValue(false);

        const token = jwt.sign({ id: 1, username: 'user', role }, process.env.JWT_SECRET);

        const req = { headers: { authorization: `Bearer ${token}` } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();

        await authenticateJWT(req, res, next);
        await new Promise((r) => setTimeout(r, 50));

        expect(next).toHaveBeenCalled();
      }
    });

    it('should allow token with empty string role', async () => {
      const token = jwt.sign({ id: 1, username: 'user', role: '' }, process.env.JWT_SECRET);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      // Empty string role should pass (hasInvalidRole checks role !== '')
      expect(next).toHaveBeenCalled();
    });

    it('should allow token with no role field', async () => {
      const token = jwt.sign({ id: 1, username: 'user' }, process.env.JWT_SECRET);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await authenticateJWT(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      // No role should pass (user.role is falsy)
      expect(next).toHaveBeenCalled();
    });
  });

  describe('authorize', () => {
    it('should allow user with matching role', () => {
      const middleware = authorize(['admin', 'manager']);
      const req = { user: { id: 1, role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 403 for non-matching role', () => {
      const middleware = authorize(['admin']);
      const req = { user: { id: 1, role: 'viewer' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: '権限がありません',
          requiredRoles: ['admin'],
          userRole: 'viewer'
        })
      );
    });

    it('should return 401 when no user on request', () => {
      const middleware = authorize(['admin']);
      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: '認証が必要です' }));
    });

    it('should allow any role when roles array is empty', () => {
      const middleware = authorize([]);
      const req = { user: { id: 1, role: 'viewer' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should accept string role parameter', () => {
      const middleware = authorize('admin');
      const req = { user: { id: 1, role: 'admin' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should use default empty array when no roles provided', () => {
      const middleware = authorize();
      const req = { user: { id: 1, role: 'viewer' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user when valid Bearer token provided', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.username).toBe('admin');
    });

    it('should set user from cookie token', async () => {
      const token = jwt.sign({ id: 2, username: 'user2', role: 'viewer' }, process.env.JWT_SECRET);

      const req = { headers: {}, cookies: { token } };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user.username).toBe('user2');
    });

    it('should call next without user when no token', () => {
      const req = { headers: {} };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should call next without user for invalid token', async () => {
      const req = { headers: { authorization: 'Bearer invalid-token' } };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('should call next without user for expired token', async () => {
      const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
        expiresIn: '-1h'
      });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {};
      const next = jest.fn();

      optionalAuth(req, res, next);
      await new Promise((r) => setTimeout(r, 50));

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
