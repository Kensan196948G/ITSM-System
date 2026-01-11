const request = require('supertest');
const express = require('express');
const vulnerabilitiesRoutes = require('../../../routes/vulnerabilities');

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

jest.mock('../../../middleware/auditLog', () => (req, res, next) => next());

const { db } = require('../../../db');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/v1/vulnerabilities', vulnerabilitiesRoutes);

describe('Vulnerabilities Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/vulnerabilities', () => {
    it('should return list of vulnerabilities with pagination', async () => {
      const mockVulnerabilities = [
        {
          vulnerability_id: 'VUL-001',
          title: 'SQL Injection Vulnerability',
          severity: 'High',
          cvss_score: 8.5,
          affected_asset: 'WEB-001',
          status: 'Open'
        }
      ];

      db.get.mockResolvedValue({ total: 1 });
      db.all.mockResolvedValue(mockVulnerabilities);

      const response = await request(app)
        .get('/api/v1/vulnerabilities')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockVulnerabilities);
      expect(response.body.pagination).toBeDefined();
    });
  });

  describe('POST /api/v1/vulnerabilities', () => {
    it('should create new vulnerability', async () => {
      const newVulnerability = {
        title: 'XSS Vulnerability',
        description: 'Cross-site scripting vulnerability found',
        severity: 'Medium',
        cvss_score: 6.5,
        affected_asset: 'APP-001'
      };

      db.run.mockImplementation(function () {
        this.changes = 1;
        return Promise.resolve();
      });

      const response = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', 'Bearer testtoken')
        .send(newVulnerability);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('脆弱性が正常に作成されました');
      expect(response.body.id).toMatch(/^VUL-/);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should handle missing required fields', async () => {
      const invalidVulnerability = {
        description: 'Missing title and severity'
      };

      const response = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', 'Bearer testtoken')
        .send(invalidVulnerability);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('タイトルと深刻度は必須です');
    });
  });

  describe('PUT /api/v1/vulnerabilities/:id', () => {
    it('should update vulnerability', async () => {
      const updateData = {
        title: 'Updated XSS Vulnerability',
        status: 'Resolved'
      };

      db.run.mockImplementation(function () {
        this.changes = 1;
        return Promise.resolve();
      });

      const response = await request(app)
        .put('/api/v1/vulnerabilities/VUL-001')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('脆弱性が正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });

    it('should handle vulnerability not found', async () => {
      const updateData = {
        status: 'Resolved'
      };

      db.run.mockImplementation(function () {
        this.changes = 0;
        return Promise.resolve();
      });

      const response = await request(app)
        .put('/api/v1/vulnerabilities/VUL-999')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('脆弱性が見つかりません');
    });
  });

  describe('DELETE /api/v1/vulnerabilities/:id', () => {
    it('should delete vulnerability', async () => {
      db.run.mockImplementation(function () {
        this.changes = 1;
        return Promise.resolve();
      });

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/VUL-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('脆弱性が正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });

    it('should handle vulnerability not found on delete', async () => {
      db.run.mockImplementation(function () {
        this.changes = 0;
        return Promise.resolve();
      });

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/VUL-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('脆弱性が見つかりません');
    });
  });
});
