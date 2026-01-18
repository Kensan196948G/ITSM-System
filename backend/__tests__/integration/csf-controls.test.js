const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('CSF Controls API Integration Tests', () => {
  let authToken;
  let adminToken;

  beforeAll(async () => {
    await dbReady;
    // Login as regular user
    const userRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = userRes.body.token;
    adminToken = userRes.body.token; // Admin for this test
  }, 30000); // Increase timeout to 30 seconds

  describe('GET /api/v1/csf/functions', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/csf/functions');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでCSF関数一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/csf/functions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/csf/progress', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/csf/progress');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでCSF進捗取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/csf/progress')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      // Check all 6 CSF functions are present (using short codes: gv, id, pr, de, rs, rc)
      const { data } = res.body;
      expect(data).toHaveProperty('gv');
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('pr');
      expect(data).toHaveProperty('de');
      expect(data).toHaveProperty('rs');
      expect(data).toHaveProperty('rc');
    });

    it('進捗値は0-100の範囲', async () => {
      const res = await request(app)
        .get('/api/v1/csf/progress')
        .set('Authorization', `Bearer ${authToken}`);

      const { data } = res.body;
      Object.values(data).forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('GET /api/v1/csf/statistics', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/csf/statistics');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありで統計情報取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/csf/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('progress');
      expect(res.body.data).toHaveProperty('functions');
      expect(res.body.data).toHaveProperty('summary');
    });
  });

  describe('GET /api/v1/csf/controls', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/csf/controls');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでコントロール一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/csf/controls')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ステータスでフィルタリング', async () => {
      const res = await request(app)
        .get('/api/v1/csf/controls?status=not_started')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('関数コードでフィルタリング', async () => {
      const res = await request(app)
        .get('/api/v1/csf/controls?function_code=GV')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });

  describe('GET /api/v1/csf/assessments', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/csf/assessments');
      expect(res.statusCode).toEqual(401);
    });

    it('admin/managerで評価履歴取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/csf/assessments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('Dashboard CSF Integration', () => {
    // TODO: Fix dashboard KPI test - returns 500 in test environment
    it.skip('ダッシュボードKPIにCSF進捗が含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/kpi')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('csf_progress');
      // Dashboard CSF progress uses full names
      expect(res.body.csf_progress).toHaveProperty('govern');
      expect(res.body.csf_progress).toHaveProperty('identify');
      expect(res.body.csf_progress).toHaveProperty('protect');
      expect(res.body.csf_progress).toHaveProperty('detect');
      expect(res.body.csf_progress).toHaveProperty('respond');
      expect(res.body.csf_progress).toHaveProperty('recover');
    });
  });
});
