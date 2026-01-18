const request = require('supertest');
const express = require('express');
const problemsRoutes = require('../../../routes/problems');

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
app.use('/api/v1/problems', problemsRoutes);

describe('Problems Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/problems', () => {
    it('should return list of problems with pagination', async () => {
      const mockProblems = [
        { problem_id: 'PRB-123456', title: 'Test Problem 1', status: 'Open', priority: 'High' },
        {
          problem_id: 'PRB-123457',
          title: 'Test Problem 2',
          status: 'Resolved',
          priority: 'Medium'
        }
      ];

      // コールバック形式でモック
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 2 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockProblems);
      });

      const response = await request(app)
        .get('/api/v1/problems')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockProblems);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/v1/problems', () => {
    it('should create new problem', async () => {
      const newProblem = {
        title: 'New Problem',
        description: 'Test problem description',
        priority: 'High'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', 'Bearer testtoken')
        .send(newProblem);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('問題が正常に作成されました');
      expect(response.body.id).toMatch(/^PRB-/);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle missing title', async () => {
      const invalidProblem = {
        description: 'Test description'
        // title is missing
      };

      const response = await request(app)
        .post('/api/v1/problems')
        .set('Authorization', 'Bearer testtoken')
        .send(invalidProblem);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('タイトルは必須です');
    });
  });

  describe('PUT /api/v1/problems/:id', () => {
    it('should update problem', async () => {
      const updateData = {
        status: 'Resolved',
        root_cause: 'Root cause analysis completed'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/problems/PRB-123456')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('問題が正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });
  });

  describe('DELETE /api/v1/problems/:id', () => {
    it('should delete problem', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/problems/PRB-123456')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('問題が正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });
  });
});
