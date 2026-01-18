const jwt = require('jsonwebtoken');
const { authenticateJWT, authorize } = require('../../../middleware/auth');

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';

describe('Authentication Middleware', () => {
  describe('authenticateJWT', () => {
    it('有効なトークンで認証成功', () => {
      const token = jwt.sign(
        { id: 1, username: 'testuser', role: 'admin' },
        process.env.JWT_SECRET
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticateJWT(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.username).toBe('testuser');
      expect(req.user.role).toBe('admin');
    });

    it('無効なトークンで403エラー', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('無効')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('トークンなしで401エラー', () => {
      const req = {
        headers: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('認証トークン')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('Bearer形式でないトークンで401エラー', () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token123'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticateJWT(req, res, next);

      // Bearer形式でない場合はトークンなしと見なされるため401
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('期限切れトークンで403エラー', () => {
      const expiredToken = jwt.sign(
        { id: 1, username: 'testuser', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // 1時間前に期限切れ
      );

      const req = {
        headers: {
          authorization: `Bearer ${expiredToken}`
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('期限切れ')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('authorize (RBAC)', () => {
    it('admin権限で全アクセス許可', () => {
      const middleware = authorize(['admin', 'manager']);

      const req = {
        user: { id: 1, username: 'admin', role: 'admin' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('manager権限でmanager用エンドポイントにアクセス許可', () => {
      const middleware = authorize(['admin', 'manager']);

      const req = {
        user: { id: 2, username: 'manager', role: 'manager' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('analyst権限でmanager専用エンドポイントは403エラー', () => {
      const middleware = authorize(['admin', 'manager']);

      const req = {
        user: { id: 3, username: 'analyst', role: 'analyst' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('権限'),
          requiredRoles: ['admin', 'manager'],
          userRole: 'analyst'
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('viewer権限で全エンドポイントは403エラー', () => {
      const middleware = authorize(['admin', 'manager', 'analyst']);

      const req = {
        user: { id: 4, username: 'viewer', role: 'viewer' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('認証されていないリクエストで401エラー', () => {
      const middleware = authorize(['admin']);

      const req = {}; // user情報なし
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('認証が必要')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('空のロール配列で全ユーザーアクセス許可', () => {
      const middleware = authorize([]);

      const req = {
        user: { id: 1, username: 'anyuser', role: 'viewer' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('文字列ロール指定でも動作', () => {
      const middleware = authorize('admin');

      const req = {
        user: { id: 1, username: 'admin', role: 'admin' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
