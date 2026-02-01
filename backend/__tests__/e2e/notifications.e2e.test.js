/**
 * E2Eテスト: 通知設定機能
 * 通知チャネル作成、Webhook URLテスト、通知ログ表示のテスト
 */

const request = require('supertest');
const { app } = require('../../server');

describe('E2E: 通知設定機能テスト', () => {
  let adminToken;
  let managerToken;
  let analystToken;
  let createdChannelId;

  beforeAll(async () => {
    // サーバー起動待機
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 管理者ログイン
    const adminRes = await request(app).post('/api/v1/auth/login').send({
      username: 'admin',
      password: 'admin123'
    });
    expect(adminRes.statusCode).toEqual(200);
    adminToken = adminRes.body.token;

    // マネージャーログイン
    const managerRes = await request(app).post('/api/v1/auth/login').send({
      username: 'manager',
      password: 'manager123'
    });
    expect(managerRes.statusCode).toEqual(200);
    managerToken = managerRes.body.token;

    // アナリストログイン
    const analystRes = await request(app).post('/api/v1/auth/login').send({
      username: 'analyst',
      password: 'analyst123'
    });
    expect(analystRes.statusCode).toEqual(200);
    analystToken = analystRes.body.token;
  });

  describe('E2E-NOTIF-1: 通知チャネル一覧取得テスト', () => {
    it('ステップ1: 管理者が通知チャネル一覧を取得', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);

      // メタ情報の確認
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('channel_types');
      expect(res.body.meta).toHaveProperty('notification_types');

      // サポートされているチャネルタイプ
      expect(res.body.meta.channel_types).toContain('email');
      expect(res.body.meta.channel_types).toContain('slack');
      expect(res.body.meta.channel_types).toContain('teams');
    });

    it('ステップ2: マネージャーも一覧を取得可能', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });

    it('ステップ3: アナリストは一覧取得不可（権限不足）', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.statusCode).toEqual(403);
    });
  });

  describe('E2E-NOTIF-2: Slackチャネル作成テスト', () => {
    it('ステップ1: Slackチャネルを作成', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Slack Channel',
          channel_type: 'slack',
          webhook_url:
            'https://hooks.slack.example.com/services/TEST123456/TEST234567/TESTKEY012345678901234',
          notification_types: ['incident_created', 'sla_violated'],
          is_active: true
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('E2E Test Slack Channel');
      expect(res.body.data.channel_type).toBe('slack');

      // 作成されたIDを保存
      createdChannelId = res.body.data.id;
    });

    it('ステップ2: 作成したチャネルの詳細を取得', async () => {
      const res = await request(app)
        .get(`/api/v1/settings/notifications/${createdChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', createdChannelId);
      expect(res.body.data).toHaveProperty('name', 'E2E Test Slack Channel');
      expect(res.body.data).toHaveProperty('channel_type', 'slack');

      // Webhook URLが保存されていることを確認（管理者は完全なURLを取得可能）
      expect(res.body.data).toHaveProperty('webhook_url');
      // テストデータはexample.comを使用しているのでそれを確認
      expect(res.body.data.webhook_url).toContain('hooks.slack');
    });

    it('ステップ3: Webhook URLなしでSlackチャネルを作成すると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Slack Channel',
          channel_type: 'slack',
          // webhook_urlを省略
          is_active: true
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Webhook URL');
    });
  });

  describe('E2E-NOTIF-3: Teamsチャネル作成テスト', () => {
    let teamsChannelId;

    it('ステップ1: Teamsチャネルを作成', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Teams Channel',
          channel_type: 'teams',
          webhook_url:
            'https://outlook.office.com/webhook/00000000-0000-0000-0000-000000000000@00000000-0000-0000-0000-000000000000/IncomingWebhook/00000000000000000000000000000000/00000000-0000-0000-0000-000000000000',
          notification_types: ['incident_updated', 'change_approved'],
          is_active: true
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.channel_type).toBe('teams');

      teamsChannelId = res.body.data.id;
    });

    it('ステップ2: Teamsチャネルを更新', async () => {
      const res = await request(app)
        .put(`/api/v1/settings/notifications/${teamsChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Teams Channel',
          is_active: false
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('message');
    });

    it('ステップ3: 更新内容を確認', async () => {
      const res = await request(app)
        .get(`/api/v1/settings/notifications/${teamsChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.name).toBe('Updated Teams Channel');
      expect(res.body.data.is_active).toBe(0); // SQLiteでは0/1
    });
  });

  describe('E2E-NOTIF-4: Webhook URLテスト', () => {
    it('ステップ1: Slack Webhook URLテスト（モック環境ではエラー）', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications/test/webhook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel_type: 'slack',
          webhook_url: 'https://hooks.slack.com/services/INVALID/INVALID/INVALID'
        });

      // モック環境では実際のWebhookは失敗するが、エンドポイントは動作する
      expect([200, 400, 500]).toContain(res.statusCode);
    });

    it('ステップ2: Teams Webhook URLテスト', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications/test/webhook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel_type: 'teams',
          webhook_url: 'https://outlook.office.com/webhook/invalid-url'
        });

      // モック環境では実際のWebhookは失敗するが、エンドポイントは動作する
      expect([200, 400, 500]).toContain(res.statusCode);
    });

    it('ステップ3: 無効なチャネルタイプでテストすると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications/test/webhook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel_type: 'invalid_type',
          webhook_url: 'https://example.com/webhook'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('ステップ4: 必須パラメータなしでテストすると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications/test/webhook')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          // channel_typeとwebhook_urlを省略
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('E2E-NOTIF-5: 通知ログ取得テスト', () => {
    it('ステップ1: 通知ログ一覧を取得', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);

      // メタ情報の確認
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('offset');
    });

    it('ステップ2: ページネーションパラメータを指定してログを取得', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/logs?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.meta.limit).toBe(10);
      expect(res.body.meta.offset).toBe(0);
    });

    it('ステップ3: チャネルフィルタを指定してログを取得', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/logs?channel=slack')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
    });

    it('ステップ4: ステータスフィルタを指定してログを取得', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/logs?status=sent')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
    });
  });

  describe('E2E-NOTIF-6: 通知統計取得テスト', () => {
    it('ステップ1: 通知統計を取得', async () => {
      const res = await request(app)
        .get('/api/v1/settings/notifications/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');

      // 統計データの構造を確認
      expect(res.body.data).toHaveProperty('by_channel');
      expect(res.body.data).toHaveProperty('by_type');
      expect(res.body.data).toHaveProperty('last_24_hours');
      expect(res.body.data).toHaveProperty('active_channels');

      // チャネル別統計
      expect(Array.isArray(res.body.data.by_channel)).toBe(true);

      // 通知タイプ別統計
      expect(Array.isArray(res.body.data.by_type)).toBe(true);

      // 過去24時間の統計
      expect(res.body.data.last_24_hours).toHaveProperty('total');
      expect(res.body.data.last_24_hours).toHaveProperty('sent');
      expect(res.body.data.last_24_hours).toHaveProperty('failed');

      // 有効なチャネル数
      expect(typeof res.body.data.active_channels).toBe('number');
    });
  });

  describe('E2E-NOTIF-7: チャネル削除テスト', () => {
    it('ステップ1: 作成したチャネルを削除', async () => {
      const res = await request(app)
        .delete(`/api/v1/settings/notifications/${createdChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('message');
    });

    it('ステップ2: 削除したチャネルの取得を試みると404エラー', async () => {
      const res = await request(app)
        .get(`/api/v1/settings/notifications/${createdChannelId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
    });

    it('ステップ3: 存在しないチャネルを削除すると404エラー', async () => {
      const res = await request(app)
        .delete('/api/v1/settings/notifications/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('E2E-NOTIF-8: バリデーションテスト', () => {
    it('ステップ1: 名前なしでチャネル作成すると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel_type: 'slack',
          webhook_url: 'https://hooks.slack.com/services/TEST/TEST/TEST'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('ステップ2: 無効なチャネルタイプで作成すると400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Channel',
          channel_type: 'invalid_type',
          webhook_url: 'https://example.com'
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('E2E-NOTIF-9: 権限テスト', () => {
    it('管理者のみがチャネル作成可能', async () => {
      const res = await request(app)
        .post('/api/v1/settings/notifications')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({
          name: 'Manager Test Channel',
          channel_type: 'email'
        });

      expect(res.statusCode).toEqual(403);
    });

    it('管理者のみがチャネル削除可能', async () => {
      const res = await request(app)
        .delete('/api/v1/settings/notifications/1')
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('認証なしでアクセスすると401エラー', async () => {
      const res = await request(app).get('/api/v1/settings/notifications');

      expect(res.statusCode).toEqual(401);
    });
  });
});
