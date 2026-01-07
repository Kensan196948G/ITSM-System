const request = require('supertest');
const { app, dbReady } = require('../../server');

describe('SLA Management API Integration Tests', () => {
  let authToken;
  let analystToken;

  beforeAll(async () => {
    await dbReady;
    // Admin login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = adminRes.body.token;

    // Analyst login for role-based tests (analyst has limited permissions)
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    analystToken = analystRes.body.token;
  });

  // ===== SLA一覧表示テスト =====
  describe('GET /api/v1/sla-agreements', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/sla-agreements');
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });

    it('認証ありでSLA一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('ページネーションが正しく機能する', async () => {
      const res = await request(app)
        .get('/api/v1/sla-agreements?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.pagination).toHaveProperty('page', 1);
      expect(res.body.pagination).toHaveProperty('limit', 5);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });

    it('取得したSLAに必要なフィールドが含まれる', async () => {
      // First create an SLA to ensure we have data
      await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Field Check Test Service',
          metric_name: 'Availability',
          target_value: '99.9%'
        });

      const res = await request(app)
        .get('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      if (res.body.data.length > 0) {
        const sla = res.body.data[0];
        expect(sla).toHaveProperty('sla_id');
        expect(sla).toHaveProperty('service_name');
        expect(sla).toHaveProperty('metric_name');
        expect(sla).toHaveProperty('target_value');
        expect(sla).toHaveProperty('status');
      }
    });
  });

  // ===== SLA作成テスト（モーダル操作） =====
  describe('POST /api/v1/sla-agreements', () => {
    it('有効なデータでSLA作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Email Service',
          metric_name: 'Uptime',
          target_value: '99.5%'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('sla_id');
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('正常に作成されました');
    });

    it('必須フィールドなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Incomplete Service'
          // metric_name and target_value missing
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
    });

    it('service_nameなしで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          metric_name: 'Response Time',
          target_value: '< 200ms'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('analystロールではSLA作成不可（403）', async () => {
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          service_name: 'Analyst Created Service',
          metric_name: 'Response Rate',
          target_value: '95%'
        });

      // SLA作成はadmin/managerロールのみ許可
      expect(res.statusCode).toEqual(403);
    });

    it('作成されたSLAに正しいデフォルト値が設定される', async () => {
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Default Values Test Service',
          metric_name: 'Latency',
          target_value: '< 100ms'
        });

      expect(res.statusCode).toEqual(201);

      // Verify the created SLA has default values
      const getRes = await request(app)
        .get('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`);

      const createdSla = getRes.body.data.find(s => s.sla_id === res.body.sla_id);
      if (createdSla) {
        expect(createdSla.status).toEqual('Met');
        expect(createdSla.achievement_rate).toEqual(0);
      }
    });
  });

  // ===== SLA編集テスト =====
  describe('PUT /api/v1/sla-agreements/:id', () => {
    let testSlaId;

    beforeAll(async () => {
      // Create an SLA for update tests
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Update Test Service',
          metric_name: 'Availability',
          target_value: '99.0%'
        });
      testSlaId = res.body.sla_id;
    });

    it('有効なデータでSLA更新（200）', async () => {
      const res = await request(app)
        .put(`/api/v1/sla-agreements/${testSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Updated Service Name',
          actual_value: '98.5%',
          achievement_rate: 98.5,
          status: 'Met'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('更新されました');
    });

    it('ステータスをAt-Riskに更新可能', async () => {
      const res = await request(app)
        .put(`/api/v1/sla-agreements/${testSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          actual_value: '85%',
          achievement_rate: 85,
          status: 'At-Risk'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('changes');
    });

    it('存在しないSLA IDで404エラー', async () => {
      const res = await request(app)
        .put('/api/v1/sla-agreements/SLA-999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Non-existent Update',
          status: 'Met'
        });

      expect(res.statusCode).toEqual(404);
    });

    it('analystロールでは更新不可（403）', async () => {
      const res = await request(app)
        .put(`/api/v1/sla-agreements/${testSlaId}`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          metric_name: 'Updated Metric Name'
        });

      // SLA更新はadmin/managerロールのみ許可
      expect(res.statusCode).toEqual(403);
    });

    it('measurement_periodを更新可能', async () => {
      const res = await request(app)
        .put(`/api/v1/sla-agreements/${testSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          measurement_period: 'Weekly'
        });

      expect(res.statusCode).toEqual(200);
    });
  });

  // ===== SLA削除テスト =====
  describe('DELETE /api/v1/sla-agreements/:id', () => {
    let deleteTestSlaId;

    beforeEach(async () => {
      // Create a fresh SLA for each delete test
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Delete Test Service',
          metric_name: 'Uptime',
          target_value: '99.9%'
        });
      deleteTestSlaId = res.body.sla_id;
    });

    it('admin権限でSLA削除可能（200）', async () => {
      const res = await request(app)
        .delete(`/api/v1/sla-agreements/${deleteTestSlaId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('削除されました');
      expect(res.body).toHaveProperty('deleted_by');
    });

    it('analyst権限ではSLA削除不可（403）', async () => {
      const res = await request(app)
        .delete(`/api/v1/sla-agreements/${deleteTestSlaId}`)
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('存在しないSLA IDで404エラー', async () => {
      const res = await request(app)
        .delete('/api/v1/sla-agreements/SLA-999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });

    it('削除後に同じIDでGETすると一覧に含まれない', async () => {
      // Delete the SLA
      await request(app)
        .delete(`/api/v1/sla-agreements/${deleteTestSlaId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Verify it's not in the list
      const listRes = await request(app)
        .get('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`);

      const deletedSla = listRes.body.data.find(s => s.sla_id === deleteTestSlaId);
      expect(deletedSla).toBeUndefined();
    });
  });

  // ===== SLAレポート生成APIテスト =====
  describe('GET /api/v1/sla-reports/generate', () => {
    beforeAll(async () => {
      // Create test SLAs with different statuses for report testing
      await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Report Test Service 1',
          metric_name: 'Availability',
          target_value: '99.9%'
        });

      await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Report Test Service 2',
          metric_name: 'Response Time',
          target_value: '< 500ms'
        });
    });

    it('認証ありでレポート生成（200）', async () => {
      const res = await request(app)
        .get('/api/v1/sla-reports/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('by_service');
      expect(res.body).toHaveProperty('details');
    });

    it('レポートにサマリー統計が含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/sla-reports/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.summary).toHaveProperty('total_slas');
      expect(res.body.summary).toHaveProperty('met');
      expect(res.body.summary).toHaveProperty('at_risk');
      expect(res.body.summary).toHaveProperty('violated');
      expect(res.body.summary).toHaveProperty('avg_achievement_rate');
    });

    it('日付範囲フィルタが機能する', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/v1/sla-reports/generate?from_date=${today}&to_date=${today}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('details');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/sla-reports/generate');
      expect(res.statusCode).toEqual(401);
    });

    it('レポートにアラート情報が含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/sla-reports/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('alerts');
      expect(Array.isArray(res.body.alerts)).toBe(true);
    });

    it('サービス別の集計が含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/sla-reports/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('by_service');
      expect(typeof res.body.by_service).toBe('object');
    });
  });

  // ===== SLA統計エンドポイントテスト =====
  describe('GET /api/v1/sla-statistics', () => {
    it('認証ありで統計取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/sla-statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('statistics');
      expect(res.body).toHaveProperty('alert_threshold');
    });

    it('統計に必要なフィールドが含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/sla-statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.statistics).toHaveProperty('total');
      expect(res.body.statistics).toHaveProperty('met');
      expect(res.body.statistics).toHaveProperty('at_risk');
      expect(res.body.statistics).toHaveProperty('violated');
      expect(res.body.statistics).toHaveProperty('avg_achievement_rate');
      expect(res.body.statistics).toHaveProperty('compliance_rate');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/sla-statistics');
      expect(res.statusCode).toEqual(401);
    });
  });

  // ===== SLA違反アラートテスト =====
  describe('SLA Violation Alert Detection', () => {
    let alertTestSlaId;

    beforeAll(async () => {
      // Create an SLA with Met status for alert testing
      const res = await request(app)
        .post('/api/v1/sla-agreements')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          service_name: 'Alert Test Service',
          metric_name: 'Uptime',
          target_value: '99.9%'
        });
      alertTestSlaId = res.body.sla_id;

      // Set initial achievement rate above threshold
      await request(app)
        .put(`/api/v1/sla-agreements/${alertTestSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          achievement_rate: 95,
          status: 'Met'
        });
    });

    it('ステータスがViolatedに変更されるとalert_triggeredがtrue', async () => {
      const res = await request(app)
        .put(`/api/v1/sla-agreements/${alertTestSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          achievement_rate: 70,
          status: 'Violated'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('alert_triggered', true);
    });

    it('ステータスがAt-Riskに変更されるとalert_triggeredがtrue', async () => {
      // Reset to Met first
      await request(app)
        .put(`/api/v1/sla-agreements/${alertTestSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          achievement_rate: 95,
          status: 'Met'
        });

      const res = await request(app)
        .put(`/api/v1/sla-agreements/${alertTestSlaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          achievement_rate: 88,
          status: 'At-Risk'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('alert_triggered', true);
    });
  });
});
