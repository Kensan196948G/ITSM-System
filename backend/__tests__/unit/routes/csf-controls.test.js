/**
 * CSF Controls Routes Tests
 * NIST CSF 2.0 コントロールルートのユニットテスト
 */

const request = require('supertest');
const express = require('express');

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

jest.mock('../../../middleware/auth', () => ({
  authenticateJWT: (req, res, next) => {
    req.user = { id: 1, username: 'admin', role: 'admin' };
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
  clearAllCache: jest.fn()
}));

jest.mock('../../../middleware/auditLog', () => (req, res, next) => next());

const csfRoutes = require('../../../routes/csf-controls');
const { db } = require('../../../db');

const app = express();
app.use(express.json());
app.use('/api/v1/csf', csfRoutes);

describe('CSF Controls Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/csf/functions', () => {
    it('should return CSF functions', async () => {
      const mockFunctions = [
        { id: 1, code: 'GV', name: 'Govern', category_count: 3, control_count: 10 }
      ];

      db.all.mockImplementation((sql, callback) => {
        callback(null, mockFunctions);
      });

      const response = await request(app).get('/api/v1/csf/functions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockFunctions);
      expect(response.body.count).toBe(1);
    });

    it('should return empty array when no functions', async () => {
      db.all.mockImplementation((sql, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/v1/csf/functions');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/functions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/csf/progress', () => {
    it('should return CSF progress', async () => {
      const mockProgress = [
        { code: 'GV', name: 'Govern', progress: 75 },
        { code: 'ID', name: 'Identify', progress: 50 }
      ];

      db.all.mockImplementation((sql, callback) => {
        callback(null, mockProgress);
      });

      const response = await request(app).get('/api/v1/csf/progress');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('gv');
      expect(response.body.data).toHaveProperty('id');
    });

    it('should return defaults when no data', async () => {
      db.all.mockImplementation((sql, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/v1/csf/progress');

      expect(response.status).toBe(200);
      expect(response.body.data.gv).toBe(0);
      expect(response.body.data.id).toBe(0);
      expect(response.body.data.pr).toBe(0);
      expect(response.body.data.de).toBe(0);
      expect(response.body.data.rs).toBe(0);
      expect(response.body.data.rc).toBe(0);
    });

    it('should return 500 on database error', async () => {
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/progress');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/csf/functions/:id/categories', () => {
    it('should return categories for function', async () => {
      const mockCategories = [
        { id: 1, code: 'GV.OC', name: 'Organizational Context', control_count: 5 }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockCategories);
      });

      const response = await request(app).get('/api/v1/csf/functions/1/categories');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCategories);
    });

    it('should return 500 on database error', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/functions/1/categories');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/csf/categories/:id/controls', () => {
    it('should return controls for category', async () => {
      const mockControls = [{ id: 1, control_id: 'GV.OC-01', name: 'Control 1', score: 80 }];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockControls);
      });

      const response = await request(app).get('/api/v1/csf/categories/1/controls');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockControls);
    });

    it('should return 500 on database error', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/categories/1/controls');

      expect(response.status).toBe(500);
    });
  });

  describe('GET /api/v1/csf/controls', () => {
    it('should return all controls without filters', async () => {
      const mockControls = [{ id: 1, control_id: 'GV.OC-01', status: 'Implemented' }];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockControls);
      });

      const response = await request(app).get('/api/v1/csf/controls');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockControls);
    });

    it('should apply status filter', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/v1/csf/controls?status=Implemented');

      expect(response.status).toBe(200);
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('ctrl.status = ?');
      expect(params).toContain('Implemented');
    });

    it('should apply maturity_level filter', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/v1/csf/controls?maturity_level=3');

      expect(response.status).toBe(200);
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('ctrl.maturity_level = ?');
      expect(params).toContain(3);
    });

    it('should apply function_code filter', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/v1/csf/controls?function_code=GV');

      expect(response.status).toBe(200);
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('f.code = ?');
      expect(params).toContain('GV');
    });

    it('should return 500 on database error', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/controls');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/csf/controls/:id', () => {
    it('should return specific control', async () => {
      const mockControl = {
        id: 1,
        control_id: 'GV.OC-01',
        status: 'Implemented',
        score: 85
      };

      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockControl);
      });

      const response = await request(app).get('/api/v1/csf/controls/1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.control_id).toBe('GV.OC-01');
    });

    it('should return 404 when control not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/v1/csf/controls/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('コントロールが見つかりません');
    });

    it('should return 500 on database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/controls/1');

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/v1/csf/controls/:id', () => {
    it('should update control successfully', async () => {
      const currentControl = {
        id: 1,
        status: 'Not Implemented',
        maturity_level: 1,
        score: 20
      };

      // First call: GET current state
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, currentControl);
      });

      // db.run calls: UPDATE, then assessment INSERT
      db.run.mockImplementation(function (sql, params, callback) {
        if (typeof callback === 'function') {
          callback.call({ changes: 1 }, null);
        }
      });

      const response = await request(app).put('/api/v1/csf/controls/1').send({
        status: 'Implemented',
        maturity_level: 3,
        score: 80
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('コントロールを更新しました');
    });

    it('should return 404 when control not found for update', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app)
        .put('/api/v1/csf/controls/999')
        .send({ status: 'Implemented' });

      expect(response.status).toBe(404);
    });

    it('should return 404 on db.get error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('GET error'));
      });

      const response = await request(app)
        .put('/api/v1/csf/controls/1')
        .send({ status: 'Implemented' });

      expect(response.status).toBe(404);
    });

    it('should return 500 on update error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 1, status: 'Not Implemented', maturity_level: 1, score: 0 });
      });

      db.run.mockImplementation(function (sql, params, callback) {
        if (typeof callback === 'function') {
          callback(new Error('Update failed'));
        }
      });

      const response = await request(app)
        .put('/api/v1/csf/controls/1')
        .send({ status: 'Implemented' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('コントロールの更新に失敗しました');
    });
  });

  describe('GET /api/v1/csf/statistics', () => {
    it('should return CSF statistics', async () => {
      let callCount = 0;
      db.all.mockImplementation((sql, callback) => {
        callCount++;
        if (callCount === 1) {
          // calculateCSFProgress
          callback(null, [
            { code: 'GV', name: 'Govern', progress: 80 },
            { code: 'ID', name: 'Identify', progress: 60 }
          ]);
        } else {
          // getCSFFunctions
          callback(null, [
            {
              code: 'GV',
              name: 'Govern',
              name_en: 'Govern',
              color: '#blue',
              icon: 'shield',
              category_count: 3,
              control_count: 10,
              avg_score: 80,
              avg_maturity: 3.5
            },
            {
              code: 'ID',
              name: 'Identify',
              name_en: 'Identify',
              color: '#green',
              icon: 'search',
              category_count: 4,
              control_count: 15,
              avg_score: 60,
              avg_maturity: 2.0
            }
          ]);
        }
      });

      const response = await request(app).get('/api/v1/csf/statistics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('progress');
      expect(response.body.data).toHaveProperty('functions');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary.total_controls).toBe(25);
    });

    it('should return 500 on error', async () => {
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/statistics');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/csf/assessments', () => {
    it('should return assessments', async () => {
      const mockAssessments = [{ id: 1, control_code: 'GV.OC-01', assessed_by_name: 'admin' }];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockAssessments);
      });

      const response = await request(app).get('/api/v1/csf/assessments');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAssessments);
    });

    it('should filter by control_id', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      const response = await request(app).get('/api/v1/csf/assessments?control_id=5');

      expect(response.status).toBe(200);
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('a.control_id = ?');
      expect(params).toContain('5');
    });

    it('should return 500 on database error', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/csf/assessments');

      expect(response.status).toBe(500);
    });

    it('should handle custom limit', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await request(app).get('/api/v1/csf/assessments?limit=10');

      const [, params] = db.all.mock.calls[0];
      expect(params).toContain(10);
    });
  });
});
