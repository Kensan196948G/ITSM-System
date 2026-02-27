/**
 * Changes Route Unit Tests
 * 変更管理ルートのユニットテスト
 */

const request = require('supertest');
const express = require('express');

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

jest.mock('../../../middleware/pagination', () => ({
  parsePaginationParams: () => ({ page: 1, limit: 20, offset: 0 }),
  buildPaginationSQL: (sql) => sql,
  createPaginationMeta: (total, page, limit) => ({ total, page, limit })
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const { db } = require('../../../db');
const changesRoutes = require('../../../routes/changes');

const app = express();
app.use(express.json());
app.use('/api/v1/changes', changesRoutes);

describe('Changes Routes Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/changes', () => {
    it('should return list of changes', async () => {
      const mockChanges = [
        { id: 1, rfc_id: 'RFC-12345678', title: 'Test Change', status: 'Draft' }
      ];

      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(null, mockChanges);
      });

      const response = await request(app).get('/api/v1/changes');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockChanges);
      expect(response.body.pagination).toBeDefined();
    });

    it('should handle count query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/changes');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('取得に失敗しました');
    });

    it('should handle fetch query error', async () => {
      db.get.mockImplementation((sql, callback) => {
        callback(null, { total: 1 });
      });
      db.all.mockImplementation((sql, callback) => {
        callback(new Error('DB fetch error'));
      });

      const response = await request(app).get('/api/v1/changes');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('取得に失敗しました');
    });
  });

  describe('GET /api/v1/changes/:id', () => {
    it('should return change by numeric id', async () => {
      const mockChange = { id: 1, rfc_id: 'RFC-12345678', title: 'Test' };

      db.get.mockImplementation((sql, params, callback) => {
        callback(null, mockChange);
      });

      const response = await request(app).get('/api/v1/changes/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockChange);
    });

    it('should return change by RFC id', async () => {
      const mockChange = { id: 1, rfc_id: 'RFC-12345678', title: 'Test' };

      db.get.mockImplementation((sql, params, callback) => {
        // RFC-で始まるとrfc_id = ?で検索される
        expect(sql).toContain('rfc_id = ?');
        callback(null, mockChange);
      });

      const response = await request(app).get('/api/v1/changes/RFC-12345678');

      expect(response.status).toBe(200);
    });

    it('should return 404 when change not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      const response = await request(app).get('/api/v1/changes/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('見つかりません');
    });

    it('should handle database error', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      const response = await request(app).get('/api/v1/changes/1');

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/v1/changes', () => {
    it('should create a new change', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app).post('/api/v1/changes').send({
        title: 'New Change',
        description: 'Test description',
        requester: 'testuser',
        status: 'Draft'
      });

      expect(response.status).toBe(201);
      expect(response.body.rfc_id).toMatch(/^RFC-/);
      expect(response.body.message).toContain('正常に作成されました');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app).post('/api/v1/changes').send({ requester: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('タイトルは必須です');
    });

    it('should return 400 when title is empty string', async () => {
      const response = await request(app)
        .post('/api/v1/changes')
        .send({ title: '  ', requester: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('タイトルは必須です');
    });

    it('should return 400 when requester is missing', async () => {
      const response = await request(app).post('/api/v1/changes').send({ title: 'Test Change' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('申請者は必須です');
    });

    it('should return 400 when requester is empty string', async () => {
      const response = await request(app)
        .post('/api/v1/changes')
        .send({ title: 'Test Change', requester: '  ' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('申請者は必須です');
    });

    it('should use default status and impact_level when not provided', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        // params[4] = status (default 'Draft'), params[8] = impact_level (default 'low')
        expect(params[4]).toBe('Draft');
        expect(params[8]).toBe('low');
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/changes')
        .send({ title: 'Test', requester: 'user' });

      expect(response.status).toBe(201);
    });

    it('should handle is_security_change flag', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        // params[7] = is_security_change: truthy -> 1
        expect(params[7]).toBe(1);
        callback.call({ lastID: 1 }, null);
      });

      const response = await request(app)
        .post('/api/v1/changes')
        .send({ title: 'Security Change', requester: 'user', is_security_change: true });

      expect(response.status).toBe(201);
    });

    it('should handle database error on create', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Insert error'));
      });

      const response = await request(app)
        .post('/api/v1/changes')
        .send({ title: 'Test', requester: 'user' });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('作成に失敗しました');
    });
  });

  describe('PUT /api/v1/changes/:id', () => {
    it('should update a change by numeric id', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/changes/1')
        .send({ title: 'Updated Title', status: 'Approved' });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('正常に更新されました');
    });

    it('should update a change by RFC id', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        expect(sql).toContain('rfc_id = ?');
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app)
        .put('/api/v1/changes/RFC-ABCD1234')
        .send({ title: 'Updated' });

      expect(response.status).toBe(200);
    });

    it('should return 400 for invalid status', async () => {
      const response = await request(app)
        .put('/api/v1/changes/1')
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('無効なステータスです');
    });

    it('should return 404 when change not found', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app).put('/api/v1/changes/999').send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });

    it('should handle database error on update', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Update error'));
      });

      const response = await request(app).put('/api/v1/changes/1').send({ title: 'Updated' });

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/v1/changes/:id', () => {
    it('should delete a change by numeric id', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app).delete('/api/v1/changes/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('正常に削除されました');
    });

    it('should delete a change by RFC id', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        expect(sql).toContain('rfc_id = ?');
        callback.call({ changes: 1 }, null);
      });

      const response = await request(app).delete('/api/v1/changes/RFC-ABCD1234');

      expect(response.status).toBe(200);
    });

    it('should return 404 when change not found', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({ changes: 0 }, null);
      });

      const response = await request(app).delete('/api/v1/changes/999');

      expect(response.status).toBe(404);
    });

    it('should handle database error on delete', async () => {
      db.run.mockImplementation(function (sql, params, callback) {
        callback.call({}, new Error('Delete error'));
      });

      const response = await request(app).delete('/api/v1/changes/1');

      expect(response.status).toBe(500);
    });
  });
});
