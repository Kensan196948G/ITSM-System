/**
 * Integration Tests for Security Dashboard API
 * Tests all security dashboard endpoints against the current implementation.
 *
 * Current implementation state:
 * - GET /api/v1/security/dashboard/overview: Stub (hardcoded data, authenticateJWT only)
 * - GET /api/v1/security/alerts: Stub (empty array, authenticateJWT only)
 * - PUT /api/v1/security/alerts/:id/acknowledge: NOT implemented (404)
 * - GET /api/v1/security/audit-logs: Fully implemented (authorize(['admin', 'manager']))
 * - GET /api/v1/security/user-activity/:user_id: NOT implemented (404)
 * - GET /api/v1/security/activity-stats: NOT implemented (404)
 */

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, dbReady } = require('../../server');

describe('Security Dashboard API Integration Tests', () => {
  let adminToken;
  let managerToken;
  let analystToken;
  let viewerToken;

  beforeAll(async () => {
    await dbReady;
    await new Promise((resolve) => setTimeout(resolve, 500));

    const secret = process.env.JWT_SECRET || 'test-secret';
    adminToken = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, secret, { expiresIn: '1h' });
    managerToken = jwt.sign({ id: 5, username: 'manager', role: 'manager' }, secret, {
      expiresIn: '1h'
    });
    analystToken = jwt.sign({ id: 2, username: 'analyst', role: 'analyst' }, secret, {
      expiresIn: '1h'
    });
    viewerToken = jwt.sign({ id: 3, username: 'viewer', role: 'viewer' }, secret, {
      expiresIn: '1h'
    });
  }, 90000);

  // ========================================================================
  // Dashboard Overview (stub - authenticateJWT only, no authorize)
  // ========================================================================
  describe('GET /api/v1/security/dashboard/overview', () => {
    test('adminユーザーがアクセス可能', async () => {
      const res = await request(app)
        .get('/api/v1/security/dashboard/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_alerts');
      expect(res.body).toHaveProperty('alerts_by_severity');
      expect(res.body).toHaveProperty('riskScore');
      expect(res.body).toHaveProperty('complianceRate');
      expect(res.body).toHaveProperty('login_timeline');
      expect(typeof res.body.total_alerts).toBe('number');
    });

    test('analystユーザーもアクセス可能（authenticateJWTのみ）', async () => {
      const res = await request(app)
        .get('/api/v1/security/dashboard/overview')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_alerts');
    });

    test('viewerユーザーもアクセス可能（authenticateJWTのみ）', async () => {
      const res = await request(app)
        .get('/api/v1/security/dashboard/overview')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total_alerts');
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/dashboard/overview');

      expect(res.statusCode).toEqual(401);
    });
  });

  // ========================================================================
  // Alerts (stub - authenticateJWT only, returns empty data)
  // ========================================================================
  describe('GET /api/v1/security/alerts', () => {
    test('アラート一覧を取得（スタブ: 空配列）', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total', 0);
      expect(res.body).toHaveProperty('unacknowledged', 0);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    test('全認証ロールでアクセス可能', async () => {
      const res = await request(app)
        .get('/api/v1/security/alerts')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toEqual(200);
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/alerts');

      expect(res.statusCode).toEqual(401);
    });
  });

  // ========================================================================
  // Acknowledge Alert (NOT implemented - expect 404)
  // ========================================================================
  describe('PUT /api/v1/security/alerts/:id/acknowledge', () => {
    test('未実装のため404を返す', async () => {
      const res = await request(app)
        .put('/api/v1/security/alerts/1/acknowledge')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  // ========================================================================
  // Audit Logs (fully implemented - authorize(['admin', 'manager']))
  // ========================================================================
  describe('GET /api/v1/security/audit-logs', () => {
    test('adminユーザーで監査ログ一覧を取得', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('managerユーザーもアクセス可能', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
    });

    test('analystユーザーは403エラー（権限なし）', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(403);
    });

    test('viewerユーザーは403エラー（権限なし）', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.statusCode).toEqual(403);
    });

    test('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/security/audit-logs');

      expect(res.statusCode).toEqual(401);
    });

    test('ページネーションパラメータが動作する', async () => {
      const res = await request(app)
        .get('/api/v1/security/audit-logs?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 5);
    });

    test('日付範囲フィルタが動作する', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/v1/security/audit-logs?from_date=${fromDate}&to_date=${toDate}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ========================================================================
  // User Activity (NOT implemented - expect 404)
  // ========================================================================
  describe('GET /api/v1/security/user-activity/:user_id', () => {
    test('未実装のため404を返す', async () => {
      const res = await request(app)
        .get('/api/v1/security/user-activity/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  // ========================================================================
  // Activity Stats (NOT implemented - expect 404)
  // ========================================================================
  describe('GET /api/v1/security/activity-stats', () => {
    test('未実装のため404を返す', async () => {
      const res = await request(app)
        .get('/api/v1/security/activity-stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
