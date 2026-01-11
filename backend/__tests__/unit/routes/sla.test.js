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

      db.get.mockResolvedValue({ total: 1 });
      db.all.mockResolvedValue(mockAgreements);

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

      db.run.mockImplementation(function () {
        this.changes = 1;
        return Promise.resolve();
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
    it('should return SLA alerts', async () => {
      const mockAlerts = [
        {
          alert_id: 'ALT-001',
          agreement_id: 'SLA-001',
          violation_type: 'Response Time',
          violation_time: '2024-01-01T10:00:00Z',
          acknowledged: false
        }
      ];

      db.get.mockResolvedValue({ total: 1 });
      db.all.mockResolvedValue(mockAlerts);

      const response = await request(app)
        .get('/api/v1/sla/alerts')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockAlerts);
    });
  });

  describe('PUT /api/v1/sla/alerts/:id/acknowledge', () => {
    it('should acknowledge SLA alert', async () => {
      db.run.mockImplementation(function () {
        this.changes = 1;
        return Promise.resolve();
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

      db.run.mockImplementation(function () {
        this.changes = 3;
        return Promise.resolve();
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
      const mockStats = [
        {
          service_name: 'Web Service',
          compliance_rate: 95.5,
          performance_level: 'Excellent'
        }
      ];

      db.all.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/v1/sla/statistics')
        .set('Authorization', 'Bearer testtoken');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockStats);
    });
  });
});
