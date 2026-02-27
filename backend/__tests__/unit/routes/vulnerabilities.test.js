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

      // コールバック形式でモック
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockVulnerabilities);
      });

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

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
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

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
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

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
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
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/VUL-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('脆弱性が正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });

    it('should handle vulnerability not found on delete', async () => {
      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/VUL-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('脆弱性が見つかりません');
    });

    it('should handle database error on delete', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('DB error'));
      });

      const response = await request(app)
        .delete('/api/v1/vulnerabilities/VUL-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/vulnerabilities - error paths', () => {
    it('should handle count query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('Count error'));
      });

      const response = await request(app)
        .get('/api/v1/vulnerabilities')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
    });

    it('should handle fetch query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('Fetch error'));
      });

      const response = await request(app)
        .get('/api/v1/vulnerabilities')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/vulnerabilities - error paths', () => {
    it('should handle database error on create', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Insert error'));
      });

      const response = await request(app)
        .post('/api/v1/vulnerabilities')
        .set('Authorization', 'Bearer testtoken')
        .send({ title: 'Test', severity: 'High' });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/v1/vulnerabilities/:id - error paths', () => {
    it('should handle database error on update', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Update error'));
      });

      const response = await request(app)
        .put('/api/v1/vulnerabilities/VUL-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ title: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/vulnerabilities/cvss/calculate', () => {
    it('should calculate CVSS score with scope Unchanged', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'N',
            attackComplexity: 'L',
            privilegesRequired: 'N',
            userInteraction: 'N',
            scope: 'U',
            confidentialityImpact: 'H',
            integrityImpact: 'H',
            availabilityImpact: 'H'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.baseScore).toBeGreaterThan(0);
      expect(response.body.severity).toBe('Critical');
      expect(response.body.vectorString).toContain('CVSS:3.1');
    });

    it('should calculate CVSS score with scope Changed', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'N',
            attackComplexity: 'L',
            privilegesRequired: 'N',
            userInteraction: 'N',
            scope: 'C',
            confidentialityImpact: 'H',
            integrityImpact: 'H',
            availabilityImpact: 'H'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.baseScore).toBeGreaterThan(0);
    });

    it('should return None severity when impact is zero', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'N',
            attackComplexity: 'L',
            privilegesRequired: 'N',
            userInteraction: 'N',
            scope: 'U',
            confidentialityImpact: 'N',
            integrityImpact: 'N',
            availabilityImpact: 'N'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.baseScore).toBe(0);
      expect(response.body.severity).toBe('None');
    });

    it('should return Low severity for low scores', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'P',
            attackComplexity: 'H',
            privilegesRequired: 'H',
            userInteraction: 'R',
            scope: 'U',
            confidentialityImpact: 'L',
            integrityImpact: 'N',
            availabilityImpact: 'N'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.baseScore).toBeGreaterThan(0);
      expect(response.body.baseScore).toBeLessThan(4.0);
      expect(response.body.severity).toBe('Low');
    });

    it('should return Medium severity for medium scores', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'A',
            attackComplexity: 'L',
            privilegesRequired: 'L',
            userInteraction: 'N',
            scope: 'U',
            confidentialityImpact: 'L',
            integrityImpact: 'L',
            availabilityImpact: 'N'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.baseScore).toBeGreaterThanOrEqual(4.0);
      expect(response.body.baseScore).toBeLessThan(7.0);
      expect(response.body.severity).toBe('Medium');
    });

    it('should return High severity for high scores', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'N',
            attackComplexity: 'L',
            privilegesRequired: 'L',
            userInteraction: 'N',
            scope: 'U',
            confidentialityImpact: 'H',
            integrityImpact: 'H',
            availabilityImpact: 'N'
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.baseScore).toBeGreaterThanOrEqual(7.0);
      expect(response.body.baseScore).toBeLessThan(9.0);
      expect(response.body.severity).toBe('High');
    });

    it('should return 400 when metrics is missing', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('metrics');
    });

    it('should return 400 when required metrics are missing', async () => {
      const response = await request(app)
        .post('/api/v1/vulnerabilities/cvss/calculate')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metrics: {
            attackVector: 'N'
            // missing other required metrics
          }
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('必須メトリクスが不足');
    });
  });

  describe('PATCH /api/v1/vulnerabilities/:id/cvss', () => {
    it('should update CVSS score', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-001/cvss')
        .set('Authorization', 'Bearer testtoken')
        .send({ cvss_score: 9.8, cvss_vector: 'CVSS:3.1/AV:N/AC:L', severity: 'Critical' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('CVSSスコアが更新');
    });

    it('should return 404 when vulnerability not found', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-999/cvss')
        .set('Authorization', 'Bearer testtoken')
        .send({ cvss_score: 5.0 });

      expect(response.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('DB error'));
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-001/cvss')
        .set('Authorization', 'Bearer testtoken')
        .send({ cvss_score: 5.0 });

      expect(response.status).toBe(500);
    });
  });

  describe('PATCH /api/v1/vulnerabilities/:id/nist-csf', () => {
    it('should update NIST CSF information', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-001/nist-csf')
        .set('Authorization', 'Bearer testtoken')
        .send({ function: 'DETECT', category: 'DE.CM', subcategory: 'DE.CM-8' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('NIST CSF');
    });

    it('should return 400 for invalid NIST CSF function', async () => {
      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-001/nist-csf')
        .set('Authorization', 'Bearer testtoken')
        .send({ function: 'INVALID_FUNCTION' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('無効なNIST CSF');
    });

    it('should return 404 when vulnerability not found', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-999/nist-csf')
        .set('Authorization', 'Bearer testtoken')
        .send({ function: 'IDENTIFY' });

      expect(response.status).toBe(404);
    });

    it('should handle database error', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('DB error'));
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-001/nist-csf')
        .set('Authorization', 'Bearer testtoken')
        .send({ function: 'PROTECT' });

      expect(response.status).toBe(500);
    });

    it('should allow update without function (only category/subcategory)', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .patch('/api/v1/vulnerabilities/VUL-001/nist-csf')
        .set('Authorization', 'Bearer testtoken')
        .send({ category: 'ID.AM', subcategory: 'ID.AM-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
