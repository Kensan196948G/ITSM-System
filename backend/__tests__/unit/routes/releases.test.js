const request = require('supertest');
const express = require('express');
const releasesRoutes = require('../../../routes/releases');

// Mock the database module
jest.mock('../../../db', () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn()
  },
  initDb: jest.fn()
}));

// Mock middleware
jest.mock('../../../middleware/auth', () => ({
  authenticateJWT: (req, res, next) => {
    req.user = { username: 'testuser', role: 'admin' };
    next();
  },
  authorize: (roles) => (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: '権限がありません' });
    }
  }
}));

jest.mock('../../../middleware/cache', () => ({
  cacheMiddleware: (req, res, next) => next(),
  invalidateCacheMiddleware: () => (req, res, next) => next()
}));

jest.mock('../../../middleware/pagination', () => ({
  parsePaginationParams: () => ({ page: 1, limit: 20, offset: 0 }),
  buildPaginationSQL: (sql, params) => sql,
  createPaginationMeta: (total, page, limit) => ({ total, page, limit })
}));

const { db } = require('../../../db');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/v1/releases', releasesRoutes);

describe('Releases Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/releases', () => {
    it('should return list of releases with pagination', async () => {
      const mockReleases = [
        {
          release_id: 'REL-001',
          name: 'Version 1.0 Release',
          version: '1.0.0',
          status: 'Completed',
          scheduled_date: '2024-01-15',
          actual_date: '2024-01-15'
        }
      ];

      // コールバック形式でモック
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockReleases);
      });

      const response = await request(app)
        .get('/api/v1/releases')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockReleases);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/v1/releases', () => {
    it('should create new release', async () => {
      const newRelease = {
        name: 'Version 2.0 Release',
        version: '2.0.0',
        release_date: '2024-02-01',
        rollback_plan: 'Rollback to version 1.0.0'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/releases')
        .set('Authorization', 'Bearer testtoken')
        .send(newRelease);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('リリースが正常に作成されました');
      expect(response.body.id).toMatch(/^REL-/);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle missing required fields', async () => {
      const invalidRelease = {
        name: 'Missing version and date'
      };

      const response = await request(app)
        .post('/api/v1/releases')
        .set('Authorization', 'Bearer testtoken')
        .send(invalidRelease);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('名称とバージョンは必須です');
    });
  });

  describe('PUT /api/v1/releases/:id', () => {
    it('should update release', async () => {
      const updateData = {
        status: 'In Progress',
        actual_date: '2024-01-16'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/releases/REL-001')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('リリースが正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });

    it('should handle release not found', async () => {
      const updateData = {
        status: 'Completed'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .put('/api/v1/releases/REL-999')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('リリースが見つかりません');
    });
  });

  describe('GET /api/v1/releases - error paths', () => {
    it('should handle count query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/releases');
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('内部サーバーエラー');
    });

    it('should handle fetch query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('DB fetch error'));
      });

      const response = await request(app).get('/api/v1/releases');
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('内部サーバーエラー');
    });
  });

  describe('POST /api/v1/releases - error paths', () => {
    it('should handle database error on create', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Insert error'));
      });

      const response = await request(app)
        .post('/api/v1/releases')
        .send({ name: 'Test', version: '1.0.0' });
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('内部サーバーエラー');
    });

    it('should use null for release_date when not provided', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        // params[3] = release_date (default null)
        expect(params[3]).toBeNull();
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/releases')
        .send({ name: 'Test', version: '1.0.0' });
      expect(response.status).toBe(201);
    });
  });

  describe('PUT /api/v1/releases/:id - error paths', () => {
    it('should handle database error on update', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Update error'));
      });

      const response = await request(app).put('/api/v1/releases/REL-001').send({ name: 'Updated' });
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('内部サーバーエラー');
    });
  });

  describe('DELETE /api/v1/releases/:id', () => {
    it('should delete release', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/releases/REL-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('リリースが正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });

    it('should handle release not found on delete', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/releases/REL-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('リリースが見つかりません');
    });

    it('should handle database error on delete', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Delete error'));
      });

      const response = await request(app).delete('/api/v1/releases/REL-001');
      expect(response.status).toBe(500);
      expect(response.body.error).toContain('内部サーバーエラー');
    });
  });
});
