const { forcePasswordChange } = require('../../../middleware/forcePasswordChange');

describe('forcePasswordChange middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      user: null,
      method: 'GET',
      originalUrl: '/api/v1/incidents',
      url: '/api/v1/incidents'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('when no user is set', () => {
    it('should call next without checking', () => {
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('when user has password_must_change = 0', () => {
    beforeEach(() => {
      req.user = { id: 1, role: 'admin', password_must_change: 0 };
    });

    it('should call next for normal endpoints', () => {
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('when user has password_must_change = 1', () => {
    beforeEach(() => {
      req.user = { id: 1, role: 'admin', password_must_change: 1 };
    });

    it('should return 403 for normal endpoints', () => {
      forcePasswordChange(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'PASSWORD_CHANGE_REQUIRED',
        message: 'セキュリティポリシーにより、パスワードの変更が必要です'
      });
    });

    it('should allow access to auth endpoints', () => {
      req.originalUrl = '/api/v1/auth/login';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow access to auth/logout', () => {
      req.originalUrl = '/api/v1/auth/logout';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow access to auth/refresh', () => {
      req.originalUrl = '/api/v1/auth/refresh';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow access to health endpoint', () => {
      req.originalUrl = '/api/v1/health';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow access to root health endpoint', () => {
      req.originalUrl = '/health';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow PUT /api/v1/users/:id (password change)', () => {
      req.method = 'PUT';
      req.originalUrl = '/api/v1/users/1';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block GET /api/v1/users/1', () => {
      req.method = 'GET';
      req.originalUrl = '/api/v1/users/1';
      forcePasswordChange(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block POST /api/v1/users', () => {
      req.method = 'POST';
      req.originalUrl = '/api/v1/users';
      forcePasswordChange(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block DELETE /api/v1/users/1', () => {
      req.method = 'DELETE';
      req.originalUrl = '/api/v1/users/1';
      forcePasswordChange(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block /api/v1/incidents', () => {
      req.originalUrl = '/api/v1/incidents';
      forcePasswordChange(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should use req.url as fallback when originalUrl is not set', () => {
      delete req.originalUrl;
      req.url = '/api/v1/incidents';
      forcePasswordChange(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should use req.url fallback for exempt paths', () => {
      delete req.originalUrl;
      req.url = '/api/v1/auth/login';
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('when password_must_change is undefined', () => {
    it('should call next (backward compatibility)', () => {
      req.user = { id: 1, role: 'admin' };
      forcePasswordChange(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
