/**
 * SLA Routes Tests
 * SLA管理ルートのユニットテスト
 */

const request = require('supertest');
const express = require('express');
const slaRoutes = require('../../../routes/sla');

// Mock the database module
jest.mock('../../../db', () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn()
  },
  initDb: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
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
  buildPaginationSQL: (sql) => sql,
  createPaginationMeta: (total, page, limit) => ({ total, page, limit })
}));

const { db } = require('../../../db');

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/v1/sla', slaRoutes);

describe('SLA Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/sla/agreements', () => {
    it('should return list of SLA agreements with pagination', async () => {
      const mockAgreements = [
        {
          agreement_id: 'SLA-001',
          service_name: 'Web Service',
          target_response_time: '2 hours',
          target_resolution_time: '8 hours',
          compliance_rate: 95.5
        }
      ];

      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockAgreements);
      });

      const response = await request(app)
        .get('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockAgreements);
      expect(response.body.pagination).toBeDefined();
    });

    it('should return 500 on count query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('Count error'));
      });

      const response = await request(app)
        .get('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });

    it('should return 500 on data query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('Data error'));
      });

      const response = await request(app)
        .get('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });

  describe('POST /api/v1/sla/agreements', () => {
    it('should create SLA agreement successfully', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 10 }, null);
      });

      const response = await request(app)
        .post('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken')
        .send({
          service_name: 'Email Service',
          metric_name: 'Response Time',
          target_value: '2 hours'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('SLA契約が正常に作成されました');
      expect(response.body.sla_id).toMatch(/^SLA-/);
      expect(response.body.id).toBe(10);
      expect(response.body.created_by).toBe('testuser');
    });

    it('should return 400 when service_name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken')
        .send({
          metric_name: 'Response Time',
          target_value: '2 hours'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('service_nameは必須です');
    });

    it('should return 400 when metric_name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken')
        .send({
          service_name: 'Email Service',
          target_value: '2 hours'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('metric_nameとtarget_valueは必須です');
    });

    it('should return 400 when target_value is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken')
        .send({
          service_name: 'Email Service',
          metric_name: 'Response Time'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('metric_nameとtarget_valueは必須です');
    });

    it('should return 500 on database error', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Insert error'));
      });

      const response = await request(app)
        .post('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken')
        .send({
          service_name: 'Email Service',
          metric_name: 'Response Time',
          target_value: '2 hours'
        });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });

    it('should use default values for optional fields', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 11 }, null);
      });

      const response = await request(app)
        .post('/api/v1/sla/agreements')
        .set('Authorization', 'Bearer testtoken')
        .send({
          service_name: 'Email Service',
          metric_name: 'Response Time',
          target_value: '2 hours'
        });

      expect(response.status).toBe(201);
      // Verify default params: actual_value=null, achievement_rate=0, measurement_period='Monthly', status='Met'
      const callParams = db.run.mock.calls[0][1];
      expect(callParams[4]).toBeNull(); // actual_value
      expect(callParams[5]).toBe(0); // achievement_rate
      expect(callParams[6]).toBe('Monthly'); // measurement_period
      expect(callParams[7]).toBe('Met'); // status
    });
  });

  describe('PUT /api/v1/sla/agreements/:id', () => {
    it('should update SLA agreement', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Updated Web Service' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SLA契約が正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });

    it('should use sla_id WHERE clause for SLA- prefixed id', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('sla_id = ?');
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        expect(sql).toContain('sla_id = ?');
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-12345678')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Test' });

      expect(response.status).toBe(200);
    });

    it('should use id WHERE clause for numeric id', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        expect(sql).toContain('id = ?');
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        expect(sql).toContain('id = ?');
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/42')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Test' });

      expect(response.status).toBe(200);
    });

    it('should trigger alert when status changes from Met to Violated', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ status: 'Violated' });

      expect(response.status).toBe(200);
      expect(response.body.alert_triggered).toBe(true);
    });

    it('should trigger alert when status changes from Met to At-Risk', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ status: 'At-Risk' });

      expect(response.status).toBe(200);
      expect(response.body.alert_triggered).toBe(true);
    });

    it('should not trigger alert when status stays Met', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ status: 'Met' });

      expect(response.status).toBe(200);
      expect(response.body.alert_triggered).toBe(false);
    });

    it('should not trigger alert when previous status was not Met', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'At-Risk' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ status: 'Violated' });

      expect(response.status).toBe(200);
      expect(response.body.alert_triggered).toBe(false);
    });

    it('should not trigger alert when no status in update body', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Updated' });

      expect(response.status).toBe(200);
      expect(response.body.alert_triggered).toBeFalsy();
    });

    it('should return 404 when agreement not found on GET', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-999')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SLA契約が見つかりません');
    });

    it('should return 500 on GET database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('GET error'));
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });

    it('should return 500 on UPDATE database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Update error'));
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });

    it('should return 404 when changes is 0 on update', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send({ service_name: 'Test' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SLA契約が見つかりません');
    });
  });

  describe('DELETE /api/v1/sla/agreements/:id', () => {
    it('should delete SLA agreement successfully', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SLA契約が正常に削除されました');
      expect(response.body.deleted_by).toBe('testuser');
    });

    it('should use sla_id WHERE clause for SLA- prefixed id', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        expect(sql).toContain('sla_id = ?');
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
    });

    it('should use id WHERE clause for numeric id', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        expect(sql).toContain('id = ?');
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/sla/agreements/42')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
    });

    it('should return 404 when agreement not found', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .delete('/api/v1/sla/agreements/SLA-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SLA契約が見つかりません');
    });

    it('should return 500 on database error', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Delete error'));
      });

      const response = await request(app)
        .delete('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });

  describe('GET /api/v1/sla/alerts', () => {
    it('should return empty alerts (hardcoded)', async () => {
      const response = await request(app)
        .get('/api/v1/sla/alerts')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
      expect(response.body.alerts).toEqual([]);
    });
  });

  describe('GET /api/v1/sla/alerts/stats', () => {
    it('should return alert statistics (hardcoded zeros)', async () => {
      const response = await request(app)
        .get('/api/v1/sla/alerts/stats')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.total_alerts).toBe(0);
      expect(response.body.acknowledged_alerts).toBe(0);
      expect(response.body.pending_alerts).toBe(0);
    });
  });

  describe('GET /api/v1/sla/alerts/:id', () => {
    it('should return alert by id', async () => {
      const mockAlert = { alert_id: 'ALT-001', severity: 'High', acknowledged: 0 };
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockAlert);
      });

      const response = await request(app)
        .get('/api/v1/sla/alerts/ALT-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.alert_id).toBe('ALT-001');
    });

    it('should return 404 when alert not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .get('/api/v1/sla/alerts/ALT-999')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SLAアラートが見つかりません');
    });

    it('should return 500 on database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app)
        .get('/api/v1/sla/alerts/ALT-001')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });

  describe('PUT /api/v1/sla/alerts/:id/acknowledge', () => {
    it('should acknowledge SLA alert', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/alerts/ALT-001/acknowledge')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SLAアラートが正常に承認されました');
      expect(response.body.acknowledged_by).toBe('testuser');
    });

    it('should return 404 when alert not found', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/alerts/ALT-999/acknowledge')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('SLAアラートが見つかりません');
    });

    it('should return 500 on database error', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Acknowledge error'));
      });

      const response = await request(app)
        .put('/api/v1/sla/alerts/ALT-001/acknowledge')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });

  describe('POST /api/v1/sla/alerts/acknowledge-bulk', () => {
    it('should bulk acknowledge SLA alerts', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 3 }, null);
      });

      const response = await request(app)
        .post('/api/v1/sla/alerts/acknowledge-bulk')
        .set('Authorization', 'Bearer testtoken')
        .send({ alert_ids: ['ALT-001', 'ALT-002', 'ALT-003'] });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('3件のSLAアラートが正常に承認されました');
      expect(response.body.acknowledged_count).toBe(3);
    });

    it('should handle missing alert_ids', async () => {
      const response = await request(app)
        .post('/api/v1/sla/alerts/acknowledge-bulk')
        .set('Authorization', 'Bearer testtoken')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('アラートIDの配列が必要です');
    });

    it('should handle non-array alert_ids', async () => {
      const response = await request(app)
        .post('/api/v1/sla/alerts/acknowledge-bulk')
        .set('Authorization', 'Bearer testtoken')
        .send({ alert_ids: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('アラートIDの配列が必要です');
    });

    it('should handle empty alert_ids array', async () => {
      const response = await request(app)
        .post('/api/v1/sla/alerts/acknowledge-bulk')
        .set('Authorization', 'Bearer testtoken')
        .send({ alert_ids: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('アラートIDの配列が必要です');
    });

    it('should return 500 on database error', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback(new Error('Bulk error'));
      });

      const response = await request(app)
        .post('/api/v1/sla/alerts/acknowledge-bulk')
        .set('Authorization', 'Bearer testtoken')
        .send({ alert_ids: ['ALT-001'] });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });

  describe('GET /api/v1/sla/statistics', () => {
    it('should return SLA statistics', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, {
          total: 10,
          met: 8,
          at_risk: 1,
          violated: 1,
          avg_achievement_rate: 92.5
        });
      });

      const response = await request(app)
        .get('/api/v1/sla/statistics')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.statistics.total).toBe(10);
      expect(response.body.statistics.met).toBe(8);
      expect(response.body.statistics.compliance_rate).toBe(80);
      expect(response.body.alert_threshold).toBe(90);
    });

    it('should handle zero total (no agreements)', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, {
          total: 0,
          met: 0,
          at_risk: 0,
          violated: 0,
          avg_achievement_rate: null
        });
      });

      const response = await request(app)
        .get('/api/v1/sla/statistics')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.statistics.total).toBe(0);
      expect(response.body.statistics.compliance_rate).toBe(0);
      expect(response.body.statistics.avg_achievement_rate).toBe(0);
    });

    it('should handle null values in statistics row', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, {
          total: null,
          met: null,
          at_risk: null,
          violated: null,
          avg_achievement_rate: null
        });
      });

      const response = await request(app)
        .get('/api/v1/sla/statistics')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.statistics.total).toBe(0);
      expect(response.body.statistics.met).toBe(0);
      expect(response.body.statistics.at_risk).toBe(0);
      expect(response.body.statistics.violated).toBe(0);
    });

    it('should return 500 on database error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('Stats error'));
      });

      const response = await request(app)
        .get('/api/v1/sla/statistics')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('内部サーバーエラー');
    });
  });
});
