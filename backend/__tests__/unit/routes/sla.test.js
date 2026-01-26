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

      // コールバック形式でモック
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
  });

  describe('PUT /api/v1/sla/agreements/:id', () => {
    it('should update SLA agreement', async () => {
      const updateData = {
        service_name: 'Updated Web Service',
        target_response_time: '1 hour'
      };

      // アラートトリガー判定のため、最初にGETで既存ステータスを取得
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { status: 'Met' });
      });

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/sla/agreements/SLA-001')
        .set('Authorization', 'Bearer testtoken')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('SLA契約が正常に更新されました');
      expect(response.body.changes).toBe(1);
      expect(response.body.updated_by).toBe('testuser');
    });
  });

  describe('GET /api/v1/sla/alerts', () => {
    it('should return SLA alerts (currently returns empty as table not implemented)', async () => {
      // 現在のルートはsla_alert_historyテーブルが未実装のため、空配列を返す
      // モックは呼び出されないが、テストのセットアップ上は残す
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 0 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, []);
      });

      const response = await request(app)
        .get('/api/v1/sla/alerts')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      // ルートは空配列を返すハードコード実装
      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });
  });

  describe('PUT /api/v1/sla/alerts/:id/acknowledge', () => {
    it('should acknowledge SLA alert', async () => {
      // コールバック形式でモック
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
  });

  describe('POST /api/v1/sla/alerts/acknowledge-bulk', () => {
    it('should bulk acknowledge SLA alerts', async () => {
      const bulkData = {
        alert_ids: ['ALT-001', 'ALT-002', 'ALT-003']
      };

      // コールバック形式でモック
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 3 }, null);
      });

      const response = await request(app)
        .post('/api/v1/sla/alerts/acknowledge-bulk')
        .set('Authorization', 'Bearer testtoken')
        .send(bulkData);

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
  });

  describe('GET /api/v1/sla/statistics', () => {
    it('should return SLA statistics', async () => {
      const mockStatsRow = {
        total: 10,
        met: 8,
        at_risk: 1,
        violated: 1,
        avg_achievement_rate: 92.5
      };

      // コールバック形式でモック - db.getを使用
      db.get.mockImplementation((sql, callback) => {
        callback(null, mockStatsRow);
      });

      const response = await request(app)
        .get('/api/v1/sla/statistics')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('alert_threshold');
      expect(response.body.statistics.total).toBe(10);
      expect(response.body.statistics.met).toBe(8);
    });
  });
});
