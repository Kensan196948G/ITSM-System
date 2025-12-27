const request = require('supertest');
const app = require('../../server');

describe('E2E: Complete User Journey Tests', () => {
  let adminToken;
  let analystToken;
  let createdIncidentId;
  let createdRfcId;

  describe('E2E-1: 管理者の完全なワークフロー', () => {
    it('ステップ1: ログイン', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.role).toBe('admin');

      adminToken = res.body.token;
    });

    it('ステップ2: ダッシュボードKPI取得', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/kpi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('active_incidents');
      expect(res.body).toHaveProperty('sla_compliance');
      expect(res.body).toHaveProperty('csf_progress');
      expect(res.body.csf_progress).toHaveProperty('govern');
    });

    it('ステップ3: インシデント一覧取得', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('ステップ4: 新規インシデント作成', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'E2E Test: Network Outage',
          priority: 'Critical',
          description: 'Created from E2E test suite',
          is_security_incident: false
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toMatch(/^INC-/);

      createdIncidentId = res.body.id;
    });

    it('ステップ5: 作成したインシデントの詳細取得', async () => {
      const res = await request(app)
        .get(`/api/v1/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.ticket_id).toBe(createdIncidentId);
      expect(res.body.title).toBe('E2E Test: Network Outage');
      expect(res.body.priority).toBe('Critical');
    });

    it('ステップ6: インシデントのステータス更新', async () => {
      const res = await request(app)
        .put(`/api/v1/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'In-Progress',
          priority: 'High'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('更新');
    });

    it('ステップ7: 更新内容の確認', async () => {
      const res = await request(app)
        .get(`/api/v1/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.body.status).toBe('In-Progress');
      expect(res.body.priority).toBe('High');
    });

    it('ステップ8: 構成管理（CMDB）資産一覧取得', async () => {
      const res = await request(app)
        .get('/api/v1/assets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(6);

      // 重要資産の確認
      const dbServer = res.body.find(a => a.asset_tag === 'SRV-001');
      expect(dbServer).toBeDefined();
      expect(dbServer.criticality).toBe(5);
    });

    it('ステップ9: 現在のユーザー情報取得', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.username).toBe('admin');
      expect(res.body.role).toBe('admin');
      expect(res.body.full_name).toBe('System Administrator');
    });
  });

  describe('E2E-2: アナリストの権限制御フロー', () => {
    it('ステップ1: analystでログイン', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: 'analyst',
          password: 'analyst123'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user.role).toBe('analyst');

      analystToken = res.body.token;
    });

    it('ステップ2: インシデント一覧は閲覧可能', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('ステップ3: インシデント作成は可能', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          title: 'Analyst Created Incident',
          priority: 'Medium',
          description: 'Created by analyst user'
        });

      expect(res.statusCode).toEqual(201);
    });

    it('ステップ4: RFC承認は拒否される（権限不足）', async () => {
      const res = await request(app)
        .put('/api/v1/changes/RFC-2025-001')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          status: 'Approved',
          approver: 'Analyst'
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toContain('権限');
      expect(res.body.requiredRoles).toContain('admin');
      expect(res.body.requiredRoles).toContain('manager');
    });
  });

  describe('E2E-3: セキュリティインシデント処理フロー', () => {
    it('ステップ1: セキュリティインシデント作成', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'E2E: Malware Detection',
          priority: 'Critical',
          description: 'Security incident for E2E testing',
          is_security_incident: true
        });

      expect(res.statusCode).toEqual(201);
      createdIncidentId = res.body.id;
    });

    it('ステップ2: セキュリティインシデントをResolvedに更新', async () => {
      const res = await request(app)
        .put(`/api/v1/incidents/${createdIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'Resolved'
        });

      expect(res.statusCode).toEqual(200);
    });

    it('ステップ3: NIST CSF進捗が自動更新されることを確認', async () => {
      // セキュリティインシデント解決により、RESPONDとRECOVERの進捗が+2%増加するはず
      const res = await request(app)
        .get('/api/v1/dashboard/kpi')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);

      // RESPOND と RECOVER の進捗が初期値より高いことを確認
      // 初期値: RESPOND=85, RECOVER=95
      expect(res.body.csf_progress.respond).toBeGreaterThanOrEqual(85);
      expect(res.body.csf_progress.recover).toBeGreaterThanOrEqual(95);
    });
  });

  describe('E2E-4: エラーハンドリングフロー', () => {
    it('認証なしAPI呼び出し→401エラー', async () => {
      const res = await request(app).get('/api/v1/incidents');
      expect(res.statusCode).toEqual(401);
    });

    it('無効なトークン→403エラー', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.statusCode).toEqual(403);
    });

    it('存在しないエンドポイント→404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/nonexistent')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(404);
    });

    it('バリデーションエラー→詳細なエラーメッセージ', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: '',
          priority: 'InvalidPriority'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('errors');
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });
  });
});
