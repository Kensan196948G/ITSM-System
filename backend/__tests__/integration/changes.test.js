const request = require('supertest');
const app = require('../../server');

describe('Changes API Integration Tests', () => {
  let adminToken;
  let analystToken;
  let testRfcId;

  beforeAll(async () => {
    // Admin user login
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminRes.body.token;

    // Analyst user login
    const analystRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'analyst', password: 'analyst123' });
    analystToken = analystRes.body.token;
  });

  describe('GET /api/v1/changes', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/changes');

      expect(res.statusCode).toEqual(401);
      expect(res.body.error).toContain('認証トークン');
    });

    it('認証ありで変更要求一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/changes')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('取得したRFCに必要なフィールドが含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/changes')
        .set('Authorization', `Bearer ${adminToken}`);

      const rfc = res.body[0];
      expect(rfc).toHaveProperty('rfc_id');
      expect(rfc).toHaveProperty('title');
      expect(rfc).toHaveProperty('status');
      expect(rfc).toHaveProperty('requester');
      expect(rfc).toHaveProperty('impact_level');
    });
  });

  describe('POST /api/v1/changes', () => {
    it('有効なデータでRFC作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test RFC',
          description: 'Test RFC description',
          asset_tag: 'SRV-001',
          requester: 'Admin User',
          impact_level: 'Medium',
          is_security_change: false
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toContain('正常に作成');
      expect(res.body.id).toMatch(/^RFC-/);

      testRfcId = res.body.id;
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app)
        .post('/api/v1/changes')
        .send({
          title: 'Test',
          requester: 'Someone'
        });

      expect(res.statusCode).toEqual(401);
    });

    it('空のタイトルで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          requester: 'Admin'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('無効');
    });

    it('requester未指定で400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Test RFC'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('analystユーザーでもRFC作成可能', async () => {
      const res = await request(app)
        .post('/api/v1/changes')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          title: 'Analyst RFC',
          requester: 'Security Analyst',
          impact_level: 'Low'
        });

      expect(res.statusCode).toEqual(201);
    });

    it('UUID形式のRFC IDが生成される', async () => {
      const res = await request(app)
        .post('/api/v1/changes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'UUID Test RFC',
          requester: 'Admin'
        });

      expect(res.body.id).toMatch(/^RFC-[A-F0-9]{8}$/);
    });
  });

  describe('PUT /api/v1/changes/:id', () => {
    it('adminユーザーでRFC承認成功（200）', async () => {
      const res = await request(app)
        .put(`/api/v1/changes/${testRfcId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'Approved',
          approver: 'Admin User'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('更新');
    });

    it('analystユーザーでRFC承認は403エラー（RBAC）', async () => {
      const res = await request(app)
        .put('/api/v1/changes/RFC-2025-001')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          status: 'Approved',
          approver: 'Analyst'
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('権限');
      expect(res.body.requiredRoles).toEqual(['admin', 'manager']);
      expect(res.body.userRole).toBe('analyst');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app)
        .put('/api/v1/changes/RFC-2025-001')
        .send({
          status: 'Approved'
        });

      expect(res.statusCode).toEqual(401);
    });

    it('無効なステータスで400エラー', async () => {
      const res = await request(app)
        .put('/api/v1/changes/RFC-2025-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'InvalidStatus'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('Rejected ステータスに更新可能', async () => {
      const res = await request(app)
        .put('/api/v1/changes/RFC-2025-002')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'Rejected',
          approver: 'Admin User'
        });

      expect(res.statusCode).toEqual(200);
    });

    it('Implemented ステータスに更新可能', async () => {
      const res = await request(app)
        .put('/api/v1/changes/RFC-2025-001')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'Implemented',
          approver: 'Admin User'
        });

      expect(res.statusCode).toEqual(200);
    });
  });
});
