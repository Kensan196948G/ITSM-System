const request = require('supertest');
const app = require('../../server');

describe('Incidents API Integration Tests', () => {
  let authToken;
  let testIncidentId;

  beforeAll(async () => {
    // テスト用ユーザーでログイン
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    authToken = res.body.token;
  });

  describe('GET /api/v1/incidents', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/incidents');

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('認証トークン');
    });

    it('認証ありでインシデント一覧取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('取得したインシデントに必要なフィールドが含まれる', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      const incident = res.body[0];
      expect(incident).toHaveProperty('ticket_id');
      expect(incident).toHaveProperty('title');
      expect(incident).toHaveProperty('priority');
      expect(incident).toHaveProperty('status');
      expect(incident).toHaveProperty('created_at');
    });
  });

  describe('GET /api/v1/incidents/:id', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/incidents/INC-2025-001');

      expect(res.statusCode).toEqual(401);
    });

    it('認証ありで特定インシデント取得（200）', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/INC-2025-001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('ticket_id', 'INC-2025-001');
      expect(res.body).toHaveProperty('title');
    });

    it('存在しないIDで404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/INC-99999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.error).toContain('見つかりません');
    });

    it('無効なID形式でも404エラー', async () => {
      const res = await request(app)
        .get('/api/v1/incidents/INVALID-ID')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toEqual(404);
    });
  });

  describe('POST /api/v1/incidents', () => {
    it('有効なデータでインシデント作成（201）', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Incident',
          priority: 'High',
          description: 'Test description for integration test',
          is_security_incident: false
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message');
      expect(res.body.message).toContain('正常に作成');
      expect(res.body).toHaveProperty('id');
      expect(res.body.id).toMatch(/^INC-/);

      testIncidentId = res.body.id;
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).post('/api/v1/incidents').send({
        title: 'Test',
        priority: 'High'
      });

      expect(res.statusCode).toEqual(401);
    });

    it('空のタイトルで400エラー（バリデーション）', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: '',
          priority: 'High'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.error).toContain('無効');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'title',
            message: expect.stringContaining('必須')
          })
        ])
      );
    });

    it('無効な優先度で400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Incident',
          priority: 'InvalidPriority'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'priority',
            message: expect.stringContaining('無効')
          })
        ])
      );
    });

    it('タイトルが500文字を超える場合は400エラー', async () => {
      const longTitle = 'x'.repeat(501);

      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: longTitle,
          priority: 'High'
        });

      expect(res.statusCode).toEqual(400);
    });

    it('descriptionが5000文字を超える場合は400エラー', async () => {
      const longDescription = 'x'.repeat(5001);

      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test',
          priority: 'High',
          description: longDescription
        });

      expect(res.statusCode).toEqual(400);
    });

    it('全優先度レベルで作成可能（Critical, High, Medium, Low）', async () => {
      const priorities = ['Critical', 'High', 'Medium', 'Low'];

      for (const priority of priorities) {
        const res = await request(app)
          .post('/api/v1/incidents')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `${priority} Incident`,
            priority,
            description: `Test ${priority} incident`
          });

        expect(res.statusCode).toEqual(201);
        expect(res.body.id).toMatch(/^INC-/);
      }
    });

    it('セキュリティインシデントフラグが正しく保存される', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Security Test Incident',
          priority: 'Critical',
          is_security_incident: true
        });

      expect(res.statusCode).toEqual(201);

      // 作成されたインシデントを取得して確認
      const getRes = await request(app)
        .get(`/api/v1/incidents/${res.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.body.is_security_incident).toBe(1); // SQLiteでは1/0
    });
  });

  describe('PUT /api/v1/incidents/:id', () => {
    it('ステータス更新成功（200）', async () => {
      const res = await request(app)
        .put('/api/v1/incidents/INC-2025-001')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Resolved'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.message).toContain('更新');
    });

    it('認証なしで401エラー', async () => {
      const res = await request(app).put('/api/v1/incidents/INC-2025-001').send({
        status: 'Resolved'
      });

      expect(res.statusCode).toEqual(401);
    });

    it('複数フィールドを同時更新', async () => {
      const res = await request(app)
        .put('/api/v1/incidents/INC-2025-002')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Title',
          priority: 'Medium',
          status: 'In-Progress'
        });

      expect(res.statusCode).toEqual(200);

      // 更新結果を確認
      const getRes = await request(app)
        .get('/api/v1/incidents/INC-2025-002')
        .set('Authorization', `Bearer ${authToken}`);

      expect(getRes.body.title).toBe('Updated Title');
      expect(getRes.body.priority).toBe('Medium');
      expect(getRes.body.status).toBe('In-Progress');
    });

    it('存在しないIDで更新しても200（SQLiteの仕様）', async () => {
      const res = await request(app)
        .put('/api/v1/incidents/INC-NONEXISTENT')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'Closed'
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.changes).toBe(0); // 0件更新
    });

    it('無効なステータスで400エラー', async () => {
      const res = await request(app)
        .put('/api/v1/incidents/INC-2025-001')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'InvalidStatus'
        });

      expect(res.statusCode).toEqual(400);
    });
  });
});
