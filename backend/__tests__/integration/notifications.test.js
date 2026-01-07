/**
 * Notification Settings API Integration Tests
 * 通知設定APIの統合テスト
 */

const request = require('supertest');
const { app, dbReady } = require('../../server');
const { db } = require('../../db');

describe('Notification Settings API Integration Tests', () => {
  let adminToken;
  let managerToken;
  let createdChannelId;

  beforeAll(async () => {
    // データベース初期化を待機
    await dbReady;

    // 管理者トークンを取得
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminRes.body.token;

    // マネージャートークンを取得
    const managerRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'manager', password: 'manager123' });
    managerToken = managerRes.body.token;

    // テストデータをクリーンアップ
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM notification_channels WHERE name LIKE 'Test%'", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  describe('GET /api/v1/settings/notifications', () => {
    it('管理者は通知チャネル一覧を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.channel_types).toContain('email');
      expect(res.body.meta.channel_types).toContain('slack');
      expect(res.body.meta.channel_types).toContain('teams');
    });

    it('マネージャーは通知チャネル一覧を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('認証なしではアクセスできない', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/settings/notifications', () => {
    it('管理者はSlack通知チャネルを作成できる', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Slack Channel',
          channel_type: 'slack',
          webhook_url: 'https://hooks.slack.com/services/test/test/test',
          notification_types: ['incident_created', 'sla_violation'],
          is_active: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      createdChannelId = res.body.data.id;
    });

    it('マネージャーは通知チャネルを作成できない', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Test Channel',
          channel_type: 'slack',
          webhook_url: 'https://hooks.slack.com/services/test'
        });

      expect(res.status).toBe(403);
    });

    it('必須フィールドがない場合はエラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Channel'
          // channel_type missing
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('不正なchannel_typeはエラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Channel',
          channel_type: 'invalid_type'
        });

      expect(res.status).toBe(400);
    });

    it('Slack/TeamsにはWebhook URLが必須', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Slack Without URL',
          channel_type: 'slack'
          // webhook_url missing
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Webhook URL');
    });
  });

  describe('GET /api/v1/settings/notifications/:id', () => {
    it('管理者は通知チャネル詳細を取得できる', async () => {
      if (!createdChannelId) {
        // チャネルを作成
        const createRes = await request(app)
          .post('/api/v1/settings/notifications')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Test Detail Channel',
            channel_type: 'slack',
            webhook_url: 'https://hooks.slack.com/services/test/detail'
          });
        createdChannelId = createRes.body.data.id;
      }

      const res = await request(app)
        .get(`/api/v1/settings/notifications/${createdChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdChannelId);
    });

    it('存在しないIDはエラー', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/settings/notifications/:id', () => {
    it('管理者は通知チャネルを更新できる', async () => {
      const res = await request(app)
        .put(`/api/v1/settings/notifications/${createdChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Test Channel',
          is_active: false
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('存在しないIDの更新はエラー', async () => {
      const res = await request(app)
        .put('/api/v1/settings/notifications/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/settings/notifications/test/webhook', () => {
    it('管理者はWebhookテストを実行できる', async () => {
      // このテストは実際のWebhook URLへの送信をモックしていないので、
      // 不正なURLの場合はエラーを返すことを確認
      const res = await request(app)
        .post('/api/v1/settings/notifications/test/webhook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel_type: 'slack',
          webhook_url: 'https://invalid-webhook-url.example.com'
        });

      // Webhookへの接続エラーが発生するはず
      expect(res.status).toBe(400);
    });

    it('必須フィールドがない場合はエラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications/test/webhook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel_type: 'slack'
          // webhook_url missing
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/settings/notifications/logs', () => {
    it('管理者は通知ログを取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toBeDefined();
    });

    it('ページネーションパラメータが機能する', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/logs?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(0);
    });
  });

  describe('GET /api/v1/settings/notifications/stats', () => {
    it('管理者は通知統計を取得できる', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.by_channel).toBeDefined();
      expect(res.body.data.by_type).toBeDefined();
      expect(res.body.data.last_24_hours).toBeDefined();
      expect(res.body.data.active_channels).toBeDefined();
    });
  });

  describe('DELETE /api/v1/settings/notifications/:id', () => {
    it('管理者は通知チャネルを削除できる', async () => {
      const res = await request(app)
        .delete(`/api/v1/settings/notifications/${createdChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('存在しないIDの削除はエラー', async () => {
      const res = await request(app)
        .delete('/api/v1/settings/notifications/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  afterAll(async () => {
    // テストデータをクリーンアップ
    await new Promise((resolve, reject) => {
      db.run("DELETE FROM notification_channels WHERE name LIKE 'Test%'", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
});
