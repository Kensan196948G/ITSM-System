/**
 * SLA Alert History API Integration Tests
 * アラート履歴管理のE2Eテスト
 */

const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('SLA Alert History API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    await dbReady;

    // Admin login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = loginRes.body.token;
  }, 90000);

  describe('GET /api/v1/sla-alerts', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/sla-alerts');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでアラート一覧取得成功', async () => {
      const res = await request(app)
        .get('/api/v1/sla-alerts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('unacknowledged_count');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('acknowledgedフィルターで絞り込み', async () => {
      const res = await request(app)
        .get('/api/v1/sla-alerts?acknowledged=false')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      // 未確認アラートのみが返される
      res.body.data.forEach((alert) => {
        expect(alert.acknowledged).toBeFalsy();
      });
    });

    it('alert_typeフィルターで絞り込み', async () => {
      const res = await request(app)
        .get('/api/v1/sla-alerts?alert_type=violation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((alert) => {
        expect(alert.alert_type).toEqual('violation');
      });
    });

    it('limitとoffsetでページング', async () => {
      const res = await request(app)
        .get('/api/v1/sla-alerts?limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/v1/sla-alerts/stats', () => {
    it('認証ありでアラート統計取得成功', async () => {
      const res = await request(app)
        .get('/api/v1/sla-alerts/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('unacknowledged');
      expect(res.body).toHaveProperty('acknowledged');
      expect(res.body).toHaveProperty('by_type');
      expect(res.body).toHaveProperty('last_7_days');
      expect(res.body).toHaveProperty('last_30_days');
    });
  });

  describe('PUT /api/v1/sla-alerts/:id/acknowledge', () => {
    it('存在しないアラートで404エラー', async () => {
      const res = await request(app)
        .put('/api/v1/sla-alerts/NONEXISTENT-ALERT/acknowledge')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ note: 'Test note' });

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /api/v1/sla-alerts/acknowledge-bulk', () => {
    it('空の配列で400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/sla-alerts/acknowledge-bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ alert_ids: [] });

      expect(res.statusCode).toEqual(400);
    });

    it('alert_idsなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/sla-alerts/acknowledge-bulk')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
    });
  });
});
