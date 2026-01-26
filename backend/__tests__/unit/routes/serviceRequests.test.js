const request = require('supertest');
const express = require('express');
const serviceRequestsRoutes = require('../../../routes/serviceRequests');

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
app.use('/api/v1/service-requests', serviceRequestsRoutes);

describe('Service Requests Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/service-requests', () => {
    it('should return list of service requests with pagination', async () => {
      const mockRequests = [
        {
          request_id: 'SR-001',
          title: 'New Laptop Request',
          category: 'Hardware',
          status: 'Approved',
          requester: 'john.doe',
          assignee: 'it.support'
        }
      ];

      // コールバック形式でモック
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockRequests);
      });

      const response = await request(app)
        .get('/api/v1/service-requests')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockRequests);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/v1/service-requests', () => {
    it('should create new service request', async () => {
      const newRequest = {
        title: 'Software Installation Request',
        request_type: 'Software',
        description: 'Need to install Adobe Creative Suite'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/service-requests')
        .set('Authorization', 'Bearer testtoken')
        .send(newRequest);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('サービスリクエストが正常に作成されました');
      expect(response.body.id).toMatch(/^SR-/);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle missing required fields', async () => {
      const invalidRequest = {
        description: 'Missing title and category'
      };

      const response = await request(app)
        .post('/api/v1/service-requests')
        .set('Authorization', 'Bearer testtoken')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('タイトルは必須です');
    });
  });

  describe('PUT /api/v1/service-requests/:id', () => {
    it('should update service request', async () => {
      const updateData = {
        status: 'In Progress',
        assignee: 'tech.support'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/service-requests/SR-001')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('サービスリクエストが正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });

    it('should handle service request not found', async () => {
      const updateData = {
        status: 'Completed'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .put('/api/v1/service-requests/SR-999')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('サービスリクエストが見つかりません');
    });
  });

  describe('DELETE /api/v1/service-requests/:id', () => {
    it('should delete service request', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/service-requests/SR-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('サービスリクエストが正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });

    it('should handle service request not found on delete', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/service-requests/SR-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('サービスリクエストが見つかりません');
    });
  });
});
