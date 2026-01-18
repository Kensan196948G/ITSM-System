const request = require('supertest');
const express = require('express');
const incidentsRoutes = require('../../../routes/incidents');

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

jest.mock('../../../middleware/validation', () => ({
  incidentValidation: {
    create: (req, res, next) => next(),
    update: (req, res, next) => next()
  },
  validate: (req, res, next) => next()
}));

jest.mock('../../../middleware/auditLog', () => (req, res, next) => next());

jest.mock('../../../services/notificationService', () => ({
  notifyIncident: jest.fn().mockResolvedValue()
}));

jest.mock('../../../middleware/pagination', () => ({
  parsePaginationParams: () => ({ page: 1, limit: 20, offset: 0 }),
  buildPaginationSQL: (sql, params) => sql,
  createPaginationMeta: (total, page, limit) => ({ total, page, limit })
}));

// Mock errorHandler
jest.mock('../../../middleware/errorHandler', () => ({
  asyncHandler: (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message) {
      super(message);
      this.name = 'DatabaseError';
    }
  }
}));

const { db } = require('../../../db');

// Create a test app with error handler
const app = express();
app.use(express.json());
app.use('/api/v1/incidents', incidentsRoutes);
// Add error handler middleware
app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

describe('Incidents Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/incidents', () => {
    it('should return list of incidents with pagination', async () => {
      const mockIncidents = [
        { ticket_id: 'INC-123456', title: 'Test Incident 1', priority: 'High', status: 'New' },
        {
          ticket_id: 'INC-123457',
          title: 'Test Incident 2',
          priority: 'Medium',
          status: 'In Progress'
        }
      ];

      // コールバック形式でモック
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 2 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockIncidents);
      });

      const response = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockIncidents);
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle database error', async () => {
      // コールバック形式でエラーモック
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('Database error'), null);
      });

      const response = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      // エラーメッセージはDatabaseErrorから取得
      expect(response.body.message).toContain('エラーが発生しました');
    });
  });

  describe('GET /api/v1/incidents/:id', () => {
    it('should return incident details', async () => {
      const mockIncident = {
        ticket_id: 'INC-123456',
        title: 'Test Incident',
        priority: 'High',
        status: 'New',
        description: 'Test description'
      };

      // コールバック形式でモック (GET :id uses callback with params)
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockIncident);
      });

      const response = await request(app)
        .get('/api/v1/incidents/INC-123456')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockIncident);
    });

    it('should return 404 if incident not found', async () => {
      // コールバック形式でモック
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .get('/api/v1/incidents/INC-999999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('インシデントが見つかりません');
    });
  });

  describe('POST /api/v1/incidents', () => {
    it('should create new incident', async () => {
      const newIncident = {
        title: 'New Incident',
        priority: 'High',
        description: 'Test description'
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken')
        .send(newIncident);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('インシデントが正常に作成されました');
      expect(response.body.id).toMatch(/^INC-/);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle database error on create', async () => {
      const newIncident = {
        title: 'New Incident',
        priority: 'High'
      };

      // コールバック形式でエラーモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Database error'));
      });

      const response = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', 'Bearer testtoken')
        .send(newIncident);

      expect(response.status).toBe(500);
      // ルートは { error: '内部サーバーエラー' } を返す
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });
});
