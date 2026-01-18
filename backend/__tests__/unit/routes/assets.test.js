const request = require('supertest');
const express = require('express');
const assetsRoutes = require('../../../routes/assets');

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
app.use('/api/v1/assets', assetsRoutes);

describe('Assets Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/assets', () => {
    it('should return list of assets with pagination', async () => {
      const mockAssets = [
        {
          asset_tag: 'AST-001',
          name: 'Server 1',
          type: 'Server',
          criticality: 3,
          status: 'Operational'
        },
        {
          asset_tag: 'AST-002',
          name: 'Router 1',
          type: 'Network',
          criticality: 2,
          status: 'Maintenance'
        }
      ];

      // コールバック形式でモック
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 2 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockAssets);
      });

      const response = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockAssets);
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle database error', async () => {
      // コールバック形式でエラーモック
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });

  describe('POST /api/v1/assets', () => {
    it('should create new asset', async () => {
      const newAsset = {
        asset_tag: 'AST-003',
        name: 'New Server',
        type: 'Server',
        criticality: 3
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', 'Bearer testtoken')
        .send(newAsset);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('資産が正常に登録されました');
      expect(response.body.asset_tag).toBe('AST-003');
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle missing required fields', async () => {
      const invalidAsset = {
        name: 'New Server'
        // asset_tag is missing
      };

      const response = await request(app)
        .post('/api/v1/assets')
        .set('Authorization', 'Bearer testtoken')
        .send(invalidAsset);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('資産タグと名称は必須です');
    });
  });

  describe('PUT /api/v1/assets/:id', () => {
    it('should update asset', async () => {
      const updateData = {
        name: 'Updated Server',
        status: 'Maintenance'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/assets/AST-001')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('資産が正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });

    it('should handle asset not found', async () => {
      const updateData = {
        name: 'Updated Server'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .put('/api/v1/assets/AST-999')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('資産が見つかりません');
    });
  });

  describe('DELETE /api/v1/assets/:id', () => {
    it('should delete asset', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/assets/AST-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('資産が正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });

    it('should handle asset not found on delete', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/assets/AST-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('資産が見つかりません');
    });
  });
});
