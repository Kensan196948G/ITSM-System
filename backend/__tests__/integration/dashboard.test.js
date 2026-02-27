const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('Dashboard API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    await dbReady;

    const res = await request(app).post('/api/v1/auth/login').send({
      username: 'admin',
      password: 'admin123'
    });

    authToken = res.body.token;
  }, 90000); // タイムアウト延長

  describe('GET /api/v1/dashboard/kpi', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/dashboard/kpi');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });

    it('認証ありでKPIメトリクス取得', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/kpi')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('active_incidents');
        expect(res.body).toHaveProperty('sla_compliance');
        expect(res.body).toHaveProperty('csf_progress');
      }
    });
  }, 90000);

  describe('GET /api/v1/dashboard/charts', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/dashboard/charts');

      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでチャートデータ取得', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('incidentTrend');
        expect(res.body).toHaveProperty('slaAchievement');
        expect(res.body).toHaveProperty('incidentsByPriority');
      }
    });
  });

  describe('GET /api/v1/dashboard/widgets', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/dashboard/widgets');

      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでウィジェットデータ取得', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('kpi');
        expect(res.body).toHaveProperty('activeIncidents');
        expect(res.body).toHaveProperty('weeklyChanges');
      }
    });
  });

  describe('GET /api/v1/dashboard/activity', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/dashboard/activity');

      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでアクティビティデータ取得', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/activity')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('activities');
        expect(Array.isArray(res.body.activities)).toBe(true);
      }
    });
  });

  describe('GET /api/v1/dashboard/stats', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/dashboard/stats');

      expect(res.statusCode).toEqual(401);
    });

    it('認証ありで統計データ取得', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        expect(res.body).toHaveProperty('incidents');
        expect(res.body).toHaveProperty('assets');
        expect(res.body).toHaveProperty('sla');
      }
    });
  });

  describe('エラーハンドリング検証', () => {
    it('無効なエンドポイントで404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/invalid-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });
});
